const async = require('async');
const SteamID = require('steamid');
const request = require('@nicklason/request-retry');
const SKU = require('tf2-sku');
const isObject = require('isobject');
const moment = require('moment');

const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

const Listing = require('./classes/listing');

const EFailiureReason = require('./resources/EFailureReason');

class ListingManager {
    /**
     * Creates a new instance of the listing manager
     * @param {Object} options
     * @param {String} options.token The access token of the account being managed
     * @param {String} options.steamid The steamid of the account being managed
     * @param {Number} [options.waitTime=100] Time to wait before processing the queues
     * @param {Number} [options.batchSize=50]
     * @param {Object} options.schema Schema from the tf2-schema module (schemaManager.schema)
     */
    constructor (options) {
        options = options || {};

        EventEmitter.call(this);

        this.token = options.token;
        this.steamid = new SteamID(options.steamid);

        // Time to wait before sending request after enqueing action
        this.waitTime = options.waitTime || 100;
        // Amount of listings to create at once
        this.batchSize = options.batchSize || 50;

        this.cap = null;
        this.promotes = null;

        this.listings = [];

        this.actions = {
            create: [],
            remove: []
        };

        this.schema = options.schema || null;

        this._lastInventoryUpdate = null;
    }

    /**
     * Initializes the module
     * @param {Function} callback
     */
    init (callback) {
        if (this.ready) {
            callback(null);
            return;
        }

        if (!this.steamid.isValid()) {
            callback(new Error('Invalid / missing steamid64'));
            return;
        }

        if (this.schema === null) {
            callback(new Error('Missing schema from tf2-schema'));
            return;
        }

        this._updateListings((err) => {
            if (err) {
                return callback(err);
            }

            this._updateInventory(() => {
                this._startTimers();

                this.ready = true;
                this.emit('ready');

                // Emit listings after initializing
                this.emit('listings', this.listings);

                return callback(null);
            });
        });
    }

    /**
     * Sends a heartbeat to backpack.tf.
     * @description Bumps listings and gives you lightning icon on listings if you have set a tradeofferurl in your settings (https://backpack.tf/settings)
     * @param {Function} callback
     */
    sendHeartbeat (callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/aux/heartbeat/v1',
            qs: {
                token: this.token,
                automatic: 'all'
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.emit('heartbeat', body.bumped);

            return callback(null, body);
        });
    }

    /**
     * Updates your inventory on backpack.tf
     * @param {Function} callback
     */
    _updateInventory (callback) {
        const options = {
            method: 'GET',
            url: `https://backpack.tf/_inventory/${this.steamid.getSteamID64()}`,
            gzip: true,
            json: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            if (body.status.id == -1) {
                return callback(new Error(body.status.text + ' (' + body.status.extra + ')'));
            }

            const time = moment.unix(body.time.timestamp);

            if (this._lastInventoryUpdate === null) {
                this._lastInventoryUpdate = time;
            } else if (body.fallback.available === false && time.unix() !== this._lastInventoryUpdate.unix()) {
                // The inventory has updated on backpack.tf
                this._lastInventoryUpdate = time;

                this.emit('inventory', this._lastInventoryUpdate);

                // The inventory has been updated on backpack.tf, try and make listings
                this._processActions();
            }

            return callback(null);
        });
    }

    /**
     * Gets the listings that you have on backpack.tf
     * @param {Function} callback
     */
    getListings (callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'GET',
            url: 'https://backpack.tf/api/classifieds/listings/v1',
            qs: {
                token: this.token
            },
            body: {
                automatic: 'all'
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.cap = body.cap;
            this.promotes = body.promotes_remaining;
            this.listings = body.listings.map((listing) => new Listing(listing, this));

            // Go through create queue and find listings that need retrying
            this.actions.create.forEach((formattet) => {
                if (formattet.retry !== undefined) {
                    // Look for a listing that has a matching sku / id
                    const match = this.findListing(formattet.intent == 0 ? formattet.sku : formattet.id, formattet.intent);
                    if (match !== null) {
                        // Found match, remove the listing and unset retry property
                        match.remove();
                    }
                }
            });

            if (this.ready) {
                this.emit('listings', this.listings);
            }

            return callback(null, body);
        });
    }

    /**
     * Searches for one specific listing by sku or assetid
     * @param {String|Number} search sku or assetid
     * @param {Number} intent 0 for buy, 1 for sell
     * @param {Boolean} [byItem=false] true if you want to only search by sku, false if you search for a specific listing (sku or assetid)
     * @return {Listing} Returns matching listing
     */
    findListing (search, intent, byItem = false) {
        const match = this.listings.find((listing) => {
            if (listing.intent != intent) {
                return false;
            }

            if (byItem === true || intent == 0) {
                return listing.getSKU() === search;
            } else {
                return listing.item.id == search;
            }
        });

        return match === undefined ? null : match;
    }

    /**
     * Finds all listings that match sku
     * @param {String} sku
     * @return {Array<Listing>} Returns matching listings
     */
    findListings (sku) {
        return this.listings.filter((listing) => {
            return listing.getSKU() === sku;
        });
    }

    /**
     * Enqueues a list of listings to be made
     * @param {Array<Object>} listings
     */
    createListings (listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattetArr = listings.map((value) => this._formatListing(value)).filter((formattet) => formattet !== null);

        const remove = [];

        formattetArr.forEach((formattet) => {
            const match = this.findListing(formattet.intent == 1 ? formattet.id : formattet.sku, formattet.intent);
            if (match !== null) {
                remove.push(match.id);
            }
        });

        this._action('remove', remove);
        this._action('create', formattetArr);
    }

    /**
     * Enqueues a list of listings to be made
     * @param {Object} listing
     */
    createListing (listing) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = this._formatListing(listing);

        if (formattet !== null) {
            const match = this.findListing(formattet.intent == 1 ? formattet.id : formattet.sku, formattet.intent);
            if (match !== null) {
                match.remove();
            }

            this._action('create', formattet);
        }
    }

    /**
     * Enqueus a list of listings or listing ids to be removed
     * @param {Array<Object>|Array<String>} listings
     */
    removeListings (listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = listings.map((value) => !isObject(value) ? value : value.id);

        this._action('remove', formattet);
    }

    /**
     * Enqueus a list of listings or listing ids to be removed
     * @param {Object|String} listing
     */
    removeListing (listing) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        if (!isObject(listing)) {
            this._action('remove', listing);
        } else {
            this._action('remove', listing.id);
        }
    }

    /**
     * Function used to enqueue jobs
     * @param {String} type
     * @param {Array<Object>|Array<String>|Object|String} value
     */
    _action (type, value) {
        const array = Array.isArray(value) ? value : [value];

        if (array.length === 0) {
            return;
        }

        let doneSomething = false;

        if (type === 'remove') {
            const noMatch = array.filter((id) => this.actions.create.indexOf(id) === -1);
            if (noMatch.length !== 0) {
                this.actions[type] = this.actions[type].concat(noMatch);
                doneSomething = true;
            }
        } else if (type === 'create') {
            // Check if the item is already in the queue
            array.forEach((formattet) => {
                this._removeEnqueued(formattet);
            });

            this.actions[type] = this.actions[type].concat(array);
            doneSomething = true;
        }

        if (doneSomething) {
            this.emit('actions', this.actions);

            this._startTimeout();
        }
    }

    /**
     * Starts heartbeat and inventory timers
     */
    _startTimers () {
        this._heartbeatInterval = setInterval(ListingManager.prototype._updateListings.bind(this, () => {}), 90000);
        this._inventoryInterval = setInterval(ListingManager.prototype._updateInventory.bind(this, () => {}), 120000);
    }

    /**
     * Stops all timers and timeouts and clear values to default
     */
    stop () {
        // Stop timers
        clearTimeout(this._timeout);
        clearInterval(this._heartbeatInterval);
        clearInterval(this._inventoryInterval);

        // Reset values
        this.ready = false;
        this.listings = [];
        this.cap = null;
        this.promotes = null;
        this.actions = { create: [], remove: [] };
    }

    /**
     * Starts timeout used to process actions
     */
    _startTimeout () {
        clearTimeout(this._timeout);
        this._timeout = setTimeout(ListingManager.prototype._processActions.bind(this), this.waitTime);
    }

    /**
     * Sends heartbeat and gets listings
     * @param {Function} callback
     */
    _updateListings (callback) {
        async.series([
            (callback) => {
                this.sendHeartbeat(callback);
            },
            (callback) => {
                this.getListings(callback);
            }
        ], (err) => {
            return callback(err);
        });
    }

    /**
     * Processes action queues
     */
    _processActions () {
        if (this._processingActions === true || (this.actions.remove.length === 0 && this._listingsWaitingForRetry() - this._listingsWaitingForInventoryCount() - this.actions.create.length === 0)) {
            return;
        }

        this._processingActions = true;

        async.series({
            delete: (callback) => {
                this._delete(callback);
            },
            create: (callback) => {
                this._create(callback);
            }
        }, (result) => {
            // TODO: Only get listings if we created or deleted listings

            if (this.actions.remove.length !== 0 || this._listingsWaitingForRetry() - this.actions.create.length !== 0) {
                this._processingActions = false;
                // There are still things to do
                this._startTimeout();
            } else {
                // Queues are empty, get listings
                this.getListings(() => {
                    this._processingActions = false;
                    this._startTimeout();
                });
            }
        });
    }

    /**
     * Creates a batch of listings from the queue
     * @param {Function} callback
     */
    _create (callback) {
        if (this.actions.create.length === 0) {
            callback(null);
            return;
        }

        // TODO: Don't send sku and attempt time to backpack.tf

        const batch = this.actions.create.filter((listing) => listing.attempt !== this._lastInventoryUpdate).slice(0, this.batchSize);

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/classifieds/list/v1',
            qs: {
                token: this.token
            },
            body: {
                listings: batch
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            const waitForInventory = [];
            const retryListings = [];

            for (const identifier in body.listings) {
                if (!body.listings.hasOwnProperty(identifier)) {
                    continue;
                }

                const listing = body.listings[identifier];
                if (listing.hasOwnProperty('error')) {
                    if (listing.error === '' || listing.error == EFailiureReason.ItemNotInInventory) {
                        waitForInventory.push(identifier);
                    } else if (listing.error.indexOf('as it already exists') !== -1 || listing.error == EFailiureReason.RelistTimeout) {
                        // This error should be extremely rare

                        // Find listing matching the identifier in create queue
                        const match = this.actions.create.find((formattet) => {
                            if (formattet.intent == 1 && formattet.id == identifier) {
                                return true;
                            } else if (formattet.intent == 0 && this.schema.getName(SKU.fromString(formattet.sku)) === identifier) {
                                return true;
                            } else {
                                return false;
                            }
                        });

                        if (match !== undefined) {
                            // If we can't find the listing, then it was already removed / we can't identify the item / we can't properly list the item (FISK!!!)
                            retryListings.push(match.intent == 1 ? match.id : match.sku);
                        }
                    }
                }
            }

            this.actions.create = this.actions.create.filter((formattet) => {
                if (formattet.intent == 1 && waitForInventory.indexOf(formattet.id) !== -1) {
                    if (formattet.attempt !== undefined) {
                        // We have already tried to list before, remove it from the queue
                        return false;
                    }

                    // We should wait for the inventory to update
                    formattet.attempt = this._lastInventoryUpdate;
                    return true;
                } else if (formattet.retry !== true && retryListings.indexOf(formattet.intent == 0 ? formattet.sku : formattet.id) !== -1) {
                    // A similar listing was already made, we will need to remove the old listing and then try and add this one again
                    formattet.retry = true;
                    return true;
                }

                const index = batch.findIndex((v) => v.sku === formattet.sku);

                if (index !== -1) {
                    batch.splice(index, 1);
                }

                return index === -1;
            });

            this.emit('actions', this.actions);

            callback(null, body);
        });
    }

    /**
     * Removes all listings in the remove queue
     * @param {Function} callback
     */
    _delete (callback) {
        if (this.actions.remove.length === 0) {
            callback(null);
            return;
        }

        const remove = this.actions.remove.concat();

        const options = {
            method: 'DELETE',
            url: 'https://backpack.tf/api/classifieds/delete/v1',
            qs: {
                token: this.token
            },
            body: {
                listing_ids: remove
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            // Filter out listings that we just deleted
            this.actions.remove = this.actions.remove.filter((id) => remove.indexOf(id) === -1);

            // Update cached listings
            this.listings = this.listings.filter((listing) => remove.indexOf(listing.id) === -1);

            this.emit('actions', this.actions);

            return callback(null, body);
        });
    }

    /**
     * Formats a listing so that it is ready to be sent to backpack.tf
     * @param {Object} listing
     * @return {Object} listing if formattet correctly, null if not
     */
    _formatListing (listing) {
        if (listing.intent == 0) {
            if (listing.sku === undefined) {
                return null;
            }

            const item = this._formatItem(listing.sku);
            if (item === null) {
                return null;
            }
            listing.item = item;

            // Keep sku for later
        }

        return listing;
    }

    /**
     * Removes a matching enqueued listing
     * @param {Object} listing Formattet listing
     */
    _removeEnqueued (listing) {
        const index = this.actions.create.findIndex((v) => {
            if (listing.intent !== v.intent) {
                return false;
            }

            if (listing.intent == 0 && listing.sku === v.sku) {
                return true;
            } else if (listing.intent == 1 && listing.id === v.id) {
                return true;
            } else {
                return false;
            }
        });

        if (index !== -1) {
            this.actions.create.splice(index, 1);
        }
    }

    /**
     * Converts an sku into an item object that backpack.tf understands
     * @param {String} sku
     * @return {Object} Returns the formattet item, null if the item does not exist
     */
    _formatItem (sku) {
        const item = SKU.fromString(sku);

        const schemaItem = this.schema.getItemByDefindex(item.defindex);

        if (schemaItem === null) {
            return null;
        }

        const name = this.schema.getName({
            defindex: item.defindex,
            quality: 6,
            killstreak: item.killstreak,
            australium: item.australium
        }, false);

        const formattet = {
            item_name: name
        };

        formattet.quality = (item.quality2 !== null ? this.schema.getQualityById(item.quality2) + ' ' : '') + this.schema.getQualityById(item.quality);

        if (!item.craftable) {
            formattet.craftable = 0;
        }

        if (item.effect !== null) {
            formattet.priceindex = item.effect;
        }

        return formattet;
    }

    /**
     * Returns the amount of listings that are waiting for the inventory to update
     * @return {Number}
     */
    _listingsWaitingForInventoryCount () {
        return this.actions.create.filter((listing) => listing.intent == 1 && listing.attempt === this._lastInventoryUpdate).length;
    }

    /**
     * Returns the amount of listings that are waiting for the listings to be updated
     * @return {Number}
     */
    _listingsWaitingForRetry () {
        return this.actions.create.filter((listing) => listing.retry !== undefined).length;
    }
}

inherits(ListingManager, EventEmitter);

module.exports = ListingManager;
module.exports.Listing = Listing;

module.exports.EFailiureReason = EFailiureReason;

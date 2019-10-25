const async = require('async');
const SteamID = require('steamid');
const request = require('@nicklason/request-retry');
const TF2SKU = require('tf2-sku');
const isObject = require('isobject');
const moment = require('moment');

const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

const Listing = require('./classes/listing');

const EFailiureReason = require('./resources/EFailureReason');

class ListingManager {
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

            this._startTimers();

            this.ready = true;
            this.emit('ready');
            return callback(null);
        });
    }

    sendHeartbeat (callback) {
        if (!this.token) {
            callback(new Error('No token set (yet)'));
            return;
        }

        const options = {
            method: 'POST',
            url: 'https://backpack.tf/api/aux/heartbeat/v1',
            qs: {
                token: this.token
            },
            json: true,
            gzip: true
        };

        request(options, (err, response, body) => {
            if (err) {
                return callback(err);
            }

            this.emit('heatbeat', body.bumped);

            return callback(null, body);
        });
    }

    updateInventory (callback) {
        const options = {
            method: 'GET',
            url: `https://backpack.tf/_inventory/${this.steamid64}`,
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

            // TODO: Retry updating the inventory if told so

            // TODO: Make sure that the inventory has actually updated (check when the inventory was last updated)

            this.emit('inventory', moment.unix(body.time.timestamp));
        });
    }

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

            this.emit('listings', this.listings);

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

    createListings (listings, force = false) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = listings.map((value) => this._formatListing(value)).filter((listing) => listing !== null);

        if (force === true) {
            const remove = [];

            formattet.forEach((listing) => {
                const match = this.findListing(listing.intent == 1 ? listing.id : listing.sku, listing.intent);
                if (match !== null) {
                    remove.push(match.id);
                }
            });

            this._action('remove', remove);
        }

        this._action('create', formattet);
    }

    createListing (listing, force = false) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = this._formatListing(listing);

        if (force === true) {
            const match = this.findListing(listing.intent == 1 ? listing.id : listing.sku, listing.intent);
            if (match !== null) {
                match.remove();
            }
        }

        if (formattet !== null) {
            this._action('create', formattet);
        }
    }

    removeListings (listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = listings.map((value) => !isObject(value) ? value : value.id);

        this._action('remove', formattet);
    }

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
            // TODO: Check if we are already making similar listings

            this.actions[type] = this.actions[type].concat(array);
            doneSomething = true;
        }

        if (doneSomething) {
            this.emit('actions', this.actions);

            this._startTimeout();
        }
    }

    _startTimers () {
        this._heartbeatInterval = setInterval(ListingManager.prototype._updateListings.bind(this, () => {}), 90000);
        this._inventoryInterval = setInterval(ListingManager.prototype.updateInventory.bind(this), 120000);
    }

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

    _startTimeout () {
        clearTimeout(this._timeout);
        this._timeout = setTimeout(ListingManager.prototype._processActions.bind(this), this.waitTime);
    }

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

    _processActions () {
        if (this._processingActions === true || (this.actions.remove.length === 0 && this.actions.create.length === 0)) {
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
        }, () => {
            if (this.actions.remove.length !== 0 || this.actions.create.length !== 0) {
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

    _create (callback) {
        if (this.actions.create.length === 0) {
            return callback(null);
        }

        const batch = this.actions.create.slice(0, this.batchSize);

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

            this.actions.create = this.actions.create.filter((listing) => {
                const index = batch.findIndex((v) => v.sku === listing.sku);

                if (index !== -1) {
                    batch.splice(index, 1);
                }

                return index === -1;
            });

            this.emit('actions', this.actions);

            for (const name in body.listings) {
                if (!body.listings.hasOwnProperty(name)) {
                    continue;
                }

                const listing = body.listings[name];
                if (listing.hasOwnProperty('error')) {
                    this.emit('error', 'create', name === '' ? null : name, listing.error);
                    if (listing.error == 6) {
                        this.emit('retry', name, listing.retry);
                    }
                } else if (listing.created !== undefined && !!listing.created) {
                    this.emit('created', name);
                }
            }

            return callback(null, body);
        });
    }

    _delete (callback) {
        if (this.actions.remove.length === 0) {
            return callback(null);
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
            this.emit('actions', this.actions);

            let errors = body.errors;

            remove.forEach((id) => {
                const index = errors.findIndex((error) => error.listing_id == id);

                if (index !== -1) {
                    const match = errors[index];
                    // Remove id from errors list
                    errors = errors.splice(index, 1);
                    this.emit('error', 'delete', match.listing_id, match.message);
                } else {
                    this.emit('removed', id);
                }
            });

            return callback(null, body);
        });
    }

    _formatListing (listing) {
        if (listing.intent == 0) {
            const item = this._formatItem(listing.sku);
            if (item === null) {
                return null;
            }
            listing.item = item;

            // Keep sku for later
        }

        return listing;
    }

    _formatItem (sku) {
        const item = TF2SKU.fromString(sku);

        const schemaItem = this.schema.getItemByDefindex(item.defindex);

        if (schemaItem === null) {
            return null;
        }

        const name = this.schema.getName({
            defindex: item.defindex,
            quality: item.quality,
            killstreak: item.killstreak,
            australium: item.australium
        }, false);

        const formattet = {
            item_name: name,
            quality: item.quality
        };

        if (!item.craftable) {
            formattet.craftable = 0;
        }

        if (item.effect !== null) {
            formattet.priceindex = item.effect;
        }

        return formattet;
    }
}

inherits(ListingManager, EventEmitter);

module.exports = ListingManager;
module.exports.Listing = Listing;

module.exports.EFailiureReason = EFailiureReason;

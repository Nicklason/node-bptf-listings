const async = require('async');
const SteamID = require('steamid');
const request = require('@nicklason/request-retry');
const TF2SKU = require('tf2-sku');
const isObject = require('isobject');

const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

const Listing = require('./classes/listing');

class ListingManager {
    constructor (options) {
        options = options || {};

        EventEmitter.call(this);

        this.token = options.token;
        this.steamid = new SteamID(options.steamid);

        this.waitTime = options.waitTime || 1000;
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

        async.series([
            (callback) => {
                this.sendHeartbeat(callback);
            },
            (callback) => {
                this.getListings(callback);
            }
        ], (err) => {
            if (err) {
                return callback(err);
            }

            // this._startUpdater();

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

        // TODO: Check if we are already making similar listings

        const formattet = listings.map((value) => this._formatListing(value)).filter((listing) => listing !== null);

        let doneSomething = formattet.length !== 0;

        if (force === true) {
            const remove = [];

            formattet.forEach((listing) => {
                const match = this.findListing(listing.intent == 1 ? listing.id : listing.sku);
                if (match !== null) {
                    remove.push(match.id);
                }
            });

            if (remove.length !== 0) {
                doneSomething = true;
                this.actions.remove = this.actions.remove.concat(remove);
            }
        }

        if (formattet.length !== 0) {
            this.actions.create = this.actions.create.concat(formattet);
        }

        if (doneSomething) {
            this.emit('actions', this.actions);
        }
    }

    createListing (listing, force = false) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        // TODO: Check if we are already making a similar listing

        const formattet = this._formatListing(listing);

        let doneSomething = formattet !== null;

        if (force === true) {
            const match = this.findListing(listing.intent == 1 ? listing.id : listing.sku);
            if (match !== null) {
                doneSomething = true;
                match.remove();
            }
        }

        if (formattet !== null) {
            this.actions.create.push(formattet);
        }

        if (doneSomething) {
            this.emit('actions', this.actions);
        }
    }

    removeListings (listings) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        const formattet = listings.map((value) => !isObject(value) ? value : value.id);

        if (formattet.length !== 0) {
            this.actions.remove = this.actions.remove.concat(formattet);
            this.emit('actions', this.actions);
        }
    }

    removeListing (listing) {
        if (!this.ready) {
            throw new Error('Module has not been successfully initialized');
        }

        if (!isObject(listing)) {
            this.actions.remove.push(listing);
        } else {
            this.actions.remove.push(listing.id);
        }

        this.emit('actions', this.actions);
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

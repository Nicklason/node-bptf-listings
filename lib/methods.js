'use strict';

const async = require('async');
const isObject = require('isobject');
const moment = require('moment');
const request = require('./webrequest.js');

const Listings = require('../index.js');

/**
 * Sends a heartbeat to backpack.tf
 * @param {function} [callback] Function to call when done
 */
Listings.prototype.sendHeartbeat = function (callback) {
    const self = this;
    self._apiCall('POST', { face: 'aux', method: 'heartbeat' }, 'v1', { automatic: 'all' }, function (err, result) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return;
        }

        self.emit('heartbeat', result.bumped);

        if (callback) {
            callback(null, result);
        }
    });
};

/**
 * Get your current listings
 * @param {function} [callback] Function to call when done
 */
Listings.prototype.getListings = function (callback) {
    const self = this;
    self._apiCall('GET', 'listings', 'v1', function (err, response) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return;
        }

        self.cap = response.cap;
        self.promotes = response.promotes_remaining;
        self.listings = response.listings;

        callback(null, self.listings);
    });
};

/**
 * Enqueue multiple listings to be created
 * @param {array} listings List of listings
 * @param {boolean} [force=false] Force the listings to be made
 */
Listings.prototype.createListings = function (listings, force = false) {
    if (listings.length === 0) {
        return;
    }

    // TODO: Check if already creating listing for same item

    for (let i = 0; i < listings.length; i++) {
        if (listings[i].intent == 0) {
            const listing = this._parseListing(listings[i]);
            if (listing == null) {
                continue;
            }

            listings[i] = listing;
        }
    }

    if (force == true) {
        let remove = [];
        for (let i = 0; i < listings.length; i++) {
            const listing = listings[i];
            const search = listing.intent == 1 ? listing.id : listing.item;
            const match = this._findListing(search, listing.intent);
            if (match != null && moment().unix() - match.created <= 1800) {
                remove.push(match.id);
            }
        }

        this.action('remove', remove, false);
    }

    this.action('create', listings);
};

/**
 * Enqueue a single listing to be created
 * @param {object} listing Listing object
 * @param {boolean} [force=false] Force the listing to be made
 */
Listings.prototype.createListing = function (listing, force=false) {
    if (!this.ready) {
        throw new Error('Initialize the module before doing anything');
    }

    // TODO: Check if already creating listing for same item

    listing = this._parseListing(listing);
    if (listing == null) {
        return;
    }

    if (force == true) {
        const search = listing.intent == 1 ? listing.id : listing.item;
        const match = this._findListing(search, listing.intent);
        if (match != null && moment().unix() - match.created <= 1800) {
            this.action('remove', match.id, false);
        }
    }

    this.action('create', listing);
};

/**
 * Enqueue multiple listings to be removed
 * @param {array} listings List of listings / listing ids
 */
Listings.prototype.removeListings = function (listings) {
    if (listings.length === 0) {
        return;
    }

    let remove = [];

    for (let i = listings.length; i--;) {
        const listing = listings[i];

        if (!isObject(listing)) {
            remove.push(listing);
        } else {
            const item = this._formatItem(listing.item);
            const match = this._findListing(item, listing.intent);
            if (match == null) {
                continue;
            }

            remove.push(match.id);
        }
    }

    this.action('remove', remove);
};

/**
 * Enqueue a single listing to be removed
 * @param {string|object} listing Id, or properties, of listing to remove
 * @example
 * // Using the id of the listing
 * removeListing('1234...');
 * // Using listing
 * removeListing({ intent: 0, item: { defindex: 5021, quality: 6 } });
 * // Using all properties
 * removeListing({ intent: 0, item: { defindex: 5021, quality: 6, craftable: true, killstreak: 0, australium: false, effect: null } });
 */
Listings.prototype.removeListing = function (listing) {
    if (!this.ready) {
        throw new Error('Please initialize before you do anything');
    }

    let remove;
    if (!isObject(listing)) {
        remove = listing;
    } else {
        const item = this._formatItem(listing.item);
        const match = this._findListing(item, listing.intent);
        if (match == null) {
            return;
        }

        remove = match.id;
    }

    this.action('remove', remove);
};

/**
 * Removes all listings and exposes callback
 * @param {function} [callback] Function to call when done
 */
Listings.prototype.removeAll = function (callback) {
    let ids = [];

    for (let i = 0; i < this.listings.length; i++) {
        const listing = this.listings[i];
        ids.push(listing.id);
    }

    this.removeListings(ids);

    if (callback !== undefined) {
        this._delete(callback);
    }
};

/**
 * Processes the current actions
 * @param {function} [callback] Function to call when done
 */
Listings.prototype.processActions = function (callback) {
    if (this.hasOwnProperty('processingActions')) {
        if (callback) {
            callback(null);
        }
        return;
    }

    this.processActions = true;

    const self = this;
    async.series([
        function (callback) {
            self._delete(callback);
        },
        function (callback) {
            self._create(callback);
        }
    ], function (err) {
        delete self.processActions;
        if (callback) {
            callback(err || null);
        }
    });
};

Listings.prototype._delete = function (callback) {
    if (this.actions.remove.length == 0) {
        return callback(null);
    }

    const self = this;
    self._apiCall('DELETE', 'delete', 'v1', { listing_ids: self.actions.remove }, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.deleted != 0) {
            self.actions.remove.forEach(function (id) {
                for (let i = self.listings.length; i--;) {
                    const listing = self.listings[i];
                    if (id == listing.id) {
                        self.listings.splice(i, 1);
                        break;
                    }
                }
            });
        }

        self.actions.remove.forEach(function (id) {
            let found = false;
            for (let i = 0; i < response.errors.length; i++) {
                const error = response.errors[i];
                if (error.listing_id == id) {
                    found = true;
                    self.emit('error', 'delete', error.listing_id, error.message);
                    break;
                }
            }

            if (!found) {
                self.emit('removed', id);
            }
        });

        // TODO: Don't clear the actions queue, but remove listings removed in the request
        self.actions.remove = [];
        self.emit('actions', self.actions.create, self.actions.remove);

        callback(null, response);
    });
};

Listings.prototype._create = function (callback) {
    if (this.actions.create.length == 0) {
        return callback(null);
    }

    const self = this;
    async.series({
        create: function (callback) {
            self._apiCall('POST', 'list', 'v1', { listings: self.actions.create }, callback);
        },
        get: function (callback) {
            self.getListings(callback);
        }
    }, function (err, response) {
        if (err) {
            return callback(err);
        }

        // TODO: Don't clear the actions queue, but remove listings made in the request
        self.actions.create = [];

        response = response.create;

        for (let name in response.listings) {
            if (!response.listings.hasOwnProperty(name)) {
                continue;
            }

            const listing = response.listings[name];
            if (listing.hasOwnProperty('error')) {
                self.emit('error', 'create', name, listing.error);
                if (listing.error == 6) {
                    self.emit('retry', name, listing.retry);
                }
            } else if (listing.hasOwnProperty('created') && !!listing.created) {
                self.emit('created', name);
            }
        }

        self.emit('actions', self.actions.create, self.actions.remove);

        callback(null, response);
    });
};

/**
 * Tries to update the inventory on backpack.tf
 * @param {function} [callback] Function to call when done
 */
Listings.prototype.updateInventory = function (callback) {
    const url = 'https://backpack.tf';
    const options = {
        uri: `${url}/_inventory/${this.steamid64}`,
        method: 'GET',
        gzip: true,
        json: true
    };

    const self = this;
    request(options, function (err, result) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return;
        }

        if (result.status.id == -1) {
            if (callback) {
                callback(new Error(result.status.text + ' (' + result.status.extra + ')'));
            }
            return;
        }

        // TODO: Retry updating the inventory if told so

        // TODO: Make sure that the inventory has actually updated (check when the inventory was last updated)

        self.emit('inventory', result.time.timestamp);

        if (callback) {
            callback(null);
        }
    });
};

module.exports = Listings;

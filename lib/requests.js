'use strict';

const helpers = require('./helpers.js');
const async = require('async');

const Listings = require('../index.js');

Listings.prototype._get = function (callback) {
    let self = this;
    self._apiCall('GET', 'listings', 'v1', function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        self.listings = response.listings;
        self.cap = response.cap;
        self.promotes = response.premotes_remaining;

        callback(null, response);
    });
};

Listings.prototype._create = function (callback) {
    if (this.actions.create.length == 0) {
        callback(null);
        return;
    }

    let self = this;
    self._apiCall('POST', 'list', 'v1', { listings: self.actions.create }, function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        self.actions.create = [];

        // Update the list of listings that we have.
        self.getListings();

        for (let name in response.listings) {
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

Listings.prototype._delete = function (ids, callback) {
    if (callback == undefined) {
        callback = ids;
        ids = [];
    }

    this.actions.remove = this.actions.remove.concat(ids);
    
    if (this.actions.remove.length == 0) {
        callback(null);
        return;
    }

    let self = this;
    self._apiCall('DELETE', 'delete', 'v1', { listing_ids: self.actions.remove },  function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        // Remove listing ids from our listings array.
        if (response.deleted != 0) {
            self.actions.remove.forEach(function (id) {
                for (let i = 0; i < self.listings.length; i++) {
                    const listing = self.listings[i];
                    if (id == listing.id) {
                        self.listings.splice(i, 1);
                        break;
                    }
                }
            });
        }

        // Check for errors and 
        self.actions.remove.forEach(function(id) {
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

        self.actions.remove = [];

        self.emit('actions', self.actions.create, self.actions.remove);

        callback(null, response);
    });
};

Listings.prototype._heartbeat = function(callback) {
    let self = this;
    self._apiCall('POST', { face: 'aux', method: 'heartbeat' }, 'v1', { automatic: 'all' }, function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        self.emit('heartbeat', response.bumped);
        
        callback(null, response);
    });
};

Listings.prototype._action = function(actions, callback) {
    let self = this;
    async.series([
        function (callback) {
            self._delete(callback);
        },
        function (callback) {
            self._create(callback);
        }
    ], callback);
};

Listings.prototype._inventory = function(callback) {
    const options = {
        url: `https://backpack.tf/_inventory/${this.steamid64}`,
        method: 'GET',
        gzip: true,
        json: true,
        timeout: 20 * 1000
    };

    let self = this;
    self.httpRequest(options, function(err, response, body) {
        if (err) {
            callback(err);
            return;
        }

        if (body.status.id == -1) {
            callback(new Error(body.status.text + ' (' + body.status.extra + ')'));
            return;
        }

        const sinceUpdate = helpers.time() - body.time.timestamp;
        const timeout = 2 * 60;

        // Check if we should wait to update the inventory.
        if (sinceUpdate < timeout) {
            const wait = timeout - sinceUpdate;
            err = new Error('Can\'t update inventory as we have to wait');
            err.retryAfter = wait * 1000;
            callback(err);
            return;
        }

        self.emit('inventory', body.time.timestamp);
        callback(null);
    });
};
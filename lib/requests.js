'use strict';

var Listings = require('../index.js');

Listings.prototype._get = function (callback) {
    var self = this;
    self._apiCall("GET", "listings", "v1", function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        self.listings = response.listings;
        self.cap = response.cap;

        callback(null, response);
    });
};

Listings.prototype._create = function (listings, callback) {
    var self = this;
    self._apiCall("POST", "list", "v1", { listings: listings }, function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        self._create = [];

        // Update the list of listings that we have.
        self.getListings();

        for (var name in response.listings) {
            var listing = response.listings[name];
            if (listing.hasOwnProperty('error')) {
                self.emit('error', name, listing.error);
                if (listing.error == 6) {
                    self.emit('retry', name, listing.retry);
                }
            } else if (listing.hasOwnProperty('created') && !!listing.created) {
                self.emit('created', name);
            }
        }

        callback(null, response);
    });
};

Listings.prototype._delete = function (ids, callback) {
    var self = this;
    self._apiCall("DELETE", "delete", "v1", { listing_ids: ids },  function (err, response) {
        if (err) {
            callback(err);
            return;
        }

        // Remove listing ids from our listings array.
        ids.forEach(function(id) {
            for (var i = 0; i < self.listings.length; i++) {
                var listing = self.listings[i];
                if (id == listing.id) {
                    self.listings.splice(i, 1);
                    break;
                }
            }
        });

        if (response.deleted != 0) {
            ids.forEach(function(id) {
                var found = false;
                for (var i = 0; i < response.errors.length; i++) {
                    var error = response.errors[i];
                    if (error.listing_id == id) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    self.emit('removed', id);
                }
            });
        }

        callback(null, response);
    });
};
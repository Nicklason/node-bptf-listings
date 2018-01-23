'use strict';

var Listings = require('../index.js');

Listings.prototype._get = function (callback) {
    this._apiCall("GET", "listings", "v1", function (err, response) {
        if (err) {
            callback(err);
            return;
        }

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

        callback(null, response);
    });
};
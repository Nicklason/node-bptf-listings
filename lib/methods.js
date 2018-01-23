'use strict';

var Listings = require('../index.js');

Listings.prototype.getListings = function (callback) {
    this._retry(Listings.prototype._get.bind(this), callback);
};

Listings.prototype.createListings = function (listings, callback) {
    this._retry(Listings.prototype._create.bind(this, listings), callback);
};

Listings.prototype.removeListings = function (ids, callback) {
    this._retry(Listings.prototype._delete.bind(this, ids), callback);
};

Listings.prototype._retry = function (method, callback, attempts = 0) {
    var self = this;
    method(function (err, response) {
        attempts++;
        if (err && attempts < 3 && validReasonToRetry(err)) {
            setTimeout(Listings.prototype._retry.bind(self, method, callback, attempts), err.retryAfter || self.retryTime);
        } else if (callback) {
            callback(err, response);
        }
    });
};

function validReasonToRetry(err) {
    if (err.hasOwnProperty('code') && (err.code == 429 || err.code == 500)) {
        return true;
    }
    return false;
}
'use strict';

var Listings = require('../index.js');

Listings.prototype.getListings = function (callback) {
    this._retry(Listings.prototype._get.bind(this), callback);
};

Listings.prototype.createListings = function (listings) {
    clearTimeout(this._createTimer);
    if (!this.hasOwnProperty('_create')) {
        this._create = [];
    }

    this._create = this._create.concat(listings);
    this.emit('action', 1, this._create);
    this._createTimer = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._create.bind(this, this._create)), this.createWait);
};

Listings.prototype.removeListings = function (ids) {
    clearTimeout(this._removeTimer);

    if (!this.hasOwnProperty('_remove')) {
        this._remove = [];
    }

    this._remove = this._remove.concat(ids);
    this.emit('action', 2, this._remove);
    this._removeTimer = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._delete.bind(this, this._remove)), this.removeWait);
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
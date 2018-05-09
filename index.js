'use strict';

var request = require('request');
var items = require('tf2-items');

module.exports = Listings;

require('util').inherits(Listings, require('events').EventEmitter);

function Listings(options) {
    options = options || {};

    this.token = options.token;
    this.steamid64 = options.steamid64;
    this.retry = options.retry || true;
    this.retryTime = options.retryTime || 2 * 1000;

    this.waitTime = options.waitTime || 1 * 1000;

    this.cap = -1;
    this.listings = [];
    this.promotes = -1;

    this.actions = {
        remove: [],
        create: []
    };

    this.request = request;
    this.items = options.items || new items({ apiKey: options.key });

    this.ready = false;
}

Listings.prototype.init = function(callback) {
    if (!this.steamid64 || this.steamid64.length != 17) {
        callback(new Error("Either missing, or the given steamid64 is not valid"));
        return;
    }

    var self = this;
    self.items.init(function(err) {
        if (err) {
            callback(err);
            return;
        }

        self.getListings(function (err) {
            if (err) {
                callback(err);
                return;
            }

            self.sendHeartbeat();
            self._heartbeatTimer = setInterval(Listings.prototype.sendHeartbeat.bind(self), 90 * 1000);
            self.updateInventory();
            self._inventoryTimer = setInterval(Listings.prototype.updateInventory.bind(self), 2 * 60 * 1000);

            self.ready = true;
            callback(null);
        });
    });
};

require('./lib/http.js');
require('./lib/webapi.js');
require('./lib/requests.js');
require('./lib/methods.js');
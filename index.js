'use strict';

var request = require('request');
var items = require('tf2-items');

module.exports = Listings;

require('util').inherits(Listings, require('events').EventEmitter);

function Listings(options) {
    options = options || {};

    this.token = options.token;
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
    this.items = new items({ apiKey: options.key });

    this.ready = false;
}

Listings.prototype.init = function(callback) {
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
            self._timer = setInterval(Listings.prototype.sendHeartbeat.bind(self), 90 * 1000);

            self.ready = true;
            callback(null);
        });
    });
};

require('./lib/http.js');
require('./lib/webapi.js');
require('./lib/requests.js');
require('./lib/methods.js');
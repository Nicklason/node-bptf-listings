'use strict';

const request = require('request');

module.exports = Listings;

require('util').inherits(Listings, require('events').EventEmitter);

function Listings(options) {
    options = options || {};

    this.apiToken = options.apiToken;
    this.retry = options.retry || true;
    this.retryTime = options.retryTime || 2 * 1000;

    this.listings = [];

    this.request = request;
}

Listings.prototype.init = function(callback) {
    var self = this;

};

require('./lib/http.js');
require('./lib/webapi.js');
require('./lib/requests.js');
require('./lib/methods.js');
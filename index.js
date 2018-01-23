'use strict';

const request = require('request');

module.exports = Listings;

require('util').inherits(Listings, require('events').EventEmitter);

function Listings(options) {
    options = options || {};

    this.apiToken = options.apiToken;
    this.retry = options.retry || true;
    this.retryTime = options.retryTime || 2 * 1000;
    
    this.removeWait = options.removeWait || 1 * 1000;
    this.createWait = options.createWait || 1 * 1000;

    this.cap = -1;
    this.listings = [];

    this.request = request;
}

require('./lib/http.js');
require('./lib/webapi.js');
require('./lib/requests.js');
require('./lib/methods.js');
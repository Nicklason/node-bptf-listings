'use strict';

/**
 * Creates a new instance of bptf-listings
 * @class
 * @param {object} options Optional settings
 */
function Listings (options) {
    options = options || {};

    this.token = options.token;
    this.steamid64 = options.steamid64;
    this.waitTime = options.waitTime || 0;

    this.cap = -1;
    this.promotes = -1;
    this.listings = [];

    this.actions = {
        create: [],
        remove: []
    };

    this.ready = false;
}

module.exports = Listings;

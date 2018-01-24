'use strict';

var Listings = require('../index.js');

Listings.prototype._apiCall = function (httpMethod, method, version, input, callback) {
    if (typeof input == 'function') {
        callback = input;
        input = null;
    }

    if (!this.token) {
        callback(new Error("No API-Token set (yet)"));
        return;
    }

    var face = 'classifieds';

    var options = {
        "uri": `https://backpack.tf/api/${face}/${method}/${version}`,
        "json": true,
        "method": httpMethod,
        "gzip": true,
        "timeout": 10000,
        "qs": {
            "token": this.token
        }
    };

    input = input || {};
    if (httpMethod != 'GET') {
        options['body'] = input;
    }

    this.httpRequest(options, function (err, response, body) {
        if (err) {
            callback(err);
            return;
        }

        if (!body || typeof body != 'object') {
            callback(new Error('Invalid API response'));
            return;
        }

        callback(null, body);
    });
};
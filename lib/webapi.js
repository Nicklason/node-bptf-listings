'use strict';

const request = require('./webrequest.js');

const Listings = require('../index.js');

/**
 * Sends a request to the Steam api
 * @param {string} httpMethod Request method
 * @param {object} method API method or an object with the face and method
 * @param {string} version Version of API method
 * @param {object} [input] Query string or body to send in the request
 * @param {function} callback Function to call when done
 */
Listings.prototype._apiCall = function (httpMethod, method, version, input, callback) {
    if (callback == undefined) {
        callback = input;
        input = {};
    }

    if (!this.accessToken) {
        callback(new Error('No access token set (yet)'));
        return;
    }

    let face = 'classifieds';
    if (typeof method == 'object') {
        face = method.face;
        method = method.method;
    }

    const url = 'https://backpack.tf/api';

    let options = {
        uri: `${url}/${face}/${method}/${version}`,
        method: httpMethod,
        qs: {
            token: this.accessToken
        },
        json: true,
        gzip: true
    };

    input = input || {};
    if (httpMethod != 'GET') {
        options['body'] = input;
    }

    request(options, callback);
};

module.exports = Listings;

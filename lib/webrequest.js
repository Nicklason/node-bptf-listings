'use strict';

const requestRetry = require('requestretry').defaults({
    json: true,
    gzip: true,
    timeout: 10000
});

/**
 * Sends a request to the Steam api
 * @param {object} options Request options
 * @param {function} callback Function to call when done
 */
function WebRequest (options, callback) {
    requestRetry(options, function (err, response, body) {
        if (err) {
            return callback(err);
        }

        if (!body || typeof body != 'object') {
            err = new Error('Invalid response');
            err.body = body;
            callback(err);
            return;
        }

        callback(null, body);
    });
}

module.exports = WebRequest;

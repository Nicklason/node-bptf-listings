'use strict';

const request = require('@nicklason/api-request');

/**
 * Sends a request to the Steam api
 * @param {object} options Request options
 * @param {function} callback Function to call when done
 */
function WebRequest (options, callback) {
    request(options, function (err, response, body) {
        if (err) {
            return callback(err);
        }

        callback(null, body);
    });
}

module.exports = WebRequest;

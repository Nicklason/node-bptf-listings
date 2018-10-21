'use strict';

const async = require('async');
const SteamID = require('steamid');
const Items = require('tf2-items');

const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

module.exports = Listings;

Listings.EFailureReason = require('./resources/EFailureReason.js');

/**
 * Creates a new instance of bptf-listings
 * @class
 * @param {object} options Optional settings
 */
function Listings (options) {
    options = options || {};

    EventEmitter.call(this);

    this.accessToken = options.accessToken;
    this.steamid64 = options.steamid64;

    this.waitTime = options.waitTime || 1000;

    this.cap = -1;
    this.promotes = -1;
    this.listings = [];

    this.actions = {
        create: [],
        remove: []
    };

    this.items = options.items || new Items({ apiKey: options.apiKey });

    this.ready = false;
}

inherits(Listings, EventEmitter);

Listings.prototype.init = function (callback) {
    const steamid = new SteamID(this.steamid64);
    if (!steamid.isValid()) {
        if (callback) {
            callback(new Error('Invalid / missing steamid64'));
        }
        return;
    }

    const self = this;
    async.series([
        function (callback) {
            self.items.init(callback);
        },
        function (callback) {
            self.sendHeartbeat(callback);
        },
        function (callback) {
            self.getListings(callback);
        }
    ], function (err) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return;
        }

        self.ready = true;
        self.startTimers();

        if (callback) {
            callback(null);
        }
    });
};

Listings.prototype.wait = function () {
    clearTimeout(this.waitTimer);
    this.waitTimer = setTimeout(Listings.prototype.processActions.bind(this), this.waitTime);
};

Listings.prototype.action = function (type, action, wait=true) {
    const prevLength = this.actions[type].length;

    if (Array.isArray(action)) {
        if (type == 'remove') {
            for (let i = action.length; i--;) {
                const match = this.actions[type].some((id) => id == action[i]);
                if (match) {
                    action.splice(i, 1);
                }
            }
        }

        this.actions[type] = this.actions[type].concat(action);
    } else {
        if (type == 'remove') {
            const match = this.actions[type].some((id) => id == action);
            if (match) {
                return;
            }
        }

        this.actions[type].push(action);
    }

    const doneSomething = prevLength !== this.actions[type].length;
    if (doneSomething) {
        this.emit('actions', this.actions.create, this.actions.remove);

        if (wait) {
            this.wait();
        }
    }
};

Listings.prototype.startTimers = function () {
    this.heartbeatTimer = setInterval(Listings.prototype.sendHeartbeat.bind(this), 90000);
    this.inventoryTimer = setInterval(Listings.prototype.updateInventory.bind(this), 120000);
};

Listings.prototype.stopTimers = function () {
    clearInterval(this.heartbeatTimer);
    delete this.heartbeatTimer;
    clearInterval(this.inventoryTimer);
    delete this.inventoryTimer;
    clearInterval(this.actionsTimer);
    delete this.actionsTimer;
};

require('./lib/helpers.js');
require('./lib/webapi.js');
require('./lib/methods.js');

'use strict';

var Helpers = require('./helpers.js');

var Listings = require('../index.js');

Listings.prototype.getListings = function (callback) {
    this._retry(Listings.prototype._get.bind(this), callback);
};

Listings.prototype.createListings = function (listings, update = false) {
    if (!this.ready) {
        throw new Error("Please initialize before you do anything");
        return;
    }

    clearTimeout(this._wait);

    for (var i = 0; i < listings.length; i++) {
        if (listings[i].intent == 0) {
            var listing = this._parseListing(listings[i]);
            if (listing == null) {
                continue;
            }

            listings[i] = listing;
        } 
    }

    if (update == true) {
        for (var i = 0; i < listings.length; i++) {
            var listing = listings[i];
            var found = this._findListing(listing.intent == 1 ? listing.id : listing.item, listing.intent);
            if (found != null && Helpers.epoch() - found.created < 30 * 60) {
                this.actions.remove.push(found.id);
            }
        }
    }

    this.actions.create = this.actions.create.concat(listings);
    this.emit('actions', this.actions.create, this.actions.remove);
    this._wait = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._action.bind(this, this.actions)), this.waitTime);
};

Listings.prototype.createListing = function (listing, update = false) {
    if (!this.ready) {
        throw new Error("Please initialize before you do anything");
        return;
    }

    listing = this._parseListing(listing);
    if (listing == null) {
        return;
    }

    clearTimeout(this._wait);

    if (update == true) {
        var found = this._findListing(listing.intent == 1 ? listing.id : listing.item, listing.intent);
        if (found != null && Helpers.epoch() - found.bump < 30 * 60) {
            this.actions.remove.push(found.id);
        }
    }

    this.actions.create.push(listing);
    this.emit('actions', this.actions.create, this.actions.remove);
    this._wait = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._action.bind(this, this.actions)), this.waitTime);
};

Listings.prototype._parseListing = function(listing) {
    if (listing.intent == 0) {
        var item = this._parse(listing.item);
        if (item == null) {
            return null;
        }
        listing.item = item;
    }

    return listing;
};

// Get item from listing.
Listings.prototype._getItem = function (item) {
    var parse = {
        defindex: item.defindex,
        quality: item.quality,
        craftable: !(item.hasOwnProperty('flag_cannot_craft') && item["flag_cannot_craft"] == true),
        killstreak: 0,
        australium: false
    };

    if (item.hasOwnProperty('attributes')) {
        for (var i = 0; i < item.attributes.length; i++) {
            var attribute = item.attributes[i];
            if (attribute.defindex == 2025) {
                parse.killstreak = attribute.float_value;
            } else if (attribute.defindex == 2027) {
                parse.australium = true;
            }
        }
    }

    parse = this._parse(parse);

    return parse;
};

Listings.prototype._findListing = function (search, intent) {
    for (var i = 0; i < this.listings.length; i++) {
        var listing = this.listings[i];
        if (intent == 1 && listing.item.id == search) {
            return listing;
        } else if (intent == 0) {
            var item = this._getItem(listing.item);
            if (item.item_name == search.item_name && item.quality == search.quality && item.craftable == search.craftable) {
                return listing;
            }
        }
    }

    return null;
};

Listings.prototype._parse = function (item) {
    var schema = this.items.schema.getItem(item.defindex);
    if (schema == null) {
        this.emit('error', item.defindex || '', 'Not a valid / missing defindex');
        return null;
    }

    var quality = this.items.schema.getQuality(item.quality);

    item = {
        defindex: item.defindex,
        quality: quality == null ? 6 : item.quality,
        craftable: typeof (item.craftable) === 'boolean' ? item.craftable : true,
        killstreak: item.killstreak || 0,
        australium: item.australium || false
    };

    var name = this.items.schema.getDisplayName(item);
    if (name.startsWith('The ')) {
        name = name.substring(4);
    }
    if (item.quality != 6) {
        name = name.replace(quality + ' ', '');
    }
    if (item.craftable == false) {
        name = name.replace('Non-Craftable ', '');
    }

    var parse = {
        item_name: name,
        quality: item.quality,
        craftable: item.craftable == true ? 1 : 0
    };

    return parse;
};

Listings.prototype.removeListings = function (ids) {
    if (!this.ready) {
        throw new Error("Please initialize before you do anything");
        return;
    }

    clearTimeout(this._wait);

    this.actions.remove = this.actions.remove.concat(ids);
    this.emit('actions', this.actions.create, this.actions.remove);
    this._wait = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._action.bind(this, this.actions)), this.waitTime);
};

Listings.prototype.removeListing = function (id) {
    if (!this.ready) {
        throw new Error("Please initialize before you do anything");
        return;
    }
    
    clearTimeout(this._wait);

    this.actions.remove.push(id);
    this.emit('actions', this.actions.create, this.actions.remove);
    this._wait = setTimeout(Listings.prototype._retry.bind(this, Listings.prototype._action.bind(this, this.actions)), this.waitTime);
};

Listings.prototype.sendHeartbeat = function () {
    this._retry(Listings.prototype._heartbeat.bind(this));
};

Listings.prototype._retry = function (method, callback, attempts = 0) {
    var self = this;
    method(function (err, response) {
        attempts++;
        if (self.retry == true && err && attempts < 3 && validReasonToRetry(err)) {
            setTimeout(Listings.prototype._retry.bind(self, method, callback, attempts), err.retryAfter || self.retryTime);
        } else if (callback) {
            callback(err, response);
        }
    });
};

function validReasonToRetry(err) {
    if (err.hasOwnProperty('code') && (err.code == 429 || err.code == 500)) {
        return true;
    }
    return false;
}
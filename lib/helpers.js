'use strict';

const deepEqual = require('fast-deep-equal');
const Currencies = require('tf2-currencies');

const Listings = require('../index.js');

/**
 * Parses the item when the intent is 0 (buying)
 * @param {object} listing
 * @return {object} listing
 * @private
 */
Listings.prototype._parseListing = function (listing) {
    if (listing.intent == 0) {
        const item = this._parseItem(listing.item);
        if (item == null) {
            return null;
        }
        listing.item = item;
    }

    if (listing.currencies) {
        listing.currencies = new Currencies(listing.currencies);
    }

    return listing;
};

/**
 * Parses an item into the proper format
 * @param {object} item Item to parse
 * @return {object} Parsed item
 * @private
 */
Listings.prototype._parseItem = function (item) {
    let parse = this._getItem(item);
    const parsed = this._formatItem(parse);
    return parsed;
};

Listings.prototype._formatItem = function (item) {
    const schema = this.items.schema.getItem(item.defindex);
    if (schema == null) {
        return null;
    }

    let name = this.items.schema.getName(item);

    // Removing "The" from the name of the item because bptf uses the item_name without checking proper_name.
    if (name.startsWith('The ') && schema.proper_name == true) {
        name = name.substring(4);
    }
    if (item.quality != 6) {
        const quality = this.items.schema.getQuality(item.quality);
        name = name.replace(quality + ' ', '');
    }
    if (item.craftable == false) {
        name = name.replace('Non-Craftable ', '');
    }

    let parsed = {
        item_name: name,
        quality: item.quality
    };

    if (item.craftable == false) {
        parsed.craftable = 0;
    }

    if (item.effect != null) {
        parsed.priceindex = item.effect;
    }

    return parsed;
};

/**
 * Parses an item from a listing to a format acceptable by node-tf2-items
 * @param {object} parse Item to parse
 * @return {object} Item
 * @private
 */
Listings.prototype._getItem = function (parse) {
    let item = {
        defindex: parse.defindex,
        quality: parse.quality,
        craftable: parse.flag_cannot_craft != true,
        killstreak: 0,
        australium: false,
        effect: null
    };

    if (parse.hasOwnProperty('attributes')) {
        for (let i = 0; i < item.attributes.length; i++) {
            const attribute = item.attributes[i];
            if (attribute.defindex == 2025) {
                item.killstreak = attribute.float_value;
            } else if (attribute.defindex == 2027) {
                item.australium = true;
            } else if (attribute.defindex == 134) {
                item.effect = attribute.float_value;
            }
        }
    }

    return item;
};

/**
 * Finds a listing that matches the search
 * @param {object|number} search Item object or assetid
 * @param {number} intent Intent of the listing (0=buy, 1=sell)
 * @return {object|null} Returns the match, otherwise null
 * @private
 */
Listings.prototype._findListing = function (search, intent) {
    for (let i = 0; i < this.listings.length; i++) {
        const listing = this.listings[i];

        if (listing.intent == intent) {
            // Searching for a sell listing
            if (listing.intent == 1 && listing.item.id == search) {
                return listing;
            } else if (listing.intent == 0) {
                const item = this._parseItem(listing.item);
                if (deepEqual(item, search)) {
                    return listing;
                }
            }
        }
    }

    return null;
};

module.exports = Listings;

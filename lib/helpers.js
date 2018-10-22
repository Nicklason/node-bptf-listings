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
        const item = this._formatItem(listing.item);
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
 * Parses an item from a listing into the proper format
 * @param {object} parse Item to parse
 * @return {object} Parsed item
 * @private
 */
Listings.prototype._parseItem = function (parse) {
    const item = this._getItem(parse);
    const parsed = this._formatItem(item);
    return parsed;
};

Listings.prototype._formatItem = function (item) {
    const defindex = item.defindex;
    const quality = item.hasOwnProperty('quality') ? item.quality : 6;
    const craftable = item.hasOwnProperty('craftable') ? item.craftable : true;
    const killstreak = item.hasOwnProperty('killstreak') ? item.killstreak : 0;
    const australium = item.hasOwnProperty('australium') ? item.australium : false;
    const effect = item.hasOwnProperty('effect') ? item.effect : null;

    const schema = this.items.schema.getItem(defindex);
    if (schema == null) {
        return null;
    }

    const placeholder = {
        defindex: defindex,
        quality: 6,
        craftable: true,
        killstreak: killstreak,
        australium: australium,
        effect: null
    };

    // Removing "The" from the name of the item because bptf uses the item_name without checking proper_name.
    const name = this.items.schema.getName(placeholder, false);

    let parsed = {
        item_name: name,
        quality: quality
    };

    if (craftable == false) {
        parsed.craftable = 0;
    }
    if (effect != null) {
        parsed.priceindex = effect;
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
        for (let i = 0; i < parse.attributes.length; i++) {
            const attribute = parse.attributes[i];
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

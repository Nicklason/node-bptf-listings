const SteamID = require('steamid');
const Currencies = require('tf2-currencies');
const moment = require('moment');
const SKU = require('tf2-sku');

// TODO: Add functions for removing / updating this listing

class Listing {
    constructor (listing, manager) {
        this.id = listing.id;
        this.steamid = new SteamID(listing.steamid);
        this.intent = listing.intent;
        this.item = listing.item;
        this.appid = listing.appid;
        this.currencies = new Currencies(listing.currencies);
        this.offers = listing.offers === 1;
        this.buyout = listing.buyout === 1;
        this.details = listing.details;
        this.created = moment.unix(listing.created);
        this.bump = moment.unix(listing.bump);

        this._manager = manager;
    }

    getSKU () {
        if (this.appid !== 440) {
            return null;
        }

        return SKU.fromObject(this.getItem());
    }

    getItem () {
        if (this.appid !== 440) {
            return this.item;
        }

        const item = {
            defindex: this.item.defindex,
            quality: this.item.quality,
            craftable: this.item.flag_cannot_craft !== true
        };

        const attributes = this._parseAttributes();

        for (const attribute in attributes) {
            if (!attributes.hasOwnProperty(attribute)) {
                continue;
            }

            item[attribute] = attributes[attribute];
        }

        // TODO: Have the item go through a "fix item" function (maybe not needed?)

        // Adds default values
        return SKU.fromString(SKU.fromObject(item));
    }

    getName () {
        if (this.appid !== 440) {
            return null;
        }

        return this._manager.schema.getName(this.getItem());
    }

    update (properties) {
        const listing = {
            sku: this.getSKU(),
            intent: this.intent
        };

        ['currencies', 'details', 'offers', 'buyout'].forEach((property) => {
            if (properties[property] === undefined) {
                listing[property] = this[property];
            } else {
                listing[property] = properties[property];
            }
        });

        this._manager.createListing(listing, true);
    }

    remove () {
        this._manager.removeListing(this.id);
    }

    _parseAttributes () {
        const attributes = {};

        if (this.item.attributes === undefined) {
            return attributes;
        }

        for (let i = 0; i < this.item.attributes.length; i++) {
            const attribute = this.item.attributes[i];
            if (attribute.defindex == 2025) {
                attributes.killstreak = attribute.float_value;
            } else if (attribute.defindex == 2027) {
                attributes.australium = true;
            } else if (attribute.defindex == 134) {
                attributes.effect = attribute.float_value;
            } else if (attribute.defindex == 834) {
                attributes.paintkit = attribute.value;
            } else if (attribute.defindex == 725) {
                attributes.wear = parseFloat(attribute.value) * 5;
            }
        }

        return attributes;
    }
}

module.exports = Listing;

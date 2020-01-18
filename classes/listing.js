const SteamID = require('steamid');
const Currencies = require('tf2-currencies');
const moment = require('moment');
const SKU = require('tf2-sku');

class Listing {
    /**
     * Creates a new instance of the listing class
     * @param {Object} listing A backpack.tf listing object
     * @param {String} listing.id
     * @param {Number} listing.intent
     * @param {Object} listing.item
     * @param {Number} listing.appid
     * @param {Object} listing.currencies
     * @param {Number} listing.offers
     * @param {Number} listing.buyout
     * @param {String} listing.details
     * @param {Number} listing.created
     * @param {Number} listing.bump
     * @param {Object} manager Instance of bptf-listings
     */
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

    /**
     * Gets the sku of the item in the listing
     * @return {String}
     */
    getSKU () {
        if (this.appid !== 440) {
            return null;
        }

        return SKU.fromObject(this.getItem());
    }

    /**
     * Returns the item in the listings
     * @return {Object}
     */
    getItem () {
        if (this.appid !== 440) {
            return this.item;
        }

        const item = {
            defindex: this.item.defindex,
            quality: this.item.quality,
            craftable: this.item.flag_cannot_craft !== true
        };

        // Backpack.tf uses item_name for when making listings, meaning that the defindex in some cases is incorrect

        const schemaItem = this._manager.schema.getItemByDefindex(item.defindex);
        const schemaItemByName = this._manager.schema.raw.schema.items.find((v) => v.name === schemaItem.item_name);

        if (schemaItemByName !== undefined) {
            item.defindex = schemaItemByName.defindex;
        }

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

    /**
     * Returns the name of the item in the listing
     * @return {String}
     */
    getName () {
        if (this.appid !== 440) {
            return null;
        }

        return this._manager.schema.getName(this.getItem());
    }

    /**
     * Changes specific properties and adds the job to the queue
     * @param {Object} properties
     * @param {Object} [properties.currencies]
     * @param {String} [properties.details]
     * @param {Boolean} [properties.offers]
     * @param {Boolean} [properties.buyout]
     */
    update (properties) {
        if (properties.time === undefined) {
            return;
        }

        const listing = {
            time: properties.time,
            intent: this.intent
        };

        if (this.intent === 0) {
            listing.sku = this.getSKU();
        } else {
            listing.id = this.item.id;
        }

        ['currencies', 'details', 'offers', 'buyout'].forEach((property) => {
            if (properties[property] === undefined) {
                listing[property] = this[property];
            } else {
                listing[property] = properties[property];
            }
        });

        this._manager.createListing(listing, true);
    }

    /**
     * Enqueues the listing to be removed
     */
    remove () {
        this._manager.removeListing(this.id);
    }

    /**
     * Parses attributes
     * @return {Object}
     */
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
                attributes.wear = parseInt(parseFloat(attribute.value) * 5);
            } else if (attribute.defindex == 214) {
                attributes.quality2 = 11;
            }
        }

        return attributes;
    }
}

module.exports = Listing;

const TF2Currencies = require('tf2-currencies');

// Search for a buy order for a Mann Co. Supply Crate Key
const match = listingManager.findListing('5021;6', 0, true);

if (match !== null) {
    const newPrice = new TF2Currencies({
        keys: 0,
        metal: 52
    });

    listing.update({
        details: 'I am buying one ' + listing.getName() + ' for ' + newPrice.toString(),
        currencies: newPrice
    });
}

// Search for all listings of a specific item
listingManager.findListings('5021;6').forEach(function (listing) {
    if (listing.intent === 0) {
        // Update buy price
    } else if (listing.intent === 1) {
        // Update sell price
    }
});

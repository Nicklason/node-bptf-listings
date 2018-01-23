var Listings = require('../index.js');

var options = {
    "apiToken": ""
};

var listings = new Listings(options);

// Get your listings
listings.getListings(function(err, response) {
    if (err) {
        // Something went wrong while doing the request
        console.log(err);
        return;
    }

    console.log(response);
});

var id = "440_76561198120070906_123456789";
// Remove a listing using the id.
listings.removeListings([ id ], function(err, response) {
    if (err) {
        console.log(err);
        return;
    }

    console.log(response);
});

var listing = {
    intent: 0,
    item: {
        item_name: 378,
        quality: 6
    },
    currencies: {
        keys: 0,
        metal: 3.33
    }
};

// Create a listing for a Unique Team Captain, buying for 3.33 refined.
listings.createListings([ listing ], function (err, response) {
    if (err) {
        console.log(err);
        return;
    }

    console.log(response);
});

var Listings = require('../index.js');

var options = {
    "token": "", // bptf api token
    "key": "" // steam api key
};

var listings = new Listings(options);

// You have to run this function and get no errors in the callback function in order for the module to work properly.
listings.init(function (err) {
    if (err) {
        console.log(err);
        return;
    }

    // Create listings and force them to update if one was already made
    listings.createListings([{
        intent: 1,
        id: 6177771131,
        currencies: {
            keys: 0,
            metal: 20
        }
    }, {
        intent: 0,
        item: {
            defindex: 5050,
            craftable: false,
        },
        currencies: {
            keys: 0,
            metal: 8
        }
    }, {
        intent: 0,
        item: {
            defindex: 5021,
            quality: 6,
            craftable: true,
            killstreak: 0,
            australium: false
        },
        currencies: {
            keys: 0,
            metal: 21
        },
        details: "Hello!"
    }], true);
});

// Event for when a heartbeat has been successfully sent.
listings.on('bumped', function(count) {
    console.log("Bumped " + count + " " + (count == 1 ? 'listing' : 'listings'));
});

// Event for when a listing has been removed.
listings.on('removed', function (removed) {
    console.log("Removed a listing with the id " + removed);
});

// When bptf says that you have to wait before trying to relist an item, this will also be cought by the error event.
listings.on('retry', function (name, time) {
    console.log("Could not create a listing for " + name + ". You should try again at " + time);
});

// Event for when bptf returns an error when trying to make a listing (does not include when removing).
listings.on('error', function (type, name, error) {
    console.log("An error occurred while trying to " + type + " a listing (" + name + "): " + error);
});

// Event for when a listing has been created.
listings.on('created', function (name) {
    console.log("Created a listing for " + name);
});

// Event for when we the actions list updates
listings.on('actions', function (create, remove) {
    console.log("Create " + create.length + " - Remove " + remove.length);
});

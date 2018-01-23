var Listings = require('../index.js');

var options = {
    "apiToken": ""
};

var listings = new Listings(options);

// Create listings, see bptf's documentation.
listings.createListings([{
    intent: 0,
    item: {
        item_name: 378,
        quality: 11
    },
    currencies: {
        keys: 0,
        metal: 3.33
    }
}, {
    intent: 1,
    id: 123456,
    currencies: {
        keys: 0,
        metal: 10
    }
}, {
    intent: 1,
    id: 5868049119
}]);

// Event for when a listing has been removed.
listings.on('removed', function(removed) {
    console.log("Removed a listing with the id " + removed);
});

// When bptf says that you have to wait before trying to relist an item, this will also be cought by the error event.
listings.on('retry', function(name, time) {
    console.log("Could not create a listing for " + name + ". You should try again at " + time);
});

// Event for when bptf returns an error when trying to make a listing (does not include when removing).
listings.on('error', function(name, error) {
    console.log("An error occurred while trying to make a listing for " + name + ": " + error);
});

// Event for when a listing has been created.
listings.on('created', function(name) {
    console.log("Created a listing for " + name);
});

// Event for when we are creating / removing listings.
listings.on('action', function(type, listings) {
    switch (type) {
        case 1:
            console.log("Creating...");
            break;
        case 2:
            console.log("Removing...");
            break;
    }
});

// By logging the actions you can see what the module does to create and remove listings
listingManager.on('actions', function (actions) {
    console.log(actions);
});

// Creates a listing for buying Earbuds without checking if one is already made
listingManager.createListing({
    sku: '143;6',
    intent: 0,
    currencies: {
        keys: 2,
        metal: 19
    }
});

// Creates a listing for a Mann Co. Supply Crate Key and Team Captain and forces it to be made
listingManager.createListings([{
    sku: '5021;6',
    intent: 0,
    details: 'I am buying Mann Co. Supply Crate Keys for 51.77 ref',
    currencies: {
        keys: 0,
        metal: 51.77
    }
}, {
    sku: '378;6',
    intent: 0,
    details: 'I am buying Team Captains for 8.33 ref',
    currencies: {
        keys: 0,
        metal: 8.33
    }
}], true);

// Creates a sell listing
listingManager.createListing({
    id: 'assetid of the item',
    intent: 1,
    details: 'I am selling this item for 10 refined, and I am open to offers',
    buyout: false,
    currencies: {
        keys: 0,
        metal: 10
    }
}, true);

// Removes a single listing
listingManager.removeListing('listing id');

// Removes multible listings
listingManager.removeListings(['listing id', 'listing id']);

// this event is emitted after the listings has been fetched from backpack.tf
listingManager.on('listings', function (listings) {
    console.log('We have ' + listings.length + ' listing(s) on backpack.tf');
});

// this event is emitted when an error occurres while trying to add / remove listings (you need to listen for the errors or else an error will be thrown)
listingManager.on('error', function () {

});

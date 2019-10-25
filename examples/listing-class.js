// Listen for listings event
listingManager.on('listings', function (listings) {
    // Go through all listings
    listings.forEach(function (listing, index) {
        if (index % 2 === 1) {
            // Remove every second listing
            listing.remove();
        } else {
            // Update every other
            listing.update({
                details: 'please buy my ' + listing.getName()
            });
        }
    });
});

// Notice how the actions are emitted
listingManager.on('actions', function (actions) {
    console.log(actions);
});

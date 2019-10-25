const async = require('async');
const BptfListings = require('bptf-listings');
const Schema = require('tf2-schema');

// See https://github.com/Nicklason/node-tf2-schema/tree/master/examples for examples on how to use / set up tf2-schema
const schemaManager = new Schema({ apiKey: 'your steam api key' });

const listingManager = new BptfListings({
    token: 'your bptf user token (https://backpack.tf/connections)',
    steamid: 'the steamid of the account you got the user token from',
    batchSize: 10 // only create 10 listings at a time
});

async.series([
    function (callback) {
        schemaManager.init(callback);
    },
    function (callback) {
        listingManager.schema = schemaManager.schema;
        listingManager.init(callback);
    }
], function (err) {
    if (err) {
        throw err;
    }

    // tf2-schema and bptf-listings are now ready to be used
});

schemaManager.on('ready', function () {
    console.log('tf2-schema is ready!');
});

listingManager.on('ready', function () {
    console.log('bptf-listings is ready!');
});

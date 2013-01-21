// Connect - MongoDB - Simple
// Copyright(c) 2013 BeauCoo
// Author: Rick Cotter
// MIT Licensed
//
// Reasoning:
// - Few dependencies equals easy to keep up to date.
// - Let what could be dependencies do what they do best i.e. https://github.com/mongodb/node-mongodb-native
// - Decoupled from Connect (for no particular reason a la connect-redis)
//
// Attribution:
// - Initial implementation inspired by connect-mongodb
// - Updates by nathanbower (from un-committed pull request #60)
// - Heavy referencing to connect-redis


var util = require('util');
var _ = require('lodash');


// Return the `MongoStore` extending `connect`'s session Store.
module.exports = function (connect, testDbCollection) {
    "use strict";

    var Store = connect.session.Store;
    var dbCollection = testDbCollection ? testDbCollection : null;
    var modifyFunc = null;
    var ttl = null;


    // Connect does not seem to guarantee providing callbacks
    function getSafeCallback(callback) {
        return (callback ? callback : function () {
        });
    }


    // Initialize
    // - 'db' is a required and open MongoDb connect
    // - 'options' (optional):
    //   - 'ttl' (optional) is the time-to-live for sessions. If omitted, the cookie's maxAge will be used.
    //   - 'reapIntervalMs' (optional) specifies how often to check and remove expired sessions. Must be 1000ms or greater.
    //   - 'collectionName' (optional) specifies the sessions collection to use. Defaults to 'sessions'.
    //   - 'logReaping' (optional) true/false will log out when reaping occurs.
    //   - ...and is passed on to the Connect session Store.
    // - 'aModifyFunc' (optional) can:
    //   - a) modify the given session and return null.
    //   - b) merge into the root session document by returning a hash.
    //   - c) or a combination of the two.
    //   - It has signature function (session) { return {...} or null; }
    //   - Is useful for adding meta-data that can be used by external queries.
    // - 'callback' (optional) to know when the async instance construction has completed.
    function MongoStore(db, options, aModifyFunc, callback) {
        options = options || {};
        Store.call(this, options);

        if (options.ttl) {
            ttl = options.ttl;
        }

        modifyFunc = aModifyFunc;


        function reap() {
            dbCollection.remove({expires:{'$lte':Date.now()}}, function () {
                if (options.logReaping === true) {
                    console.log("Reaping sessions at %s", new Date().toISOString());
                }
            });
        }


        // Start Reaping i.e polling for expired sessions for removal
        // - Presumed that reaping is desired for lifetime of the process
        // - Database connectivity can be intermittent in nature but is desired to be constant
        // - The database driver does not reliable emit 'close' events. They are only emitted when no callback
        //     is provided to db.close() which is out of this module's scope.
        // - Reaping is thus terminated on process exit
        function startReaping() {
            if (options.reapIntervalMs && 500 <= options.reapIntervalMs) {
                console.log("Reaping sessions enabled at %s every %d milliseconds", new Date().toISOString(), options.reapIntervalMs);

                var timerHandle = setInterval(reap, options.reapIntervalMs);

                process.on('exit', function () {
                    console.log("Reaping sessions closed on process exit at %s", new Date().toISOString());
                    clearInterval(timerHandle);
                });
            } else {
                console.log("Reaping sessions disabled");
            }
        }


        callback = getSafeCallback(callback);
        function getCollectionCallback(err, collection) {
            if (err) {
                return callback(err);
            }

            dbCollection = collection;
            startReaping(); // Ensure collection exists before reaping begins
            callback();
        }


        // Get collection
        if (dbCollection) {
            getCollectionCallback(null, dbCollection); // For testing
        } else {
            db.collection(options.collectionName || 'sessions', getCollectionCallback);
        }
    }


    util.inherits(MongoStore, Store);


    // Attempt to fetch session by the given `sid`.
    MongoStore.prototype.get = function (sid, callback) {
        callback = getSafeCallback(callback);
        dbCollection.findOne({_id:sid}, function (err, data) {
            if (err || !data) {
                return callback(err);
            }

            var session = JSON.parse(data.session);
            callback(null, session);
        });
    };


    // Commit the given `session` object associated with the given `sid`
    MongoStore.prototype.set = function (sid, session, callback) {
        var update = {};

        if (modifyFunc) {
            var result = modifyFunc(session);
            if (result) {
                _.merge(update, result);
            }
        }

        update.session = JSON.stringify(session);

        var maxAgeSeconds = session.cookie.maxAge;
        var calculatedTtl = ttl || (('number' === typeof maxAgeSeconds) ? (maxAgeSeconds * 1000) : 86400000);  // Default to one day
        update.expires = Date.now() + calculatedTtl;

        callback = getSafeCallback(callback);
        dbCollection.update({_id:sid}, {$set:update}, {upsert:true}, function (err, data) {
            return callback.apply(this, arguments);
        });
    };


    // Destroy the session associated with the given `sid`
    MongoStore.prototype.destroy = function (sid, callback) {
        dbCollection.remove({_id:sid}, getSafeCallback(callback));
    };


    // Fetch number of sessions
    MongoStore.prototype.length = function (callback) {
        dbCollection.count({}, getSafeCallback(callback));
    };


    // Clear all sessions
    MongoStore.prototype.clear = function (callback) {
        dbCollection.drop(getSafeCallback(callback));
    };


    return MongoStore;
};




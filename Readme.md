# connect-mongodb-simple
Copyright(c) 2013 BeauCoo
Author: Rick Cotter

Reasoning:

* Few dependencies equals easy to keep up to date.
* Lets what could be dependencies do what they do best i.e.
[node-mongodb-native](http://github.com/christkv/node-mongodb-native) - connectivity and write level concerns.
* Upgraded to work with [Connect 2.x](http://www.senchalabs.org/connect/) yet decoupled from it
(a la [connect-redis](https://github.com/visionmedia/connect-redis))
* Ability to annotate sessions for orthogonal concerns

Attribution:

* Initial implementation inspired by [connect-mongodb](https://npmjs.org/package/connect-mongodb), especially by its lack of maintenance.
* Updates by nathanbower (from connect-mongodb uncommitted pull request #60)
* Heavy referencing of [connect-redis](https://github.com/visionmedia/connect-redis)


## Installation

Via <code>npm install connect-mongodb-simple</code>


## Use

<pre><code>
var createStore = require('connect-mongodb-simple')(express);
// OR var createStore = require('connect-mongodb-simple')(connect);


// Create synchronously
createStore(
    openDb,
    {collectionName:"sess", reapIntervalMs:(60 * 1000), ttl:(60 * 60 * 1000},
    function modify(session) { return {...} },
    function callback(err, sessionStore) {

        // Where 'app' is an ExpressJS instance (or whatever)
        app.configure(function () {

           ...

            app.use(express.session({
                cookie:{maxAge:[MAX AGE MS]},
                store:sessionStore,
                secret:[SECRET]}
            ));

            ...
        });
    });


// Or asynchronously i.e. don't wait for signal that configuration is complete
var sessionStore = createStore(
    openDb,
    {collectionName:"sess", reapIntervalMs:(60 * 1000), ttl:(60 * 60 * 1000},
    function modify(session) { return {...} });

</code></pre>


Where:

* **openDB** is an open [node-mongodb-native](http://github.com/christkv/node-mongodb-native) database connection.
Write mode (safe, w:, etc) is controlled here. Recommended use is the new [MongoClient](http://mongodb.github.com/node-mongodb-native/api-generated/mongoclient.html)
* **options** (optional):
    * **ttl** (optional) is the time-to-live for sessions. If omitted, the cookie's maxAge will be used.
    * **collectionName** (optional)to override default 'sessions' MongoDB collection name.
    * **reapIntervalMs** (optional) to remove expired sessions. Omit or specify as less than 500 to turn-off.
    * **logReaping** (optional) true/false determines whether each reap is logged to console.
* **modifyFunc** (optional) is a function:
    * Receives a session hash
    * Can modify it and must return null
    * Or returns a hash that will be merged with the root session document as json. Useful for including extra-info
that will queried for orthogonal means.
* **callback** (optional) returns (err, instanceOfSessionStore) to know when the async instance construction has completed.

Returns:

An instance of the mongodb session store


### modifyFunc Example 1:
    function(session) {
      delete session.SOME_KEY;
      return null;
    }

    // Resulting in a session document:

    {
      _id:[ID],
      session:"{...}", // without SOME_KEY
      expires:[DATE]
    }

### modifyFunc Example 2:
    function(session) {
      return {k:session.SOME_KEY};
    }

    // Resulting in a session document:

    {
      _id:[ID],
      session:"{...}",
      expires:[DATE],
      k:[VALUE OF SOME_KEY]
    }


## MongoDB Indexes
* **_id** field is used for most operations. By default an index already exists.
* **expires** field is used to query during reaping. Optimize by creating an index.


## Alternative Session Reaping Configuration

Instead of having **connect-mongodb-simple** reap expired sessions use new features in
[MongoDB](http://docs.mongodb.org/manual/tutorial/expire-data/) where the index created could be:
<pre>
<code>db.sessions.ensureIndex({expires:1}, {expireAfterSeconds:3600})</code>
</pre>


## Tests

* Run <code>npm test</code>
* or run `mocha test --require should --reporter spec --recursive --grep "unit tests"`
* or run `mocha test --require should --reporter spec --recursive` to run unit and functional tests (requires running
  a mongod instance at localhost:27017 with a 'test' database)
* or run continuously via `mocha watch --require should --reporter spec --recursive"`


## Release Notes

* 0.1.1 Reverted to older lodash until RC stabilizes
* 0.1.0 Improved creation
* 0.0.1 First

##License
(The MIT License)

Copyright (c) 2013 BeauCoo Technologies Inc. <info@beaucoo.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


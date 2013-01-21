require('should');
var util = require('util');
var Connect = require('connect');
var MongoStore = require('..')(Connect);
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;


describe('functional tests', function () {
    "use strict";


    var db;
    var dbCollection;
    var sessionStore;
    var collectionName = "sessions_test";


    before(function (done) {
        MongoClient.connect("mongodb://localhost:27017/test?auto_reconnect=true", function (err, openDb) {
            if (err) {
                throw "Is the localhost:27017 mongod running: " + err;
            }

            db = openDb;
            sessionStore = new MongoStore(openDb, {reapIntervalMs:500, ttl:150, collectionName:collectionName, logReaping:false});

            db.collection(collectionName, function (err, col) {
                if (err) {
                    throw err;
                }

                dbCollection = col;
                done();
            });
        });
    });


    after(function (done) {
        dbCollection.drop(function (err) {
            if (err) {
                throw util.format("Error dropping collection '%s': %s", collectionName, err);
            }

            db.close(done);
        });
    });


    it('should set the session', function (done) {
        var _id = new ObjectID();
        sessionStore.set(_id, {cookie:{maxAge:3000}, name:"SOME_NAME"}, function (err, ok) {
            console.log(err);
            (!err).should.be.true;

            dbCollection.findOne({_id:_id}, function (err, doc) {
                (!err).should.be.true;
                doc._id.should.eql(_id);
                doc.session.should.eql(JSON.stringify({cookie:{maxAge:3000}, name:"SOME_NAME"}));

                try {
                    new Date(doc.expires);
                } catch (ex) {
                    throw util.format("'expires' expected to be a valid date integer: %s", ex);
                }

                done();
            });
        });
    });


    it('should get the session', function (done) {
        var _id = new ObjectID();
        sessionStore.set(_id, {cookie:{maxAge:3000}, name:"SOME_NAME"}, function (err, ok) {
            sessionStore.get(_id, function (err, data) {
                (!err).should.be.true;
                data.should.eql({cookie:{maxAge:3000}, name:"SOME_NAME"});
                done();
            });
        });
    });


    it('should destroy a session', function (done) {
        var _id = new ObjectID();
        sessionStore.set(_id, {cookie:{maxAge:3000}, name:"SOME_NAME"}, function (err, ok) {
            sessionStore.destroy(_id, function (err, data) {
                (!err).should.be.true;
                data.should.equal(1); // success
                done();
            });
        });
    });


    it('should clear expired sessions', function (done) {
        this.timeout(3000);

        var _id = new ObjectID();
        sessionStore.set(_id, {cookie:{}, name:"SOME_NAME"}, function (err, ok) {
            setTimeout(function () {
                sessionStore.get(_id, function (err, data) {
                    (!err).should.be.true;
                    (!data).should.be.true;
                    done();
                });
            }, 1000);
        });
    });
});
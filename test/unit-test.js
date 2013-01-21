require('should');
var util = require('util');
var Connect = require('connect');


describe('unit tests', function () {
    "use strict";


    function getStore(dbCollection, options, modifyFunc) {
        options = options || {};
        return new (require('..')(Connect, dbCollection))(null, options, modifyFunc);
    }


    describe('reaping should', function () {
        it('happen', function (done) {
            this.timeout(1000);
            var removeCalled = false;

            function Col() {
                this.remove = function (query) {
                    // Reap timer is called repeatedly until process.exit by design
                    if (!removeCalled) {
                        removeCalled = true;
                        done();
                    }
                };
            }

            getStore(new Col(), {reapIntervalMs:500});
        });


        it('not happen when timeout is too frequent', function (done) {
            this.timeout(1000);
            function Col() {
                this.remove = function () {
                    throw "REAPING NOT EXPECTED";
                };
            }

            getStore(new Col(), {reapIntervalMs:499});
            setTimeout(function () {
                done();
            }, 600);
        });


        it('not happen when interval is not provided', function (done) {
            this.timeout(1000);
            function Col() {
                this.remove = function () {
                    throw "REAPING NOT EXPECTED";
                };
            }

            getStore(new Col());
            setTimeout(function () {
                done();
            }, 600);
        });
    });


    describe('getting a session should', function () {
        it('', function (done) {
            function Col() {
                this.findOne = function (query, callback) {
                    query.should.eql({_id:"SID"});
                    callback(null, {session:JSON.stringify({key:"SOME_SESSION"})});
                };
            }

            getStore(new Col()).get("SID", function (err, data) {
                (!err).should.be.true;
                data.should.eql({key:"SOME_SESSION"});
                done();
            });
        });


        it('handle missing callback', function () {
            function Col() {
                this.findOne = function (query, callback) {
                    callback(null, {session:JSON.stringify({key:"SOME_SESSION"})});
                };
            }

            getStore(new Col()).get("SID");
        });


        it('handle err', function (done) {
            function Col() {
                this.findOne = function (query, callback) {
                    callback("SOME_ERROR");
                };
            }

            getStore(new Col()).get("SID", function (err) {
                err.should.equal("SOME_ERROR");
                done();
            });
        });


        it('handle no session found', function (done) {
            function Col() {
                this.findOne = function (query, callback) {
                    callback();
                };
            }

            getStore(new Col()).get("SID", function (err, session) {
                (!err).should.be.true;
                (!session).should.be.true;
                done();
            });
        });
    });


    describe('setting a session should', function () {
        it('use cookie maxAge', function (done) {
            function Col() {
                this.update = function (query, update, options, callback) {
                    query.should.eql({_id:"SID"});
                    update.$set.session.should.equal(JSON.stringify({cookie:{maxAge:2}}));
                    (update.$set.expires <= Date.now() + 2000).should.be.true;
                    options.should.eql({upsert:true});
                    callback(null, "SOME_RESULT");
                };
            }

            getStore(new Col()).set("SID", {cookie:{maxAge:2}}, function (err, data) {
                (!err).should.be.true;
                data.should.equal("SOME_RESULT");
                done();
            });
        });


        it('use cookie ttl', function (done) {
            function Col() {
                this.update = function (query, update) {
                    (update.$set.expires <= Date.now() + 1000).should.be.true;
                    done();
                };
            }

            getStore(new Col(), {ttl:1000}).set("SID", {cookie:{maxAge:2}});
        });


        it('use one day', function (done) {
            function Col() {
                this.update = function (query, update) {
                    (update.$set.expires <= Date.now() + 86400000).should.be.true;
                    done();
                };
            }

            getStore(new Col()).set("SID", {cookie:{}});
        });


        it('merge hash', function (done) {
            function Col() {
                this.update = function (query, update) {
                    (!!update.$set.expires).should.be.true;
                    (!!update.$set.session).should.be.true;
                    update.$set.person_id.should.equal("SOME_ID");
                    update.$set.person_name.should.equal("SOME_NAME");
                    done();
                };
            }

            function modifyFunc(session) {
                return {
                    person_id:session.p_id,
                    person_name:session.p_name
                };
            }

            getStore(new Col(), {}, modifyFunc).set("SID", {cookie:{}, p_id:"SOME_ID", p_name:"SOME_NAME"});
        });


        it('not merge hash', function (done) {
            function Col() {
                this.update = function (query, update) {
                    (!!update.$set.expires).should.be.true;
                    (!!update.$set.session).should.be.true;
                    done();
                };
            }

            function modifyFunc(session) {
                return null;
            }

            getStore(new Col(), {}, modifyFunc).set("SID", {cookie:{}, p_id:"SOME_ID", p_name:"SOME_NAME"});
        });


        it('modify session', function (done) {
            function Col() {
                this.update = function (query, update) {
                    (!!update.$set.expires).should.be.true;
                    (!!update.$set.session).should.be.true;
                    var session = JSON.parse(update.$set.session);
                    session.should.eql({cookie:{}, p_id:"SOME_ID"});
                    done();
                };
            }

            function modifyFunc(session) {
                delete session.p_name;
                return null;
            }

            getStore(new Col(), {}, modifyFunc).set("SID", {cookie:{}, p_id:"SOME_ID", p_name:"SOME_NAME"});
        });


        it('handle missing callback', function () {
            function Col() {
                this.update = function (query, update, options, callback) {
                    callback(null, "SOME_RESULT");
                };
            }

            getStore(new Col()).set("SID", {cookie:{maxAge:2}});
        });
    });


    describe('destroying a session', function () {
        it('succeed', function (done) {
            function Col() {
                this.remove = function (query, callback) {
                    query.should.eql({_id:"SID"});
                    callback();
                };
            }

            getStore(new Col()).destroy("SID", function () {
                done();
            });
        });


        it('handle missing callback', function () {
            function Col() {
                this.remove = function (query, callback) {
                    callback();
                };
            }

            getStore(new Col()).destroy("SID");
        });
    });


    describe('number of sessions', function () {
        it('succeed', function (done) {
            function Col() {
                this.count = function (query, callback) {
                    query.should.eql({});
                    callback();
                };
            }

            getStore(new Col()).length(function () {
                done();
            });
        });


        it('handle missing callback', function () {
            function Col() {
                this.count = function (query, callback) {
                    callback();
                };
            }

            getStore(new Col()).length();
        });
    });


    describe('clear sessions', function () {
        it('succeed', function (done) {
            function Col() {
                this.drop = function (callback) {
                    callback();
                };
            }

            getStore(new Col()).clear(function () {
                done();
            });
        });


        it('handle missing callback', function () {
            function Col() {
                this.drop = function (callback) {
                    callback();
                };
            }

            getStore(new Col()).clear();
        });
    });
});



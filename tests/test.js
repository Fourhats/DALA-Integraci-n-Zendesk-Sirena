'use strict';

var should = require('should');
var sinon = require('sinon');
var nock = require('nock');
var proxyquire = require('proxyquire');
var Q = require('q');

var someZendeskUsers = [{
    'id': 13840771628,
    'url': 'https://dalaimpresiontesting.zendesk.com/api/v2/users/13840771628.json',
    'name': 'Dala Impresion',
    'email': 'pedroalessandri@gmail.com',
    'created_at': '2016-10-20T20:35:36Z',
    'updated_at': '2016-10-24T03:40:10Z',
    'time_zone': 'Brasilia',
    'phone': null,
    'shared_phone_number': null,
    'photo': null,
    'locale_id': 2,
    'locale': 'es',
    'organization_id': 10908155508,
    'role': 'admin',
    'verified': true,
    'external_id': null,
    'tags': [],
    'alias': null,
    'active': true,
    'shared': false,
    'shared_agent': false,
    'last_login_at': '2016-10-24T03:40:10Z',
    'two_factor_auth_enabled': null,
    'signature': null,
    'details': null,
    'notes': null,
    'custom_role_id': null,
    'moderator': true,
    'ticket_restriction': null,
    'only_private_comments': false,
    'restricted_agent': false,
    'suspended': false,
    'chat_only': false,
    'user_fields': {}
}, {
    'id': 13857025167,
    'url': 'https://dalaimpresiontesting.zendesk.com/api/v2/users/13857025167.json',
    'name': 'Daniel',
    'email': 'danielorozco@dala.com',
    'created_at': '2016-10-20T20:39:26Z',
    'updated_at': '2016-10-20T20:39:38Z',
    'time_zone': 'Brasilia',
    'phone': null,
    'shared_phone_number': null,
    'photo': null,
    'locale_id': 2,
    'locale': 'es',
    'organization_id': 11006450288,
    'role': 'end-user',
    'verified': false,
    'external_id': null,
    'tags': [],
    'alias': '',
    'active': true,
    'shared': false,
    'shared_agent': false,
    'last_login_at': null,
    'two_factor_auth_enabled': false,
    'signature': null,
    'details': '',
    'notes': '',
    'custom_role_id': null,
    'moderator': false,
    'ticket_restriction': 'requested',
    'only_private_comments': false,
    'restricted_agent': true,
    'suspended': false,
    'chat_only': false,
    'user_fields': {}
}];

var someSirenaUsers = [{
    'id': '58066860661c5c0300533868',
    'created': '2016-10-18T18:22:24.449Z',
    'group': 'Autos del Mundo',
    'firstName': 'Javier',
    'lastName': 'Gomez',
    'status': 'notInterested',
    'phones': [
        '+54 9 11 5659-0639'
    ],
    'emails': [
        'mmorkin@hotmail.com'
    ],
    'leads': [
        {
            'created': '2016-10-18T18:22:24.468Z',
            'source': 'Twitter',
            'type': 'vehicle'
        }
    ],
    'agent': {
        'id': '58065fde661c5c03005335aa',
        'firstName': 'Demián',
        'lastName': 'Gallardo',
        'email': 'demo@autosdelmundo.com'
    },
    'assigned': '2016-10-18T18:22:54.991Z'
},
    {
        'id': '5807cdf9f0971b03006510f3',
        'created': '2016-10-19T19:48:09.861Z',
        'group': 'Autos del Mundo',
        'firstName': 'Karla',
        'lastName': 'Gallardo',
        'status': 'followUp',
        'phones': [
            '+52 1 449 110 3949'
        ],
        'emails': [
            'karla@getsirena.com'
        ],
        'leads': [
            {
                'created': '2016-10-19T19:48:09.877Z',
                'source': 'Facebook',
                'type': 'vehicle'
            }
        ],
        'agent': {
            'id': '58065fde661c5c03005335aa',
            'firstName': 'Demián',
            'lastName': 'Gallardo',
            'email': 'demo@autosdelmundo.com'
        },
        'assigned': '2016-10-19T19:48:49.043Z'
    }];

var matchingSirenaUser = {
    'id': '5807cdf920971b03006510f3',
    'created': '2016-10-19T19:48:09.861Z',
    'group': 'Autos del Mundo',
    'firstName': 'Karla',
    'lastName': 'Gallardo',
    'status': 'followUp',
    'phones': [
        '+52 1 449 110 3949'
    ],
    'emails': [
        'matching@user.com'
    ],
    'leads': [
        {
            'created': '2016-10-19T19:48:09.877Z',
            'source': 'Facebook',
            'type': 'vehicle'
        }
    ],
    'agent': {
        'id': '58065fde661c5c03005335aa',
        'firstName': 'Demián',
        'lastName': 'Gallardo',
        'email': 'demo@autosdelmundo.com'
    },
    'assigned': '2016-10-19T19:48:49.043Z'
};

var matchingZendeskUser = {
    'id': 13857025168,
    'url': 'https://dalaimpresiontesting.zendesk.com/api/v2/users/13857025168.json',
    'name': 'Daniel',
    'email': 'matching@user.com',
    'created_at': '2016-10-20T20:39:26Z',
    'updated_at': '2016-10-20T20:39:38Z',
    'time_zone': 'Brasilia'
};


var collectionStub;
var insertManySpy;
var closeSpy;
var mongoMock;

describe('Main', function() {
    beforeEach(function() {
        insertManySpy = sinon.spy();
        collectionStub = sinon.stub().returns({
            insertMany: insertManySpy
        });
        closeSpy = sinon.spy();

        mongoMock = {
            MongoClient: {
                connect: function() {
                    return Q.fcall(function() {
                        return {
                            collection: collectionStub,
                            close: closeSpy
                        };
                    });
                }
            }
        };
    });

    it('# Empty Sirena users', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, someZendeskUsers);
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return [];
            });

        return main(function(err, result) {
            should.not.exist(err);
            collectionStub.called.should.be.false();
            insertManySpy.called.should.be.false();
            closeSpy.called.should.be.true();

            result.status.should.equal('OK');
            result.deleted_users.should.have.length(0);
            result.deleting_errors.should.have.length(0);

            return done();
        });
    });

    it('# Empty Zendesk users', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, []);
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return someSirenaUsers;
            });

        return main(function(err, result) {
            should.not.exist(err);
            collectionStub.called.should.be.false();
            insertManySpy.called.should.be.false();
            closeSpy.called.should.be.true();

            result.status.should.equal('OK');
            result.deleted_users.should.have.length(0);
            result.deleting_errors.should.have.length(0);

            return done();
        });
    });

    it('# Both users empty', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, []);
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return [];
            });

        return main(function(err, result) {
            should.not.exist(err);
            collectionStub.called.should.be.false();
            insertManySpy.called.should.be.false();
            closeSpy.called.should.be.true();

            result.status.should.equal('OK');
            result.deleted_users.should.have.length(0);
            result.deleting_errors.should.have.length(0);

            return done();
        });
    });

    it('# One user matches', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, someZendeskUsers.concat([matchingZendeskUser]));
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return someSirenaUsers.concat([matchingSirenaUser]);
            });

        nock('http://api.getsirena.com')
            .intercept('/v1/prospect/5807cdf920971b03006510f3', 'DELETE')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return someSirenaUsers.concat([matchingSirenaUser]);
            });

        return main(function(err, result) {
            should.not.exist(err);
            collectionStub.calledWith('deletedUsers').should.be.true();
            insertManySpy.called.should.be.true();
            closeSpy.called.should.be.true();

            result.status.should.equal('OK');
            result.deleted_users.should.have.length(1);
            result.deleting_errors.should.have.length(0);

            return done();
        });
    });

    it('# Error in Zensdesk response', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(new Error('some error'), null, null);
                        }
                    }
                })
            }
        });


        return main(function(err, result) {
            err.message.should.equal('some error');
            should.not.exist(result);
            collectionStub.called.should.be.false();
            insertManySpy.called.should.be.false();
            closeSpy.called.should.be.false();

            return done();
        });
    });

    it('# Error in Sirena listing', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, someZendeskUsers);
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .replyWithError({
                'message': 'some error'
            });

        return main(function(err, result) {
            err.error.message.should.equal('some error');
            should.not.exist(result);
            collectionStub.called.should.be.false();
            insertManySpy.called.should.be.false();
            closeSpy.called.should.be.false();

            return done();
        });
    });

    it('# Error deleting from sirena', function(done) {
        var main = proxyquire('../index', {
            'mongodb': mongoMock,
            'node-zendesk': {
                createClient: sinon.stub().returns({
                    users: {
                        list: function(cb) {
                            cb(null, null, someZendeskUsers.concat([matchingZendeskUser]));
                        }
                    }
                })
            }
        });

        nock.disableNetConnect();

        nock('http://api.getsirena.com')
            .get('/v1/prospects')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .reply(200, function() {
                return someSirenaUsers.concat([matchingSirenaUser]);
            });

        nock('http://api.getsirena.com')
            .intercept('/v1/prospect/5807cdf920971b03006510f3', 'DELETE')
            .query({
                'api-key': 'ZMN49VQc8KeuPf1aVyn9EoeM'
            })
            .times(1)
            .replyWithError({
                message: 'some error'
            });

        return main(function(err, result) {
            should.not.exist(err);
            collectionStub.calledWith('deletedUsers').should.be.false();
            collectionStub.calledWith('errors').should.be.true();
            insertManySpy.called.should.be.true();
            closeSpy.called.should.be.true();

            result.status.should.equal('OK');
            result.deleted_users.should.have.length(0);
            result.deleting_errors.should.have.length(1);

            return done();
        });
    });
});

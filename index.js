'use strict';

var request = require('request-promise');
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;

var ZEN_API_URL = 'https://dalaimpresiontesting.zendesk.com/api/v2';
var ZEN_USER = 'pedroalessandri@gmail.com';
var ZEN_TOKEN = 'XfUUg7dmKMMMcnfRSrYfPVJuWFS8067OJaRXJXWO';

var SIRENA_API_URL = 'http://api.getsirena.com/v1';
var SIRENA_API_KEY = 'ZMN49VQc8KeuPf1aVyn9EoeM';

var MONGO_URL = 'mongodb://fourhats:fourhats@ds063546.mlab.com:63546/fourhats';

function getZendeskUsersPage(page) {
    return request({
        method: 'GET',
        uri: ZEN_API_URL + '/users.json',
        qs: {
            'page': page,
            'sorty_by': 'updated_at',
            'sort_order': 'desc'
        },
        headers: {
            Authorization: 'Basic ' + new Buffer(ZEN_USER + '/token:' + ZEN_TOKEN).toString('base64')
        },
        forever: true,
        json: true
    });
}

function getZendeskUsers(pages) {
    var reqs = [];
    for (var i = 1; i <= pages; i++) {
        reqs.push(getZendeskUsersPage(i));
    }
    return Q
        .all(reqs)
        .then(function(responses) {
            return responses.reduce(function(prev, next) {
                return prev.concat(next.users);
            }, []);
        });
}

function getSirenaUsers() {
    return request({
        method: 'GET',
        uri: SIRENA_API_URL + '/prospects',
        qs: {
            'api-key': SIRENA_API_KEY
        },
        json: true
    });
}

function filterUsersToRemove(zendeskUsers, sirenaUsers) {
    console.log(sirenaUsers.length);
    var existingEmails = zendeskUsers.map(function(user) {
        return user.email;
    });

    return sirenaUsers.filter(function(user) {
        return user.emails.some(function(email) {
            return existingEmails.indexOf(email) !== -1;
        });
    });
}

function removeUsers(users) {
    if (users.length > 0) {
        return Q.allSettled(
            users.map(function(user) {
                return request({
                    method: 'DELETE',
                    uri: SIRENA_API_URL + '/prospect/' + user.id,
                    qs: {
                        'api-key': SIRENA_API_KEY
                    },
                    json: true
                });
            })
        );
    }
    return [];
}


var deletedUsers;
var deletingErrors;

function logRemovedUsers(users) {
    var db;
    deletedUsers = users.filter(function(user) {
        return user.state === 'fulfilled';
    })
        .map(function(user) {
            return user.value;
        });

    deletingErrors = users.filter(function(user) {
        return user.state === 'rejected';
    })
        .map(function(user) {
            return {
                message: user.reason.message,
                stack: user.reason.stack
            };
        });

    console.log('Deleted Users: ' + JSON.stringify(deletedUsers));
    console.log('Errors: ' + JSON.stringify(deletingErrors));

    return MongoClient.connect(MONGO_URL)
        .then(function(connection) {
            db = connection;
            if (deletedUsers.length > 0) {
                return db
                    .collection('deletedUsers')
                    .insertMany(deletedUsers);
            }
            return deletedUsers;
        })
        .then(function() {
            if (deletingErrors.length > 0) {
                return db
                    .collection('errors')
                    .insertMany(deletingErrors);
            }
            return deletingErrors;
        })
        .then(function() {
            return db.close();
        })
        .catch(function(error) {
            db.close();
            console.log('Error storing deleted users');
            console.log(error)
        });
}

function main(callback) {

    var zendeskUsers;
    return getZendeskUsers(5)
        .then(function(users) {
            console.log(users.length);
            zendeskUsers = users;
        })
        .then(getSirenaUsers)
        .then(function(sirenaUsers) {
            return filterUsersToRemove(zendeskUsers, sirenaUsers);
        })
        .then(removeUsers)
        .then(logRemovedUsers)
        .then(function() {
            return callback(null, {
                last_run: new Date(),
                status: 'OK',
                deleted_users: deletedUsers,
                deleting_errors: deletingErrors
            });
        })
        .catch(function(error) {
            console.log(error);
            return callback(error);
        });
}

//main(console.log);

module.exports = main;

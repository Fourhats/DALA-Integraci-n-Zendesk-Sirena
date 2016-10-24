'use strict';

var request = require('request-promise');
var zendesk = require('node-zendesk');
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;

var ZEN_API_URL = 'https://dalaimpresiontesting.zendesk.com/api/v2';
var ZEN_USER = 'pedroalessandri@gmail.com';
var ZEN_TOKEN = 'XfUUg7dmKMMMcnfRSrYfPVJuWFS8067OJaRXJXWO';

var SIRENA_API_URL = 'http://api.getsirena.com/v1';
var SIRENA_API_KEY = 'ZMN49VQc8KeuPf1aVyn9EoeM';

var MONGO_URL = 'mongodb://fourhats:fourhats@ds063546.mlab.com:63546/fourhats';

var client = zendesk.createClient({
    username: ZEN_USER,
    token: ZEN_TOKEN,
    remoteUri: ZEN_API_URL
});

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
    client.users.list(function(err, req, zendeskUsers) {
        if (err) {
            return callback(err);
        }

        return getSirenaUsers()
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
                console.log('error');
                return callback(error);
            });
    });
}

//main(console.log);

module.exports = main;

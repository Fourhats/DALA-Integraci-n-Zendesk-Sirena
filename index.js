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


function qlimit(maxConcurrency) {
    var outstandingCount = 0;
    var queue = [];

    /**
     * Returns a promise which will resolve when
     * the concurrency is not saturated
     */
    function initialPromise() {
        if (outstandingCount < maxConcurrency) {
            outstandingCount++;
            return Q.resolve();
        }

        var defer = Q.defer();
        queue.push(defer);
        return defer.promise;
    }

    /**
     * Called after the factory promise is fulfilled.
     */
    function complete() {
        var next = queue.shift();

        if (next) {
            next.resolve();
        } else {
            outstandingCount--;
        }
    }

    /**
     * Returns a concurrency-limited promise
     */
    return function(factory) {
        return function() {
            var args = Array.prototype.slice.apply(arguments);

            return initialPromise()
                .then(function() {
                    return factory.apply(null, args);
                })
                .finally(complete);

        };
    };

}

var limit = qlimit(30);

var getZendeskUsersPage = limit(function(page) {
    console.log('Requesting page: ' + page);
    return request({
        method: 'GET',
        uri: ZEN_API_URL + '/users.json',
        qs: {
            'page': page
        },
        headers: {
            Authorization: 'Basic ' + new Buffer(ZEN_USER + '/token:' + ZEN_TOKEN).toString('base64')
        },
        forever: true,
        json: true
    });
});

function calculateZendeskPages() {
    return getZendeskUsersPage(1)
        .then(function(response) {
            return Math.floor(response.count / 100) + 1;
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
        return user.email !== null ? user.email.toLowerCase() : null;
    });

    return sirenaUsers.filter(function(user) {
        return user.emails.some(function(email) {
            return existingEmails.indexOf(email.toLowerCase()) !== -1;
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
    return users;
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
    return calculateZendeskPages()
        .then(function(pages) {
            return getZendeskUsers(pages);
        })
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

// console.time('asd');
// main(function(err, result) {
//     if (err) {
//         console.log(err);
//         console.timeEnd('asd');
//     }
//     console.log(result);
//     console.timeEnd('asd');
// });

module.exports = main;


// Dejo esto acá, porque si todo sale mal, con esto traigo las páginas de usuarios de a una

// fn should return an object like
// {26771.245ms
//   done: false,
//   value: foo
// }
// function loop(promise, fn) {
//     return promise.then(fn).then(function(wrapper) {
//         return !wrapper.done ? loop(getZendeskUsersPage(wrapper.value), fn) : wrapper.value;
//     });
// }
//
// function getZendeskUsersPage(url) {
//     return request({
//         method: 'GET',
//         uri: url,
//         headers: {
//             Authorization: 'Basic ' + new Buffer(ZEN_USER + '/token:' + ZEN_TOKEN).toString('base64')
//         },
//         forever: true,
//         json: true
//     });
// }
//
// function getZendeskUsers() {
//     var deferred = Q.defer();
//     var zendeskReponses = [];
//     loop(getZendeskUsersPage(ZEN_API_URL + '/users.json?page=1'), function(response) {
//         zendeskReponses.push(response);
//         console.log(zendeskReponses.length);
//         return {
//             done: response.next_page === null,
//             value: response.next_page
//         };
//     }).done(function() {
//         deferred.resolve(zendeskReponses.reduce(function(prev, next) {
//             return prev.concat(next.users);
//         }, []));
//     });
//
//     return deferred.promise;
// }

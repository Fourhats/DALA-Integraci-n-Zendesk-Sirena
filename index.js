'use strict';

var request = require('request-promise');
var Q = require('q');
var moment = require('moment');
var MongoClient = require('mongodb').MongoClient;

var ZEN_API_URL = 'https://dalaimpresiontesting.zendesk.com/api/v2';
var ZEN_USER = 'pedroalessandri@gmail.com';
var ZEN_TOKEN = 'XfUUg7dmKMMMcnfRSrYfPVJuWFS8067OJaRXJXWO';

var SIRENA_API_URL = 'http://api.getsirena.com/v1';
var SIRENA_API_KEY = 'ZMN49VQc8KeuPf1aVyn9EoeM';

var MONGO_URL = 'mongodb://fourhats:fourhats@ds063546.mlab.com:63546/fourhats';

var USERS_FROM_LAST_DAYS = 1;


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
        uri: ZEN_API_URL + '/search.json',
        qs: {
            'query': 'type:user updated_at>=' + moment().subtract(USERS_FROM_LAST_DAYS, 'days').format('YYYY-MM-DD'),
            'page': page
        },
        headers: {
            Authorization: 'Basic ' + new Buffer(ZEN_USER + '/token:' + ZEN_TOKEN).toString('base64')
        },
        forever: true,
        json: true
    });
});

function calculateZendeskPages(firstPage) {
    return Math.floor(firstPage.count / 100) + 1;
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
                return prev.concat(next.results);
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

function getZendeskUserTickets(user) {
    return request({
        method: 'GET',
        uri: ZEN_API_URL + '/users/' + user + '/tickets/requested.json',
        headers: {
            Authorization: 'Basic ' + new Buffer(ZEN_USER + '/token:' + ZEN_TOKEN).toString('base64')
        },
        forever: true,
        json: true
    });
}

/**
 * 1) Filters the zendesk users that are also in sirena
 * 2) Get the tickets only for those users
 * 3) Return the sirena users that has a ticket with the requested subject in zendesk
 */
function filterUsersToRemove(zendeskUsers, sirenaUsers) {
    console.log('Sirena Users Count: ' + sirenaUsers.length);

    var existingSirenaEmails = [].concat.apply([],
        sirenaUsers.map(function(sirenaUser) {
            return sirenaUser.emails;
        })
    ).map(function(mail) {
        if (typeof mail !== 'undefined' && mail !== null) {
            return mail.toLowerCase();
        }
    });

    var zendeskUsersInBoth = zendeskUsers.filter(function(zendeskUser) {
        if (typeof zendeskUser.email !== 'undefined' && zendeskUser.email !== null) {
            return existingSirenaEmails.indexOf(zendeskUser.email.toLowerCase()) !== -1;
        }
        return false;
    });

    return Q.all(
        zendeskUsersInBoth.map(function(user) {
            return getZendeskUserTickets(user.id)
                .then(function(tickets) {
                    return tickets.tickets.filter(function(ticket) {
                        return ticket.subject.indexOf('Confirmamos el pedido? :)') !== -1;
                    });
                })
                .then(function(confirmations) {
                    if (confirmations.length > 0) {
                        return user;
                    }
                });
        })
    )
        .then(function(results) {
            return results.filter(function(result) {
                return typeof result !== 'undefined';
            });
        })
        .then(function(zendeskUsersToRemove) {
            var existingEmails = zendeskUsersToRemove.map(function(user) {
                if (typeof user.email !== 'undefined' && user.email !== null) {
                    return user.email.toLowerCase();
                }
            });

            return sirenaUsers.filter(function(user) {
                return user.emails.some(function(email) {
                    return existingEmails.indexOf(email.toLowerCase()) !== -1;
                });
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
    return getZendeskUsersPage(1)
        .then(function(firstPage) {
            if (firstPage.count > 100) {
                return getZendeskUsers(calculateZendeskPages(firstPage));
            }
            return firstPage.results;
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

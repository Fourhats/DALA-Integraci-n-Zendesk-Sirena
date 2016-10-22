'use strict';

const faker = require('faker');
var zendesk = require('node-zendesk');

var ZEN_API_URL = 'https://dalaimpresiontesting.zendesk.com/api/v2';
var ZEN_USER = 'pedroalessandri@gmail.com';
var ZEN_TOKEN = 'XfUUg7dmKMMMcnfRSrYfPVJuWFS8067OJaRXJXWO';


var client = zendesk.createClient({
    username: ZEN_USER,
    token: ZEN_TOKEN,
    remoteUri: ZEN_API_URL
});
var count = 0;

function createUser() {
    if (count < 100) {
        let user = {
            "user": {
                name: faker.name.findName(),
                email: faker.internet.email(),
                role: faker.random.arrayElement(['end-user', 'agent'])
            }
        };

        client.users.create(user, function(err, req, result) {
            if (err) {
                console.log(err);
                return;
            }
            console.log('USER CREATED:');
            console.log([result.id, result.email, result.name]);
        });

        count++;
        console.log('USERS COUNT: ' + count);
    }
}

setInterval(createUser, 3000);

var BASE_URL = 'https://intra.epitech.eu:443';

var request = require('request');

// Hack: minify the incoming JSON. This strips the comments, which
// aren't legal in JSON.
require('./json_minify.js');

function login(login, password, callback) {
    console.log('Connecting as ' + login + ':' + password);
    request.post(BASE_URL + '/?format=json', {form:{
	login: login,
	password: password,
    }}, function(err, response, body) {
	if (err) {
	    callback(err, null);	
	}
	if (response.statusCode == 403) {
	    err = 'Invalid credentials';
	}
	else if (response.statusCode != 200) {
	    err = 'Server rejected the request. HTTP Code: ' + response.statusCode;
	}
	console.log('BODY: ' + body);
	callback(err, JSON.parse(JSON.minify(body)));	
    });
}

function makeGET(url, callback) {
    request.get(BASE_URL + url, function(err, response, body) {
	if (err) throw err;
	if (response.statusCode != 200) {
	    throw new Error('Server rejected the request. HTTP Code: ' + response.statusCode);
	}
	console.log('BODY: ' + body);
	callback(JSON.parse(JSON.minify(body)));
    });
}

exports.makeGET = makeGET // FIXME should be private
exports.login = login


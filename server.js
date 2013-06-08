var express = require('express');
var app = express();
var mysql = require('mysql');
var intra = require('./intra.js');

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.enable("jsonp callback");


var session_store = new express.session.MemoryStore;

var db = mysql.createConnection({ user: 'root',  password: '1234'});
db.connect(function(err) {
    if (err) throw err;
    //db.query("use return");
});




function failwithone(res, error) {
    var r = {'errors': [{
	'error_code': error[0],
	'error_msg': error[1],
    }]};
    res.json(r);
}

function failauth(res) {
    return failwithone(res, [1, 'AUTHENTICATION_REQUIRED']);
}

function checkauth(req, res, callback) {
    var sid = req.query.token;
    if (!sid) return failauth(res);
    session_store.get(sid, function(err, session) {
	if (err) return failauth(res, err);
	if (!session) return failauth(res);
	req.auth_info = {
	    'login': session.login,
	    'password': session.password,
	    'method': 'session_token',
	};
	return callback(req, res);
    });
}

app.authget = function(path, callback) {
    this.get(path, function(req, res) {
	checkauth(req, res, callback);
    });
}

app.get('/api/auth/login', function(req, res) {
    var login = req.query.login;
    var password = req.query.password;
    if (!login || !password) {
	return failwithone(res, [7, 'MISSING_PARAMETER']);
    }
    intra.login(login, password, function(error, result) {
	if (error) {
	    return failwithone(res, [6, 'AUTHENTICATION_FAILURE']);
	}
	sid = 'salut'; // FIXME: generate a random session ID
	sess = {'cookie': {'expires': new Date(Date.now() + 30 * 24 * 3600 * 1000)},
		'login': login,
		'password': password,
	       }
	session_store.set(sid, sess, function(err, session) {
	    res.json({'login': login, 'token': sid, 'expiration': 'never'});
	});
    });
});

app.authget("/foo", function(req, res) {
    res.json("hello, " + req.auth_info.login);
});

app.listen(8888);

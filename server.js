var express = require('express');
var app = express();
var intra = require('./intra.js');
var Sequelize = require("sequelize")

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.enable("jsonp callback");

var DEBUG = true;

var session_store = new express.session.MemoryStore;


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
app.authpost = function(path, callback) {
    this.post(path, function(req, res) {
	checkauth(req, res, callback);
    });
}
app.authdel = function(path, callback) {
    this.del(path, function(req, res) {
	checkauth(req, res, callback);
    });
}


function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
};

function makePath(path) {
    return '/api' + path;
}

app.post(makePath('/auth'), function(req, res) {
    var login = req.body.login;
    var password = req.body.password;
    if (!login || !password) {
	return failwithone(res, [7, 'MISSING_PARAMETER']);
    }
    intra.login(login, password, function(error, phpsessid, result, cookie) {
	if (error) {
	    return failwithone(res, [6, 'AUTHENTICATION_FAILURE']);
	}
	sid = generateUUID();
	sess = {'cookie': {'expires': new Date(Date.now() + 30 * 24 * 3600 * 1000)},
		'login': login,
		'password': password,
		'intra_sessid': phpsessid,
	       }
	session_store.set(sid, sess, function(err, session) {
	    res.json({'login': login, 'token': sid, 'expiration': 'never', 'intra_sessid': phpsessid});
	});
    });
});

app.del(makePath('/auth/:sid'), function(req, res) {
    var sid = req.params.sid;
    if (!sid) return failauth(res);
    session_store.destroy(sid);    
    res.json({});
});

function getUser(req, res, login) {
    // FIXME look at the "api" parameter
    intra.makeGET('/user/'+login+'/?format=json', function(response) {
	res.json(response);
    });
}

app.authget(makePath('/users'), function(req, res) { getUser(req, res, req.auth_info.login); });
app.authget(makePath('/users/:login'), function(req, res) { getUser(req, res, req.params.login); });

// app.authget(makePath('/articles/:id'), function(req, res) {
//     // FIXME: access control
//     // FIXME: escaping?
//     var id = req.params.id;
//     console.log('Blah: ' + id);
//     r = db.query(
// ' SELECT' +
// ' ar.title, ar.creation_date, ar.modification_date, ar.publication_date, ar.format, ar.content, ar.status,'+
// ' aa.login, aa.role, aa.date as date_author,'+
// ' c.name as category'+
// ' FROM      articles ar' +
// ' LEFT JOIN article_authors aa ON ar.id = aa.id_article'+
// ' LEFT JOIN categories c ON c.id = ar.id_category'+
// ' WHERE ?'+
// ' LIMIT 1', {'ar.id': id}, function(err, result) {
// 	if (err) return failwithone(res, [5, 'SQL_ERROR']);
// 	if (result && result[0]) {
// 	    retval = {};
// 	    copyAttributes(['title', 'content', 'format', 'status'], result[0], retval);
// 	    retval.dates = {};
// 	    copyAttributes(['modification_date', 'creation_date', 'publication_date'], result[0], retval.dates);
// 	    retval.authors = [];
// 	    result.forEach(function(l) {
// 		console.log('>> ' + JSON.stringify(l));
// 		if (l.login) {
// 		    retval.authors.append({'type': l.role, 'login': r.login, 'date': r.date_author});
// 		}
// 	    });
// 	    res.json(retval);
// 	} else {
// 	    return failwithone(res, [7, 'ARTICLE_NOT_EXISTS']);
// 	}
//     });
//     console.log(r.sql);
// });





var sequelize = new Sequelize('return_sequelize', 'return_sequelize', '1234');

var Cast = sequelize.define('Cast', {
    name: Sequelize.STRING
});
var Category = sequelize.define('Category', {
    name: Sequelize.STRING
});

Category.hasMany(Cast);
Cast.belongsTo(Category);

UserCast = sequelize.define('UserCast',{
    login: Sequelize.STRING
})

Cast.hasMany(UserCast);
UserCast.belongsTo(Cast);

sequelize.sync();

// FIXME - debug only
if (DEBUG) {
    app.authget('/debug/foo', function(req, res) {
	res.json("hello, " + req.auth_info.login);
    });

    app.get('/debug/restart', function(req, res) {
	process.exit(0);
	res.json('This should not happen.');
    });

    app.get('/debug/forcesync', function(req, res) {
	sequelize.sync({ force: true }).ok(function(a) { res.json("Forcesync ok"); });
    });

    app.get('/debug/populate', function(req, res) {
	Category.build({ name: 'General' }).save();
	Category.build({ name: 'Pedago' }).save().ok(function(cp) {
	    Category.build({ name: 'Labo' }).save();
	    Category.build({ name: 'Asso' }).save().ok(function(ca) {
		Cast.build({ name: 'Koala' }).setCategory(cp).ok(function(c) {
		    c.save();
		    UserCast.build({ login: 'lepage_b' }).setCast(c).ok(function(a) { a.save(); });
		    UserCast.build({ login: 'corfa_u' }).setCast(c).ok(function(a) { a.save(); });
		});
		Cast.build({ name: 'Koala Ocaml' }).setCategory(cp).ok(function(c) {
		    UserCast.build({ login: 'lepage_b' }).setCast(c).ok(function(a) { a.save(); });
		    c.save();
		});
		Cast.build({ name: 'Koala C++' }).setCategory(cp).ok(function(c) {
		    c.save();
		    UserCast.build({ login: 'corfa_u' }).setCast(c).ok(function(a) { a.save(); });
		});
		Cast.build({ name: 'Lateb' }).setCategory(ca).ok(function(c) {
		    c.save();
		    UserCast.build({ login: 'lepage_b' }).setCast(c).ok(function(a) { a.save(); });
		    UserCast.build({ login: 'corfa_u' }).setCast(c).ok(function(a) { a.save(); });
		    UserCast.build({ login: 'marand_a' }).setCast(c).ok(function(a) { a.save(); });
		});


		res.json({});
	    });
	});
    });
}

function cast_toPublic(cast_sql) {
    // return cast_sql; // FIXME
    return {
	'name': cast_sql.name,
	'category': cast_sql.category.name,
	'members': cast_sql.userCasts.map(function(o) { return o.login; })
    };
}

app.authget(makePath('/casts'), function(req, res) {
    Cast.findAll({ include: [Category, UserCast] }).ok(function(casts) {
	res.json(casts.map(cast_toPublic));
    });
});

app.authget(makePath('/casts/:id'), function(req, res) {
    Cast.find({ where: { id: req.params.id },  include: [Category, UserCast] }).ok(function(cast) {
	if (!cast) return failwithone(res, [2, 'CAST_NOT_EXIST']);
	res.json(cast_toPublic(cast));
    });
});

app.authdel(makePath('/casts/:id'), function(req, res) {
    Cast.find({ where: { id: req.params.id },  include: [Category] }).ok(function(cast) {
	if (!cast) return failwithone(res, [2, 'CAST_NOT_EXIST']);
	cast.destroy().ok(function() {
	    res.json({});
	});
    });
});

app.authpost(makePath('/casts'), function(req, res) {
    var name = req.body.name;
    var category_name = req.body.category;
    var csv_members = req.body.members;
    if (!name || !category_name) return failwithone(res, [7, 'MISSING_PARAMETER']);
    var members = [];
    if (csv_members)
	members = csv_members.split(',');
    Category.find({ where: { name: category_name }}).ok(function(category) {
	if (!category) return failwithone(res, [6, 'CATEGORY_NOT_EXIST']);
	var newcast = Cast.build({ name: name });
	newcast.save().ok(function() {
	    newcast.setCategory(category);
	    members.forEach(function(m) {
		UserCast.create({ login: m }).ok(function(uc) { uc.setCast(newcast); });
	    });
	    newcast.category = { name: category_name };
	    newcast.userCasts = [];
	    retval = cast_toPublic(newcast)
	    retval.members = members;
	    res.json(retval);
	});
    });
});

app.listen(8888);

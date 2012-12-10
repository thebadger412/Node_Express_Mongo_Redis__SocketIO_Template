
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});
  app.use(express.cookieParser());

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/*                 
  MONGODB SETUP 
*/               

var mongo = require('mongodb');
//You can either do this (heroku config -s | grep MONGLAB_URI >> .env) and then foreman start
//or add a local user variable in windows/unix and use node app.js
var mongoUri = process.env.MONGO_URL|| 
  'mongodb://localhost/mydb'; 

mongo.Db.connect(mongoUri, function (err, db) {
  db.collection('mydocs', function(er, collection) {
    collection.insert({'meh': 'derp'}, {safe: true}, function(er,rs) {
    });
  });
});

/*              
  REDIS SETUP 
*/ 

//console.log(process.env.REDIS_URL);
//REDIS_HOST and REDIS_AUTH are environment variables

var RedisStore = require('socket.io/lib/stores/redis')
  , redis  = require('socket.io/node_modules/redis')
  , pub    = redis.createClient(6379, process.env.REDIS_HOST)
  , sub    = redis.createClient(6379, process.env.REDIS_HOST)
  , client = redis.createClient(6379, process.env.REDIS_HOST)

pub.auth(process.env.REDIS_AUTH, function (err) { if (err) throw err; });
sub.auth(process.env.REDIS_AUTH, function (err) { if (err) throw err; });
client.auth(process.env.REDIS_AUTH, function (err) { if (err) throw err; });

var io = require('socket.io').listen(server);

io.set('store', new RedisStore({
  redis    : redis
, redisPub : pub
, redisSub : sub
, redisClient : client
}));

var user = 0;
io.sockets.on('connection', function (socket) {
  user = user + 1;
  socket.user = user;
  socket.emit('user id:', user);
  client.sadd('users', user);
  client.multi().smembers('users').exec(function (err, replies) {
    console.log("REPLIES ===== " + replies)
    io.sockets.emit('nusers', replies[0].length, replies[0].toString());
  });
  socket.on('disconnect', function () {
    client.srem('users',socket.user);
    console.log('user disconnected')
    client.multi().smembers('users').exec(function (err, replies) {
      io.sockets.emit('nusers', replies[0].length, replies[0].toString());
    });
  });
});

//Just checking if client has already been defined
//and closing it if it is
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
  if (typeof(client) === 'undefined') {
    // variable is undefined
  }
  else{
    client.quit();
  }
});
process.on('exit', function (err) {
  console.log('Caught exception: ' + err);
  if (typeof(client) === 'undefined') {
    // variable is undefined
  }
  else{
    client.quit();
  }
});
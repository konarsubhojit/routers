var server = require('./server');
var router = require('./routers');
var handlers = require('./handlers');

var handle = {};
handle['/'] = handlers.home;
handle['/newpage'] = handlers.newpage;
handle['/register'] = handlers.register;

server.startServer(router.route,handle,3000);
                  
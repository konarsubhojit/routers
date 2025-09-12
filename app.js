var server = require('./server');
var router = require('./routers');
var handlers = require('./handlers');

var handle = {};
handle['/'] = handlers.home;
handle['/newpage'] = handlers.newpage;
handle['/register'] = handlers.register;

// New cool API routes
handle['/api/time'] = handlers.apiTime;
handle['/api/random'] = handlers.apiRandom;
handle['/api/facts'] = handlers.apiFacts;
handle['/api/counter'] = handlers.apiCounter;
handle['/api/docs'] = handlers.apiDocs;

// Parameterized routes
handle['/reverse/:text'] = handlers.reverseText;
handle['/color/:hex'] = handlers.colorPreview;

server.startServer(router.route,handle,3000);
                  
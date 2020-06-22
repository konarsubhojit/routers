var http = require('http');
var url = require('url');
var qs = require('querystring');
var event = require('events');
const path = require('path');
const fs = require('fs');
var eventEmitter = new event.EventEmitter();

let counter = 0;

function startServer(route,handle,port){
  http.createServer(function (req, res) {
    console.log(`${req.method} ${req.url}`);
    // parse URL
    const parsedUrl = url.parse(req.url);
    // extract URL path
    let pathname = `${parsedUrl.pathname}`;
    // based on the URL path, extract the file extention. e.g. .js, .doc, ...
    const ext = path.parse(pathname).ext;
    pathname = pathname.replace('^.','');
    var data = '';
    req.addListener('data',
      function readData(chunk) {
        data += chunk;
      }
    );
    req.addListener('end',
      function listener(){
        data = qs.parse(data);
        if(pathname.match("^(/includes)")){
          console.log("matched");
          // maps file extention to MIME typere
          const map = {
            '.ico': 'image/x-icon',
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword'
          };
          const regex = /^\/includes\//;
          pathname = pathname.replace(regex,'./');
          
          fs.exists(pathname, function (exist) {
            if(!exist) {
              route(handle,pathname,data,res);
              return;
            }

            // if is a directory search for index file matching the extention
            if (fs.statSync(pathname).isDirectory()) route(handle,pathname,data,res);

            // read file from file system
            fs.readFile(pathname, function(err, data){
              if(err){
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
              } else {
                // if the file is found, set Content-type and send data
                res.setHeader('Content-type', map[ext] || 'text/plain' );
                res.end(data);
              }
            });
          });
        }
        else{
          route(handle,pathname,data,res);
        }
      }
    );
    console.log("No. of requests recieved: " + ++counter);
  }).listen(port);
}

exports.startServer = startServer;


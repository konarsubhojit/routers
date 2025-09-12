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
    
    // Add basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
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
        try {
          data = qs.parse(data);
        } catch (err) {
          console.error('Error parsing request data:', err);
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }
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
          
            fs.access(pathname, fs.constants.F_OK, function (err) {
            if(err) {
              route(handle,pathname,data,res,req);
              return;
            }

            fs.stat(pathname, function(err, stats) {
              if(err) {
                route(handle,pathname,data,res,req);
                return;
              }

              // if is a directory search for index file matching the extension
              if (stats.isDirectory()) {
                route(handle,pathname,data,res,req);
                return;
              }

              // read file from file system
              fs.readFile(pathname, function(err, fileData){
                if(err){
                  res.statusCode = 500;
                  res.end(`Error getting the file: ${err}.`);
                } else {
                  // if the file is found, set Content-type and send data
                  res.setHeader('Content-type', map[ext] || 'text/plain' );
                  res.end(fileData);
                }
              });
            });
          });
        }
        else{
          route(handle,pathname,data,res,req);
        }
      }
    );
    console.log("No. of requests received: " + ++counter);
  }).listen(port, function() {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

exports.startServer = startServer;


const url = require('url');
const fs = require('fs');
const path = require('path');
var route = require('./routers').route;

const pug = require('pug');
const message = pug.compileFile('message.pug');
const form = pug.compileFile('register.pug');

function home(data,res,handle){
    console.log("Handling home request");
    fs.readFile('index.html','utf8', function(err, htmlFile) {
        if(err) {
            res.writeHead(500,{"Content-Type": "text/plain"});
            res.end('Internal Server Error');
            return;
        }
        res.writeHead(200,{"Content-Type": "text/html"});
        res.write(htmlFile);
        res.end();
    });
}

function newpage(data,res,handle){
    console.log("Handling newpage request");
    if(!data.fname || !data.lname || data.fname.trim() === '' || data.lname.trim() === ''){
        console.log("Requested /newpage without valid data. Redirecting..");
        res.writeHead(302,{"Location":"/"});
        res.write("Redirecting to home page...");
    } else{
        res.writeHead(200,{"Content-Type": "text/html"});
        // Sanitize input to prevent XSS
        var fname = data.fname.toString().trim().slice(0, 50);
        var lname = data.lname.toString().trim().slice(0, 50);
        var name = fname + ' ' + lname;
        res.write(message({name: name}));
    }
    res.end();
}

function register(data,res,handle){
    console.log("Handling register request");
    if(data.submit == undefined){
        res.writeHead(200,{"Content-Type": "text/html"});
        res.write(form());
    } else{
        var userData = JSON.stringify({
            name : data.name,
            email : data.email,
            favoriteBook : data.favoriteBook
        });
        console.log(userData);
        res.writeHead(200,{"Content-Type": "application/json"});
        res.write(userData);
    }
    res.end();
}

//exports.includes = includes;
exports.register = register; 
exports.home = home;
exports.newpage = newpage;
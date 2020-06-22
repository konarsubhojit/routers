const url = require('url');
const fs = require('fs');
const path = require('path');
var route = require('./routers').route;

const pug = require('pug');
const message = pug.compileFile('message.pug');
const form = pug.compileFile('register.pug');

function home(data,res,handle){
    console.log("Handling home request");
    var htmlFile = fs.readFileSync('index.html','utf8');
    res.writeHead(200,{"Content-Type": "text/html"});
    res.write(htmlFile);
    res.end();
}

function newpage(data,res,handle){
    console.log("Handling newpage request");
    if(data.fname == undefined || data.lname == undefined){
        console.log("Requested /newpage without data. Redirecting..");
        res.writeHead(302,{"Location":"/"});
        res.write("Redirecting to home page...");
    } else{
        res.writeHead(200,{"Content-Type": "text/html"});
        var name = data.fname + ' ' + data.lname;
        res.write(message({name: name}));
        res.end();
    }
}

function register(data,res,handle){
    console.log("Handling register request");
    if(data.submit == undefined){
        res.write(form());
    } else{
        var data = JSON.stringify({
            name : data.name,
            email : data.email,
            favoriteBook : data.favoriteBook
        });
        console.log(data);
        res.write(data);
    }
    res.end();
}

//exports.includes = includes;
exports.register = register; 
exports.home = home;
exports.newpage = newpage;
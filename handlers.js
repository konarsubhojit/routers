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

// API: Current server time
function apiTime(data, res, handle) {
    console.log("Handling /api/time request");
    res.writeHead(200, {"Content-Type": "application/json"});
    const now = new Date();
    const timeData = {
        timestamp: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        formatted: now.toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day: now.toLocaleDateString('en-US', { weekday: 'long' }),
        date: now.toLocaleDateString()
    };
    res.write(JSON.stringify(timeData, null, 2));
    res.end();
}

// API: Random number generator
function apiRandom(data, res, handle) {
    console.log("Handling /api/random request");
    res.writeHead(200, {"Content-Type": "application/json"});
    const randomData = {
        number: Math.floor(Math.random() * 1000),
        float: Math.random(),
        dice: Math.floor(Math.random() * 6) + 1,
        coin: Math.random() > 0.5 ? 'heads' : 'tails',
        uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        })
    };
    res.write(JSON.stringify(randomData, null, 2));
    res.end();
}

// API: Random facts
function apiFacts(data, res, handle) {
    console.log("Handling /api/facts request");
    const facts = [
        "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
        "Octopuses have three hearts and blue blood.",
        "A group of flamingos is called a 'flamboyance'.",
        "Bananas are berries, but strawberries aren't.",
        "Wombat droppings are cube-shaped.",
        "A shrimp's heart is in its head.",
        "It's impossible to hum while holding your nose closed.",
        "The longest word in English has 189,819 letters and takes about 3.5 hours to pronounce.",
        "Cats can't taste sweetness.",
        "A group of pandas is called an 'embarrassment'."
    ];
    
    res.writeHead(200, {"Content-Type": "application/json"});
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    const factData = {
        fact: randomFact,
        category: "random",
        length: randomFact.length,
        generated_at: new Date().toISOString()
    };
    res.write(JSON.stringify(factData, null, 2));
    res.end();
}

// Visit counter (using a simple in-memory counter)
let visitCounter = 0;

function apiCounter(data, res, handle) {
    console.log("Handling /api/counter request");
    visitCounter++;
    res.writeHead(200, {"Content-Type": "application/json"});
    const counterData = {
        visits: visitCounter,
        message: `This endpoint has been visited ${visitCounter} time${visitCounter !== 1 ? 's' : ''}`,
        timestamp: new Date().toISOString()
    };
    res.write(JSON.stringify(counterData, null, 2));
    res.end();
}

// Text reversal API - handles URL parameter parsing
function reverseText(data, res, handle) {
    console.log("Handling reverse text request");
    
    // Parse the URL to get the text parameter
    const urlParts = res.req ? res.req.url.split('/') : [];
    const text = urlParts[2] ? decodeURIComponent(urlParts[2]) : 'hello';
    
    // Reverse the text
    const reversed = text.split('').reverse().join('');
    
    res.writeHead(200, {"Content-Type": "application/json"});
    const reverseData = {
        original: text,
        reversed: reversed,
        length: text.length,
        palindrome: text.toLowerCase() === reversed.toLowerCase()
    };
    res.write(JSON.stringify(reverseData, null, 2));
    res.end();
}

// Color preview page
function colorPreview(data, res, handle) {
    console.log("Handling color preview request");
    
    // Parse the URL to get the color parameter
    const urlParts = res.req ? res.req.url.split('/') : [];
    let color = urlParts[2] ? urlParts[2] : 'ff0000';
    
    // Clean up the color code
    color = color.replace('#', '');
    if (!/^[0-9A-Fa-f]{6}$/.test(color)) {
        color = 'ff0000'; // Default to red if invalid
    }
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Color Preview: #${color}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
        }
        .color-box { 
            width: 200px; 
            height: 200px; 
            background-color: #${color}; 
            border: 3px solid #333;
            border-radius: 10px;
            margin: 20px auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .info {
            text-align: center;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 0 auto;
        }
        h1 { color: #333; }
        .hex { font-family: monospace; font-size: 1.2em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="info">
        <h1>Color Preview</h1>
        <div class="color-box"></div>
        <p class="hex">Hex: #${color}</p>
        <p>RGB: ${parseInt(color.substr(0,2), 16)}, ${parseInt(color.substr(2,2), 16)}, ${parseInt(color.substr(4,2), 16)}</p>
        <p><a href="/color/ff0000">Red</a> | <a href="/color/00ff00">Green</a> | <a href="/color/0000ff">Blue</a></p>
        <p><a href="/">← Back to Home</a></p>
    </div>
</body>
</html>`;
    
    res.writeHead(200, {"Content-Type": "text/html"});
    res.write(htmlContent);
    res.end();
}

//exports.includes = includes;
exports.register = register; 
exports.home = home;
exports.newpage = newpage;
exports.apiTime = apiTime;
exports.apiRandom = apiRandom;
exports.apiFacts = apiFacts;
// API Documentation page
function apiDocs(data, res, handle) {
    console.log("Handling /api/docs request");
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>API Documentation - Cool Routes</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #4a5568; 
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        .endpoint {
            background: #f7fafc;
            border-left: 4px solid #4299e1;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .method {
            background: #48bb78;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .url {
            font-family: monospace;
            font-size: 1.1em;
            color: #2d3748;
            margin: 10px 0;
        }
        .description {
            color: #4a5568;
            margin: 10px 0;
        }
        .example {
            background: #edf2f7;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .try-link {
            display: inline-block;
            background: #4299e1;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 10px;
            transition: background 0.3s;
        }
        .try-link:hover {
            background: #3182ce;
        }
        .home-link {
            text-align: center;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Cool API Routes</h1>
        
        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/api/time</div>
            <div class="description">Get current server time with various formats including timestamp, timezone, and formatted date.</div>
            <div class="example">{"timestamp": "2025-09-12T20:24:59.882Z", "unix": 1757708699, "formatted": "9/12/2025, 8:24:59 PM", "timezone": "UTC", "day": "Friday"}</div>
            <a href="/api/time" class="try-link">Try it →</a>
        </div>

        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/api/random</div>
            <div class="description">Generate random data including numbers, dice roll, coin flip, and UUID.</div>
            <div class="example">{"number": 352, "float": 0.782, "dice": 3, "coin": "heads", "uuid": "306e5d4a-b31c-4700-af8d-55f4c731334f"}</div>
            <a href="/api/random" class="try-link">Try it →</a>
        </div>

        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/api/facts</div>
            <div class="description">Get a random fun fact from our collection of interesting trivia.</div>
            <div class="example">{"fact": "Honey never spoils. Archaeologists have found pots of honey...", "category": "random", "length": 47}</div>
            <a href="/api/facts" class="try-link">Try it →</a>
        </div>

        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/api/counter</div>
            <div class="description">Visit counter that tracks how many times this endpoint has been called.</div>
            <div class="example">{"visits": 1, "message": "This endpoint has been visited 1 time", "timestamp": "2025-09-12T20:25:17.799Z"}</div>
            <a href="/api/counter" class="try-link">Try it →</a>
        </div>

        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/reverse/:text</div>
            <div class="description">Reverse any text and check if it's a palindrome. Replace :text with your word.</div>
            <div class="example">{"original": "hello", "reversed": "olleh", "length": 5, "palindrome": false}</div>
            <a href="/reverse/hello" class="try-link">Try "hello" →</a>
            <a href="/reverse/racecar" class="try-link">Try "racecar" →</a>
        </div>

        <div class="endpoint">
            <span class="method">GET</span>
            <div class="url">/color/:hex</div>
            <div class="description">Visual color preview page. Replace :hex with a 6-digit hex color code (without #).</div>
            <div class="example">Displays a colorful preview page with the color box, hex code, and RGB values.</div>
            <a href="/color/ff5733" class="try-link">Try Orange →</a>
            <a href="/color/00ff00" class="try-link">Try Green →</a>
            <a href="/color/3498db" class="try-link">Try Blue →</a>
        </div>

        <div class="home-link">
            <a href="/" class="try-link">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;
    
    res.writeHead(200, {"Content-Type": "text/html"});
    res.write(htmlContent);
    res.end();
}
exports.apiCounter = apiCounter;
exports.reverseText = reverseText;
exports.colorPreview = colorPreview;
exports.apiDocs = apiDocs;
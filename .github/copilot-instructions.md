# Node.js Router Web Application
Node.js web application with custom routing system, HTTP server, and Pug templates. Serves HTML forms for user registration and data collection with static file support.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively
- Bootstrap and run the application:
  - `npm install` -- takes ~5 seconds. NEVER CANCEL.
  - `npm start` -- starts server immediately on http://localhost:3000
- The application has NO test suite configured:
  - `npm test` -- fails with "Error: no test specified"
  - DO NOT attempt to run tests as none exist
- The application has NO linting tools configured:
  - DO NOT run eslint, prettier, or other linting commands
  - Code follows basic JavaScript conventions
- Build/compile steps: NONE REQUIRED
  - This is a runtime Node.js application
  - No transpilation or bundling needed
  - Static files served directly

## Validation
- ALWAYS manually validate changes by running complete user scenarios:
  - Start server with `npm start`
  - Test home page: `curl http://localhost:3000/`
  - Test registration form: `curl http://localhost:3000/register`
  - Test form submission: `curl -X POST -d "fname=John&lname=Doe" http://localhost:3000/newpage`
  - Test registration data: `curl -X POST -d "name=John Doe&email=john@example.com&favoriteBook=Test&submit=true" http://localhost:3000/register`
  - Test static files: `curl http://localhost:3000/includes/scripts.js`
  - Test error handling: `curl http://localhost:3000/nonexistent` (should return 404)
  - Test validation: `curl -X POST -d "fname=" http://localhost:3000/newpage` (should redirect with 302)
- ALWAYS test that the server starts without errors before finishing changes
- ALWAYS verify HTTP responses return expected HTML/JSON content
- The application serves on port 3000 by default - ensure this port is available
- **Complete End-to-End Testing**: After changes, fill out forms in browser to test full user flows

## Application Structure
- **app.js** - Main entry point, defines routes and starts server
- **server.js** - HTTP server implementation with static file handling
- **routers.js** - Simple routing function that maps URLs to handlers
- **handlers.js** - Route handlers for /, /newpage, /register endpoints
- **index.html** - Home page with simple form for name collection
- **message.pug** - Template for displaying user name after form submission  
- **register.pug** - Registration form template with Bootstrap styling
- **scripts.js** - Client-side JavaScript for password validation
- **package.json** - Dependencies: http, pug, router, url packages

## Key Routes and Functionality
- **/** - Serves index.html form for first/last name collection
- **/newpage** - POST endpoint processes form data and shows greeting using Pug template
- **/register** - GET shows registration form, POST processes registration and returns JSON
- **/includes/** - Static file serving for JavaScript, CSS, images, etc.

## Common Tasks
- **Start development server**: `npm start` (immediate startup)
- **Install dependencies**: `npm install` (5 seconds)
- **View application**: Navigate to http://localhost:3000 after starting
- **Stop server**: Use Ctrl+C in terminal where npm start is running

## Important Notes
- NO build process required - application runs directly with Node.js
- NO test suite exists - manual validation is required
- NO CI/CD pipeline configured
- Server includes basic security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Form data is sanitized to prevent XSS attacks
- Static files must be placed relative to project root and accessed via /includes/ path
- Pug templates are compiled at runtime when handlers.js loads
- Registration form uses Bootstrap CSS from CDN (may not load in restricted environments)
- External CDN resources may be blocked in some environments - functionality works without styling

## Dependencies and Requirements
- **Node.js**: Any recent version (tested with v20.19.5)
- **npm**: Any recent version (tested with 10.8.2)
- **Required packages**: Automatically installed via npm install
  - http@0.0.0
  - pug@^3.0.3  
  - router@^2.2.0
  - url@^0.11.0

## Troubleshooting
- If server fails to start, check that port 3000 is available
- If static files don't load, ensure they're accessible via /includes/ URL path
- If forms don't submit correctly, verify POST data format matches handler expectations
- The deprecation warning about querystring is expected and does not affect functionality
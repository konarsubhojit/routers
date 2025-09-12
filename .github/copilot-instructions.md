# Node.js Routers Web Application

This is a Node.js web application implementing custom HTTP routing and form handling functionality. The application serves static HTML forms, processes user input, and renders responses using Pug templates.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Dependencies
- Install dependencies: `npm install` -- takes 3 seconds. NEVER CANCEL. Set timeout to 15+ seconds for safety.
- Run the application: `npm start` -- starts immediately and runs on http://localhost:3000
- Stop the application: Use Ctrl+C in the terminal running the server

### Development Workflow
- ALWAYS run `npm install` after cloning or when package.json changes
- ALWAYS test your changes by running the full application with `npm start`
- ALWAYS validate functionality through the web interface at http://localhost:3000

### Manual Testing Requirements
After making ANY changes to the application code, you MUST test these scenarios:
1. **Home Page Form**: Navigate to http://localhost:3000, fill in first name and last name fields, submit form, verify greeting page displays "Hello [First] [Last]"
2. **Registration Form**: Navigate to http://localhost:3000/register, fill in all fields (name, email, favorite book, matching passwords), submit form, verify JSON response contains the submitted data
3. **Static File Serving**: Verify http://localhost:3000/includes/scripts.js returns the JavaScript file content
4. **404 Handling**: Test a non-existent URL like http://localhost:3000/nonexistent and verify it returns 404

## Application Architecture

### Key Files and Their Purposes
- `app.js` -- Application entry point, sets up routes and starts server on port 3000
- `server.js` -- Core HTTP server implementation with custom routing and static file serving
- `routers.js` -- Simple routing logic that dispatches requests to handlers
- `handlers.js` -- Route handlers for home (/), newpage (/newpage), and register (/register) endpoints
- `index.html` -- Main page with form for first/last name input
- `message.pug` -- Pug template for displaying greeting after form submission
- `register.pug` -- Pug template for user registration form with Bootstrap styling
- `scripts.js` -- Client-side JavaScript for password validation on registration form
- `package.json` -- Project dependencies and npm scripts

### Important Implementation Details
- Server runs on port 3000 (hardcoded in app.js)
- Static files are served from URLs matching `/includes/*` pattern and mapped to local files
- Form data is parsed using Node.js querystring module
- Security headers are automatically added: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- Input sanitization is performed on form submissions (trimming, length limits)

## Testing and Validation

### No Automated Testing
- The project has NO unit tests, integration tests, or automated testing framework
- The npm test script exists but only echoes an error message and exits with code 1
- DO NOT attempt to run `npm test` as it will fail by design
- All validation must be done manually through the web interface

### No Linting Configuration  
- The project has NO ESLint, JSHint, or other linting tools configured
- DO NOT run linting commands as they are not set up
- Follow the existing code style when making changes

### Manual Validation Steps
When making changes, ALWAYS perform these validation steps:
1. Start the server with `npm start`
2. Open browser to http://localhost:3000
3. Test the main form: enter "Test" and "User", submit, verify "Hello Test User" appears
4. Navigate to http://localhost:3000/register
5. Fill all registration fields with valid data, ensure passwords match, submit
6. Verify JSON response contains the submitted user data
7. Test static file access: http://localhost:3000/includes/scripts.js should return JavaScript content
8. Test 404 handling: http://localhost:3000/invalid should return 404

## Common Development Tasks

### Adding New Routes
1. Add route handler function to `handlers.js`
2. Export the handler in `handlers.js`
3. Import and map the handler in `app.js` in the `handle` object
4. Test the new route manually in browser

### Modifying Templates
- Edit `.pug` files for HTML structure changes
- Remember that Pug uses indentation-sensitive syntax
- Test template changes by submitting forms that render those templates

### Static File Changes
- Place static files in the repository root
- Access them via `/includes/filename` URL pattern
- Test static file serving after changes

### Server Configuration Changes
- Modify `server.js` for HTTP server behavior changes
- Restart server after any server.js changes
- Test all endpoints after server changes

## Troubleshooting

### Common Issues and Solutions
- **Port 3000 already in use**: Kill any existing Node.js processes or use a different port by modifying app.js
- **Form submission not working**: Check that form method="post" and action points to correct endpoint
- **Static files not loading**: Verify file exists in root directory and URL uses `/includes/` prefix
- **Pug template errors**: Check indentation and syntax in .pug files
- **Server won't start**: Ensure all dependencies are installed with `npm install`

### Dependencies and Environment
- **Node.js version**: Application works with Node.js v20.19.5+ (currently tested version)
- **NPM version**: Works with npm 10.8.2+ (currently tested version)
- **Operating System**: Cross-platform (tested on Linux)
- **External dependencies**: Requires internet access for Bootstrap CDN resources in register.pug

### File Structure Reference
```
/
├── .github/
│   └── copilot-instructions.md
├── node_modules/ (after npm install)
├── .gitignore
├── .vscode/ (IDE configuration)
├── a.out (unrelated binary file, ignore)
├── app.js (main entry point)
├── handlers.js (route handlers)
├── index.html (home page)
├── message.pug (greeting template)
├── package.json (dependencies)
├── package-lock.json (dependency lock file)
├── register.pug (registration form template)
├── routers.js (routing logic)
├── scripts.js (client-side JavaScript)
└── server.js (HTTP server implementation)
```

## Commands Reference
All commands should be run from the repository root directory.

### Setup Commands
```bash
npm install           # Install dependencies (3 seconds)
```

### Runtime Commands
```bash
npm start            # Start server on http://localhost:3000
# Use Ctrl+C to stop the server
```

### Manual Testing URLs
- http://localhost:3000/ -- Main form page
- http://localhost:3000/register -- Registration form  
- http://localhost:3000/includes/scripts.js -- Static JavaScript file
- http://localhost:3000/nonexistent -- Should return 404

ALWAYS test these URLs after making changes to ensure functionality remains intact.
function route(handle,pathname,data,res,req){
  console.log("Routing path:" + pathname);
  
  // Store the request object in response for handlers to access URL
  if(res && req) {
    res.req = req;
  }
  
  // Check for exact match first
  if(typeof(handle[pathname]) === 'function'){
    handle[pathname](data,res,handle);
    return;
  }
  
  // Check for parameterized routes
  for(let routePath in handle){
    if(routePath.includes(':')){
      const routeParts = routePath.split('/');
      const pathParts = pathname.split('/');
      
      if(routeParts.length === pathParts.length){
        let match = true;
        for(let i = 0; i < routeParts.length; i++){
          if(routeParts[i].startsWith(':')) continue; // Parameter placeholder
          if(routeParts[i] !== pathParts[i]) {
            match = false;
            break;
          }
        }
        if(match){
          handle[routePath](data,res,handle);
          return;
        }
      }
    }
  }
  
  // No match found
  res.writeHead(404);
  res.end();
}

exports.route = route;
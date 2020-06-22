function route(handle,pathname,data,res){
  console.log("Routing path:" + pathname);
  if(typeof(handle[pathname]) === 'function'){
    handle[pathname](data,res,handle);
  } else{
    res.writeHead(404);
    res.end();
  }
}

exports.route = route;
document.onload = function () {
    var p = document.getElementById("p");
    var cp = document.getElementById("cp");
    
    cp.onkeypress = function () {
        if(p != cp){
            document.getElementById("warn").innerText = "Passwords doesn't match!";
        }
    }
}
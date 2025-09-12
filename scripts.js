document.addEventListener('DOMContentLoaded', function () {
    var p = document.getElementById("p");
    var cp = document.getElementById("cp");
    var warn = document.getElementById("warn");
    
    if (cp && p && warn) {
        cp.addEventListener('keyup', function () {
            if(p.value !== cp.value && cp.value !== ''){
                warn.innerText = "Passwords don't match!";
                warn.style.color = "red";
            } else {
                warn.innerText = "";
            }
        });

        p.addEventListener('keyup', function () {
            if(p.value !== cp.value && cp.value !== ''){
                warn.innerText = "Passwords don't match!";
                warn.style.color = "red";
            } else {
                warn.innerText = "";
            }
        });
    }
});
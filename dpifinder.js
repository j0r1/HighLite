var DPIFinder = (function()
{
    var dpiFinderExecuted = false;

    return function(callBack)
    {
        if (!dpiFinderExecuted)
        {
            dpiFinderExecuted = true;

            var styleLines = [ ];
            var maxDpi = 2000;
            
            function byteToHex(x) {
                var s = x.toString(16);
                if (s.length < 2)
                    s = "0" + s;
                return s;
            }

            for (var i = 0 ; i < maxDpi ; i++)
            {
                var r = (i+1)&0xff;
                var g = ((i+1)>>8)&0xff;
                var b = ((i+1)>>16)&0xff;
                var color = byteToHex(r) + byteToHex(g) + byteToHex(b);

                styleLines.push("@media (min-resolution:" + i + "dpi) { #dpifinder { background-color: #" + color + "; } }");
            }
            
            styleLines.push("@media (min-resolution:" + maxDpi + "dpi) { #dpifinder { background-color: #ffffff; } }");

            var styleStr = styleLines.join("\n");
            var elem = document.createElement("style");

            elem.innerHTML = styleStr;
            document.head.appendChild(elem);
        }

        setTimeout(function() {
            var elem = document.createElement("div");
            elem.setAttribute("id", "dpifinder");
            elem.style.display = "none";
            elem.innerHTML = "DPIFinder";

            document.body.appendChild(elem);

            var colCode = jQuery("#dpifinder").css("background-color");
            var idx1 = colCode.indexOf("(");
            var idx2 = colCode.indexOf(",",idx1+1);
            var idx3 = colCode.indexOf(",",idx2+1);
            var idx4 = colCode.indexOf(")",idx3+1);

            var r = parseInt(colCode.substring(idx1+1,idx2));
            var g = parseInt(colCode.substring(idx2+1,idx3));
            var b = parseInt(colCode.substring(idx3+1,idx4));

            var dpi = (r | (g<<8) | (b<<16)) - 1;

            if (dpi < 1 || dpi >= maxDpi)
                dpi = -1;

            callBack(dpi);
        }, 0);
    }
})();


/*
 * This is some code to debug what was going on when an interval timer suddenly
 * stopped.
 *
(function()
{
    var oldClearInterval = window.clearInterval;

    window.clearInterval = function(id)
    {
        console.log("Calling clearInterval with timer " + id);
        oldClearInterval(id);
    }
})();
*/

function Log(s)
{
    console.log(s);

    var elem = document.getElementById("log");
    elem.innerHTML += textToHTML(s) + "<br>";
    elem.scrollTop = elem.scrollHeight;
}

function startsWith(s, start, caseInsensitive)
{
    if (caseInsensitive)
    {
        if (s.substr(0, start.length).toLowerCase() == start.toLowerCase())
            return true;
    }
    else
    {
        if (s.substr(0, start.length) == start)
            return true;
    }
    return false;
}

function endsWith(s, end, caseInsensitive)
{
    var l = s.length;

    if (l < end.length)
        return false;

    var startIdx = l-end.length;

    if (caseInsensitive)
    {
        if (s.substr(startIdx).toLowerCase() == end.toLowerCase())
            return true;
    }
    else
    {
        if (s.substr(startIdx) == end)
            return true;
    }

    return false;
}

function textToHTML(text)
{
    return ((text || "") + "")  // make sure it's a string;
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\t/g, "    ")
        .replace(/ /g, "&#8203;&nbsp;&#8203;")
        .replace(/\r\n|\r|\n/g, "<br />");
}


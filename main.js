var generalOpenDlg = null;
var pageCache = null;
var pdfOpenDlg = null;
var pdfRenderDlg = null;
var settingsModified = false;

var currentPage = null;
var curFileName = null;

function validateFileName(name)
{
    if (!endsWith(name, ".pdf", true))
        throw "Filename does not end with '.pdf'";
}

function createInfoDialog(html)
{
    document.body.style.pointerEvents = "none";
    var dlg = vex.dialog.open({
                message: html, 
                showCloseButton: false, 
                buttons: [],
                });
    return dlg;
}

function closeInfoDialog(dlg)
{
    vex.close(dlg.data().vex.id);
    document.body.style.pointerEvents = "";
}

function onPDFDataLoaded(pdfData, identifier)
{
    if (pageCache)
        pageCache.destroy();

    currentPage = null;
    pageCache = null;

    var pdfRenderer = new PDFRenderer(pdfData);

    pdfRenderer.onLoaded = function()
    {
        closeInfoDialog(pdfOpenDlg);
        pdfOpenDlg = null;

        pageCache = new PageCache(pdfRenderer);
        Log("Number of pages: " + pdfRenderer.getNumberOfPages());

        curFileName = identifier;

        var lastKnownPage = loadSettings();
        var resetPage = true;

        if (lastKnownPage === undefined)
            lastKnownPage = 0;
        else
            resetPage = false;

        resetFileInput();
        showPage(lastKnownPage, resetPage);
    }

    pdfRenderer.onError = function(err, msg)
    {
        if (pdfOpenDlg)
        {
            closeInfoDialog(pdfOpenDlg);
            pdfOpenDlg = null;
        }
        vex.dialog.alert("PDF error: error during '" + err + "': " + msg);
    }
}

function onPDFFileSelected(files)
{
    vex.close(generalOpenDlg.data().vex.id);

    try
    {
        if (files.length != 1)
            throw "Precisely one file must be selected";

        var file = files[0];

        validateFileName(file.name);

        var reader = new FileReader();
        
        reader.onload = function(e)
        {
            onPDFDataLoaded(e.target.result, "file://" + file.name);
        }
    	reader.onerror = function(s)
    	{
            if (pdfOpenDlg)
            {
                closeInfoDialog(pdfOpenDlg);
                pdfOpenDlg = null;
            }
            var msg = "Unknown error";
            try { msg = "" + reader.error.message; } catch(e) { }
            vex.dialog.alert("Error opening file:<br>" + textToHTML(msg));
    	}
        reader.readAsArrayBuffer(file);
        
        pdfOpenDlg = createInfoDialog("Loading PDF file...");
    }
    catch(err)
    {
        if (pdfOpenDlg)
        {
            closeInfoDialog(pdfOpenDlg);
            pdfOpenDlg = null;
        }
        vex.dialog.alert("Error: " + textToHTML(err));
    }
}

function showPage(num, resetPage)
{
    if (!pageCache)
    {
        Log("PageCache not set");
        return;
    }

    var numPages = pageCache.getNumberOfPages();
    if (num < 0 || num >= numPages)
    {
        Log("Invalid page number " + num);
        return;
    }

    var r = pageCache.setCurrentPage(num);

    r.done = function(p)
    {
        if (pdfRenderDlg)
        {
            closeInfoDialog(pdfRenderDlg);
            pdfRenderDlg = null;
        }

        currentPage = p;

        pageDisplay.setImage(p.getImage());
        pageDisplay.setTransform(p.getTransform());
        pageDisplay.setHighlight(p.getHighlight());
        pageDisplay.setBarPosition(p.getBarPosition());
    
        pageDisplay.setBarWidth(barSize);
        pageDisplay.setScaleAndOffset(zoom, offsetX, offsetY);

        $("#showingpage").css("display","");
        $("#showingpagenum").text("" + (p.getPageIndex()+1) + "/" + numPages);

        if (resetPage)
            reset();

        settingsModified = true;
    }

    r.rendering = function()
    {
        pdfRenderDlg = createInfoDialog("Rendering page " + (num+1) + "/" + numPages + "<span id='renderingpagenumspan'></span>");
    }

    r.error = function(msg)
    {
        if (pdfRenderDlg)
        {
            closeInfoDialog(pdfRenderDlg);
            pdfRenderDlg = null;
        }

        vex.dialog.alert("PDF error: error rendering page: " + msg);
    }
}

function prevPage()
{
    if (!currentPage)
        return;
    
    var idx = currentPage.getPageIndex();
    if (idx <= 0)
        return;

    showPage(idx-1);
}

function nextPage()
{
    if (!currentPage)
        return;
    if (!pageCache)
        return;
    
    var idx = currentPage.getPageIndex();
    if (idx >= pageCache.getNumberOfPages())
        return;
    
    showPage(idx+1);
}

function gotoPage()
{
    if (!pageCache)
        return;

    var numPages = pageCache.getNumberOfPages();

    vex.dialog.prompt({
        message: 'Enter page number:',
        placeholder: '1',
        callback: function(value)
        {
            if (value === false)
                return;

            try
            {
                var page = parseInt(value);
                if (page < 1)
                    page = 1;
                else if (page >= numPages)
                    page = numPages;

                showPage(page-1); // index is one less
            }
            catch(e)
            {
                // Ignore
            }
        }
    });
}

function rotate()
{
    if (!currentPage)
        return;

    currentPage.increaseTransform();
    pageDisplay.setTransform(currentPage.getTransform());

    settingsModified = true;
}

var barSize = 10.0;
var offsetX = 0;
var offsetY = 0;
var zoom = 1.0;

function onMouseMove(dx, dy)
{
    offsetX += dx/zoom;
    offsetY += dy/zoom;
    pageDisplay.setOffset(offsetX, offsetY);

    settingsModified = true;
}

function onMouseScroll(dz, xc, yc)
{
    var s1 = zoom;

    if (dz > 0)
    {
        if (zoom < 10.0)
            zoom *= 1.2;
    }
    else
    {
        if (zoom > 0.1)
            zoom /= 1.2;
    }
    
    if (Math.abs(zoom-1.0) < 0.00001)
        zoom = 1.0;

    var s2 = zoom;

    offsetX += (xc/s1)*(s1/s2-1.0);
    offsetY += (yc/s1)*(s1/s2-1.0);

    pageDisplay.setScaleAndOffset(zoom, offsetX, offsetY);

    settingsModified = true;
}

function onBarMove(dx, dy)
{
    if (!currentPage)
        return;

    if (currentPage.getHighlight())
    {
        currentPage.addBarPosition(dy/zoom);
        pageDisplay.setBarPosition(currentPage.getBarPosition());

        settingsModified = true;
    }
}

var minBarSize = 0.1;
var maxBarSize = 256.0;

function updateBarSize()
{
    if (barSize < minBarSize)
        barSize = minBarSize;
    else if (barSize > maxBarSize)
        barSize = maxBarSize;

    pageDisplay.setBarWidth(barSize);
}

function onBarZoom(dz, xc, yc)
{
    if (!currentPage)
        return;

    if (currentPage.getHighlight())
    {
        barSize += dz/zoom;
        updateBarSize();

        settingsModified = true;
    }
}

function highlight()
{
    if (!currentPage)
        return;

    currentPage.toggleHighlight();
    pageDisplay.setHighlight(currentPage.getHighlight());

    settingsModified = true;
}

var savedOffX = 0;
var savedOffY = 0;
var inDrag = false;

function reset()
{
    if (pageDisplay && currentPage)
    {
        var img = currentPage.getImage();
        zoom = pageDisplay.getWidth()/img.width;
    }
    else
        zoom = 1.0;

    offsetX = 0.0;
    offsetY = 0.0;
    pageDisplay.setScaleAndOffset(zoom, offsetX, offsetY);

    // TODO: reset everything for all pages?

    settingsModified = true;
}

function pageDrag(evt, phase, target, data)
{
    if (phase == "start")
    {
        if (!inDrag)
        {
            inDrag = true;
            savedOffX = offsetX;
            savedOffY = offsetY;
        }
    }
    else if (phase == "move")
    {
        if (inDrag)
        {
            var dx = data.movePoint.x - data.lastMovePoint.x;
            var dy = data.movePoint.y - data.lastMovePoint.y;
            offsetX += dx/zoom;
            offsetY += dy/zoom;
            pageDisplay.setOffset(offsetX, offsetY);

            settingsModified = true;
        }
    }
    else if (phase == "end")
    {
        inDrag = false;
    }
}

function pageSwipe(evt, target, data)
{
    if (inDrag)
    {
        offsetX = savedOffX;
        offsetY = savedOffY;
        pageDisplay.setOffset(offsetX, offsetY);

        settingsModified = true;
    }

    inDrag = false;

    if (data.direction == "left")
    {
        nextPage();
    }
    else if (data.direction == "right")
    {
        prevPage();
    }
}

function pagePinch(evt, target, data)
{
    inDrag = false;

    var newS = data.scale;
    var oldS = data.previousScale;
    var relScale = newS/oldS;

    var s1 = zoom;

    zoom *= relScale;
    if (zoom > 10.0)
        zoom = 10.0;
    else if (zoom < 0.1)
        zoom = 0.1;
    
    var s2 = zoom;
    var xc = data.startPoint.x;
    var yc = data.startPoint.y;
    offsetX += (xc/s1)*(s1/s2-1.0);
    offsetY += (yc/s1)*(s1/s2-1.0);

    pageDisplay.setScaleAndOffset(zoom, offsetX, offsetY);

    settingsModified = true;
}

var inBarDrag = false;
var savedBarPos = 0;

function barDrag(evt, phase, target, data)
{
    if (phase == "start")
    {
        inBarDrag = true;
        if (currentPage)
            savedBarPos = currentPage.getBarPosition();
    }
    else if (phase == "move")
    {
        if (inBarDrag)
        {
            if (currentPage)
            {
                var dy = data.movePoint.y - data.lastMovePoint.y;
                
                if (currentPage.getHighlight())
                {
                    currentPage.addBarPosition(dy/zoom);
                    pageDisplay.setBarPosition(currentPage.getBarPosition());

                    settingsModified = true;
                }
            }
        }
    }
    else if (phase == "end")
    {
        inBarDrag = false;
    }
}

function barPinch(evt, target, data)
{
    inBarDrag = false;

    if (currentPage && currentPage.getHighlight())
    {
        var newS = data.scale;
        var oldS = data.previousScale;
        var relScale = newS/oldS;
        
        var zoomedSize = barSize*zoom;
        zoomedSize *= relScale;
        barSize = zoomedSize/zoom;

        if (barSize < 0.1)
            barSize = 0.1;
        else if (barSize > 256.0)
            barSize = 256.0;

        pageDisplay.setBarWidth(barSize);

        settingsModified = true;
    }
}

function barSwipe(evt, target, data)
{
    if (inBarDrag)
    {
        inBarDrag = false;
        if (currentPage)
            currentPage.setBarPosition(savedBarPos);

        settingsModified = true;
    }

    if (data.direction == "up" || data.direction == "down")
        highlight();
}

function storeSettings()
{
    if (!curFileName)
        return;
    if (!pageCache)
        return;
    if (!currentPage)
        return;
    if (!settingsModified)
        return;

    Log("Saving settings");

    settingsModified = false;

    var localStorage_curFileName = { 
        pageSettings: [ ], 
        barSize: barSize, 
        offsetX: offsetX,
        offsetY: offsetY,
        zoom: zoom,
        curPageIdx: currentPage.getPageIndex(),
    };

    var settings = localStorage_curFileName.pageSettings;
    var numPages = pageCache.getNumberOfPages();

    for (var i = 0 ; i < numPages ; i++)
    {
        var pageSettings = { 
            transform: pageCache.getPage(i).getTransform(),
            highlight: pageCache.getPage(i).getHighlight(),
            barPos: pageCache.getPage(i).getBarPosition() };

        settings.push(pageSettings);
    }

    localStorage[curFileName] = JSON.stringify(localStorage_curFileName);
}

function loadSettings()
{
    if (!localStorage[curFileName])
        return;

    var entry = JSON.parse(localStorage[curFileName]);

    barSize = entry.barSize;
    offsetX = entry.offsetX;
    offsetY = entry.offsetY;
    zoom = entry.zoom;
    
    updateBarSize();

    var settings = entry.pageSettings;

    if (settings && pageCache)
    {
        var numPages = pageCache.getNumberOfPages();

        for (var i = 0 ; i < numPages ; i++)
        {
            var pageSettings = settings[i];

            if (pageSettings)
            {
                var page = pageCache.getPage(i);
                page.setTransform(pageSettings.transform);
                page.setHighlight(pageSettings.highlight);
                page.setBarPosition(pageSettings.barPos);
            }
        }
    }

    settingsModified = false;
    
    return entry.curPageIdx;
}

function transformDocsURL(docsUrl)
{
    var url = docsUrl;
    var prefixes = [ "https://docs.google.com/file/", "https://drive.google.com/file/" ];

    for (var i = 0 ; i < prefixes.length ; i++)
    {
        var prefix = prefixes[i];

        if (startsWith(docsUrl, prefix))
        {
            var parts = docsUrl.substr(prefix.length).split("/");

            if (parts.length > 2)
            {
                url = "https://docs.google.com/uc?id=" + parts[1] + "&export=download"
            }

            break;
        }
    }

    return url;
}

function transformBoxURL(boxUrl)
{
    var url = boxUrl;
    var prefix = "https://www.dropbox.com/s/";
    var prefix2 = "https://www.dropbox.com/sh/";

    if (startsWith(boxUrl, prefix))
    {
        url = "https://dl.dropboxusercontent.com/s/" + boxUrl.substr(prefix.length);
    }

    if (startsWith(boxUrl, prefix2))
    {
        url = "https://dl.dropboxusercontent.com/sh/" + boxUrl.substr(prefix2.length);
    }

    return url;
}

var allowAnyURL = false;

function onReallyLoadURL(origUrl)
{
    var url = null;

    if (allowAnyURL)
    {
        url = origUrl;
        url = transformDocsURL(url);
        url = transformBoxURL(url);
    }
    else
    {
        var prefix = "https://www.dropbox.com/s/";
        var prefix2 = "https://www.dropbox.com/sh/";

        if (startsWith(origUrl, prefix))
            url = "https://dl.dropboxusercontent.com/s/" + origUrl.substr(prefix.length);
        else if (startsWith(origUrl, prefix2))
            url = "https://dl.dropboxusercontent.com/sh/" + origUrl.substr(prefix2.length);
        else
        {
            vex.dialog.alert("Not a Dropbox share URL");
            return;
        }

    }

    Log("Orig URL: " + origUrl);
    Log("Download URL: " + url);

    pdfOpenDlg = createInfoDialog("Loading PDF file from URL<br><span id='renderingspan' style='display:none'>Rendering page <span id='renderingpagenumspan'></span></span>");

    var handler = function(response, code, statusText)
    {
        if (code == 200)
        {
            localStorage["lastURL"] = JSON.stringify(origUrl);
            onPDFDataLoaded(response, "url://" + origUrl);
        }
        else
        {
            if (pdfOpenDlg)
            {
                closeInfoDialog(pdfOpenDlg);
                pdfOpenDlg = null;
            }
            vex.dialog.alert("Unable to retrieve URL<br>(" + textToHTML(statusText) + ")");
        }
    }

    NetworkConnection.get(url, handler, true);
}

function loadURL()
{
    var oldDlg = generalOpenDlg.data().vex.id;
    vex.close(oldDlg);

    vex.dialog.open({
        //css: { width: "90%" },
        //overlayCSS: { width: "90%" },
        contentCSS: { width: "90%" },
        message: 'Enter URL:',
        input: "<input id='pdfurl' name='pdfurl' type='text' placeholder='https://www.dropbox.com/s/XXXXXXXXXXXXXX/file.pdf' required />",
        afterOpen: function(content)
        {
            if (localStorage["lastURL"])
            {
                var lastURL = JSON.parse(localStorage["lastURL"]);
                if (lastURL)
                    $("#pdfurl").attr("value", lastURL);
            }
        },
        callback: function(data) 
        {
            if (data === false) 
            {
                // cancelled
                return;
            }

            setTimeout(function() { onReallyLoadURL(data.pdfurl); }, 0);
        }
    });
}

function resetFileInput() 
{
    var e = $("#loadfile");
    
    if (e)
    {
        e.wrap('<form>').parent('form').trigger('reset');
        e.unwrap();
    }
}

function openPDF()
{
    generalOpenDlg = vex.dialog.alert(
            {   contentCSS: { width: "60%" },
                message: 'How do you want to load the file?' + 
                     '<ul><li>Load a Dropbox share: <button onclick="loadURL()">Load URL</button></li>' +
                     '<li>Load a local file: <input id="loadfile" type="file" onchange="onPDFFileSelected(this.files)"></li></ul>'});
}

var pageDisplay = null;
var mouseController = null;
var barController = null;

function run()
{
    // Workaround for bug when using minified jquery in chrome, where clearInterval(true) gets
    // called, which is then interpreted as clearInterval(1), causing the first interval timer 
    // to be stopped. This makes sure the id '1' is not used.
    var dummyInterval1 = setInterval(function() { }, 1000);
    clearInterval(dummyInterval1);

    vex.defaultOptions.className = 'vex-theme-wireframe';
    vex.closeByEscape = function() { }

    Log("run");

    try
    {
        var elem = document.getElementById("pagedisplay");
        
        pageDisplay = new PageDisplay();
        pageDisplay.init(elem, elem.clientWidth, elem.clientHeight, onDisplayError);

        var w = elem.clientWidth;
        var h = elem.clientHeight;

        mouseController = new MouseController(elem, onMouseMove, onMouseScroll);
    
        jQuery(elem).bind('touchy-swipe', pageSwipe);
        jQuery(elem).bind('touchy-drag', pageDrag);
        jQuery(elem).bind('touchy-pinch', pagePinch);

        var elem2 = document.getElementById("barctrl");
        barController = new MouseController(elem2, onBarMove, onBarZoom);

        jQuery(elem2).bind('touchy-swipe', barSwipe);
        jQuery(elem2).bind('touchy-drag', barDrag);
        jQuery(elem2).bind('touchy-pinch', barPinch);

        var storeTimer = setInterval(storeSettings, 1000);
        Log("storeTimer = " + storeTimer);

        var logo = new Image();
        logo.onload = function()
        {
            if (!pageDisplay.isSetImageCalled() && currentPage == null && !curFileName)
            {
                var img = logo;

                currentPage = new Page(0);
                currentPage.setImage(img);

                zoom = pageDisplay.getWidth()/img.width;
                offsetX = 0;
                offsetY = 0;
                pageDisplay.setScaleAndOffset(zoom, offsetX, offsetY);
                pageDisplay.setTransform(0);
                pageDisplay.setHighlight(false);

                barPos = 228;
                barSize = 20;
                pageDisplay.setBarWidth(barSize);
                pageDisplay.setBarPosition(barPos);
                pageDisplay.setImage(img);

                currentPage.setBarPosition(barPos);
            }
        }
        logo.src = "logo.png";
        //$("#log").css("display", "");
    }
    catch(err)
    {
        // This should disable any possible interaction
        createInfoDialog("Unable to start application:<BR>" + textToHTML(err));
    }

    $('#pagetop').qtip({ // Grab some elements to apply the tooltip to
            content: {
                        text: 'The highlight bar is above your current view.'
            },
            position: {
                    my: 'top center',
                    at: 'bottom left',
            }
    });

    $('#pagebottom').qtip({ // Grab some elements to apply the tooltip to
            content: {
                        text: 'The highlight bar is below your current view.'
            },
            position: {
                    my: 'bottom center',
                    at: 'top left',
            }
    })

    setInterval(checkBarPosition, 1000);
    setInterval(pageDisplaySizeCheck, 1000);
}

function onDisplayError(msg)
{
    Log("Display error: " + msg);
    Log("Attempting to create new PageDisplay object");
    
    try { pageDisplay.destroy(); } catch(err) { }
    
    var elem = document.getElementById("pagedisplay");
    pageDisplay = new PageDisplay();
    try
    {
        pageDisplay.init(elem, elem.clientWidth, elem.clientHeight, onDisplayError);

        if (currentPage)
            showPage(currentPage.getPageIndex());
    }
    catch(err)
    {
        // This should disable any possible interaction
        createInfoDialog("Unable re-create page viewer:<BR>" + textToHTML(err));
    }
}

function help()
{
    var win = window.open('help.html', '_blank');

    win.focus();
}

function pageDisplaySizeCheck()
{
    //Log("pageDisplaySizeCheck");
    pageDisplay.resize(document.getElementById("pagedisplay").clientWidth, 
                       document.getElementById("pagedisplay").clientHeight); 
}

window.onresize = function()
{ 
    pageDisplaySizeCheck();
};

window.onbeforeunload = function(e)
{
    return "Please confirm";
}

function checkBarPosition()
{
    if (!currentPage || !currentPage.getHighlight())
    {
        $('#pagetop').qtip('toggle', false);
        $('#pagebottom').qtip('toggle', false);
        return;
    }

    var barPos = currentPage.getBarPosition();
    var dispPos = (offsetY + barPos)*zoom;

    //console.log(dispPos);

    var body = document.body, html = document.documentElement;
    var height = Math.max( body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight );

    if (dispPos < 0)
    {
//        console.log("Bar too high");
        $('#pagetop').qtip('toggle', true);
        $('#pagebottom').qtip('toggle', false);
    }
    else if (dispPos > height)
    {
//       console.log("Bar too low");
        $('#pagetop').qtip('toggle', false);
        $('#pagebottom').qtip('toggle', true);
    }
    else
    {
        // Hide the message
        $('#pagetop').qtip('toggle', false);
        $('#pagebottom').qtip('toggle', false);
    }
}

$(document).ready(run);


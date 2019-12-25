MouseController = function(par, moveFunction, scrollFunction)
{
    var prevX = -1;
    var prevY = -1;
    var clickX = -1;
    var clickY = -1;
    var prnt = null;
    var onMoveIt = null;
    var onScrollWheel = null;
    var isFF = false;
    var haveListeners = false;

    var onMouseDown = function(e)
    {
        prevX = e.screenX;
        prevY = e.screenY;
        clickX = prevX;
        clickY = prevY;
    }

    var onMouseUp = function(e)
    {
        if (prevX >= 0 && prevY >= 0)
        {
            var diffX = e.screenX-prevX;
            var diffY = e.screenY-prevY;
            prevX = -1;
            prevY = -1;
            if (diffX != 0 || diffY != 0)
                onMoveIt(diffX, diffY, clickX, clickY);
        }

        clickX = -1;
        clickY = -1;
    }

    var onMouseMove = function(e)
    {
        if (prevX >= 0 && prevY >= 0)
        {
            var diffX = e.screenX-prevX;
            var diffY = e.screenY-prevY;
    
            prevX = e.screenX;
            prevY = e.screenY;
    
            if (diffX != 0 || diffY != 0)
                onMoveIt(diffX, diffY, clickX, clickY);
        }
    }
    
    var onMouseOut = function(e)
    {
        prevX = -1;
        prevY = -1;
        clickX = -1;
        clickY = -1;
    }
    
    function getClickPosition(e) 
    {
        var parentPosition = getPosition(e.currentTarget);
        var xPosition = e.clientX - parentPosition.x;
        var yPosition = e.clientY - parentPosition.y;

        return { x: xPosition, y: yPosition };
    }
 
    function getPosition(element) 
    {
        var xPosition = 0;
        var yPosition = 0;
      
        while (element) 
        {
            xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
            yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
            element = element.offsetParent;
        }
        return { x: xPosition, y: yPosition };
    }

    var onMouseWheel = function(e)
    {
        var val = 0;
    
        if (e.wheelDelta > 0)
        {
            val = 1;
        }
        else if (e.wheelDelta < 0)
        {
            val = -1;
        }
    
        if (val != 0)
        {
            var pos = getClickPosition(e);
            onScrollWheel(val, pos.x, pos.y);
        }
    
        e.preventDefault();
    }

    var onMouseWheelFF = function(e)
    {
        var val = 0;
    
        if (e.detail < 0)
        {
            val = 1;
        }
        else if (e.detail > 0)
        {
            val = -1;
        }
    
        if (val != 0)
        {
            var pos = getClickPosition(e);
            onScrollWheel(val, pos.x, pos.y);
        }
    
        e.preventDefault();
    }

    this.addEventListeners = function(par, moveFunction, scrollFunction)
    {
        if (haveListeners)
            return;

        haveListeners = true;

        onMoveIt = moveFunction;
        onScrollWheel = scrollFunction;
        prnt = par;

        prevX = -1;
        prevY = -1;

        isFF = (/Firefox/i.test(navigator.userAgent));

        prnt.addEventListener("mousedown", onMouseDown, false);
        prnt.addEventListener("mouseup", onMouseUp, false);
        prnt.addEventListener("mousemove", onMouseMove, false);
        prnt.addEventListener("mouseout", onMouseOut, false);

        if (!isFF)
        {
            prnt.addEventListener("mousewheel", onMouseWheel, false);
        }
        else
        {
            prnt.addEventListener("DOMMouseScroll", onMouseWheelFF, false);
        }
    }

    this.removeEventListeners = function()
    {
        if (!haveListeners)
            return;

        haveListeners = false;

        prnt.removeEventListener("mousedown", onMouseDown, false);
        prnt.removeEventListener("mouseup", onMouseUp, false);
        prnt.removeEventListener("mousemove", onMouseMove, false);
        prnt.removeEventListener("mouseout", onMouseOut, false);

        if (!isFF)
        {
            prnt.removeEventListener("mousewheel", onMouseWheel, false);
        }
        else
        {
            prnt.removeEventListener("DOMMouseScroll", onMouseWheelFF, false);
        }
    }

    // Initialize stuff
    {
        this.addEventListeners(par, moveFunction, scrollFunction);
    }
}

var Page = function(pageIndex)
{
    var _this = this;
    var m_idx = pageIndex;

    var m_transform = 0;
    var m_highlight = false;
    var m_barPosition = 0;

    var m_img = null;
    var m_lastUsageTime = 0;

    this.getTransform = function() { return m_transform; }
    this.setTransform = function(t) { m_transform = (t%4); }
    this.increaseTransform = function() { m_transform = (m_transform + 1)%4; }

    this.getHighlight = function() { return m_highlight; }
    this.setHighlight = function(b) { if (b) { m_highlight = true; } else { m_highlight = false; } }
    this.toggleHighlight = function() { m_highlight = !m_highlight; }

    this.getBarPosition = function() { return m_barPosition; }
    this.setBarPosition = function(pos) { m_barPosition = pos; }
    this.addBarPosition = function(add) { m_barPosition += add; }

    this.getImage = function() { return m_img; }
    this.setImage = function(img) { m_img = img; }

    this.getPageIndex = function() { return m_idx; }

    this.updateUsageTime = function() { m_lastUsageTime = Date.now(); }
    this.getLastUsageTime = function() { return m_lastUsageTime; }
}

var PageCache = function(pdf)
{
    var _this = this;
    var m_pdf = pdf;
    var m_pages = [ ];
    var m_numPages = pdf.getNumberOfPages();

    var m_currentPageRequested = null;
    var m_currentPageDelivered = null;

    var m_cacheCheckTimer = null;
    var m_maxImages = 16;

    for (var i = 0 ; i < m_numPages ; i++)
        m_pages.push(new Page(i));

    this.getNumberOfPages = function() { return m_numPages; }

    this.getPage = function(idx)
    {
        if (idx < 0 || idx >= m_numPages)
            throw "Page index is out of range";

        return m_pages[idx];
    }

    this.setCurrentPage = function(idx)
    {
        if (idx < 0 || idx >= m_numPages)
            throw "Page index is out of range";

        var r = { "done": null, "rendering": null, "error": null };

        var p = m_pages[idx];
        m_currentPageRequested = p;
        
        if (p.getImage() != null) // image already exists
        {
            setTimeout(function()
            {
                m_currentPageDelivered = p;
                p.updateUsageTime();

                if (r.done)
                    r.done(p);
            }, 0);
        }
        else // need to render page
        {
            setTimeout(function() { if (r.rendering) r.rendering(idx); }, 0);

            try
            {
                var renderedCallback = function(img)
                {
                    p.setImage(img);

                    setTimeout(function()
                    {
                        m_currentPageDelivered = p;
                        p.updateUsageTime();
                        
                        if (r.done)
                            r.done(p);
                    }, 0);
                }

                var errorCallback = function(msg)
                {
                    if (r.error)
                        r.error("Unable to render page " + (idx+1) + ": " + msg);
                }

                setTimeout(function() { m_pdf.renderPage(idx+1, renderedCallback, errorCallback); }, 0);
            }
            catch(e)
            {
                setTimeout(function()
                {
                    if (r.error)
                        r.error("Unable to render page " + (idx+1) + ": " + e);
                }, 0);
            }
        }

        return r;
    }

    this.destroy = function()
    {
        // TODO:
    }

    m_cacheCheckTimer = setInterval(function()
    {
        var renderedPages = [ ];

        for (var i = 0 ; i < m_numPages ; i++)
        {
            var p = m_pages[i];

            if (p == m_currentPageRequested || p == m_currentPageDelivered || p.getImage() == null)
                continue;

            renderedPages.push(p);

        }

        if (renderedPages.length <= m_maxImages)
            return;

        renderedPages.sort(function(a, b)
        {
            return a.getLastUsageTime() - b.getLastUsageTime();
        });

        var num = renderedPages.length - m_maxImages;    

        for (var i = 0 ; i < num ; i++)
        {
            //Log("Removing image for page index " + renderedPages[i].getPageIndex());
            renderedPages[i].setImage(null);
        }
    }, 1000);
}

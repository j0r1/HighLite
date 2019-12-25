var PageDisplay = function()
{
    var _this = this;
    var m_parentDiv = null;
    var m_canvas = null;
    var m_context = null;
    var m_init = false;

    var m_locDimImage = 0;
    var m_locDimCanvas = 0;
    var m_locImgScale = 0;
    var m_locOffset = 0;
    var m_locTransform = 0;
    var m_locBarPos = 0;
    var m_locBarWidth = 0;
    var m_locBarEnable = 0;

    var m_texture = null;

    var m_fragmentShader = null;
    var m_vertexShader = null;
    var m_program = null;
    var m_fragmentShader2 = null;
    var m_vertexShader2 = null;
    var m_program2 = null;
    var m_vertexBuffer = null;
    var m_vertexBuffer2 = null;
    var m_texCoordBuffer = null;

    var m_lostContext = false;
    var m_runtimeErrorCallback = null;
    var m_setImageCalled = false;

    var m_animationRequested = false;

    var lostContextHandler = function(event)
    {
        m_lostContext = true;

        var callBack = m_runtimeErrorCallback;
        m_runtimeErrorCallback = null; // only call this once

        if (callBack)
            callBack("Lost WebGL context");
    }

    // does not use extra parameters
    this.init = function(divElem, width, height, runErrorCallback)
    {
        if (m_init)
            throw "PageDisplay.init: Already initialized";

        var canvas = document.createElement("canvas");
        var context = canvas.getContext("experimental-webgl");
        if (!context)
            throw "WebGL does not seem to be available";
        
        canvas.width = width;
        canvas.height = height;
        canvas.style.pointerEvents = "none"; // don't handle the mouse ourselves
        //canvas.style.border = "dotted 1px" // just for debugging

        m_lastAnimationRequest = null; // make sure this is initialized correctly
        m_parentDiv = null; // can be changed in this.attach, but must be initialized correctly
        m_canvas = canvas;
        m_context = context;

        initWebGLContext();
        adjustViewPort(width, height);

        m_runtimeErrorCallback = runErrorCallback;
        canvas.addEventListener("webglcontextlost", lostContextHandler, false);

        // Do this before attach and startRender since they check this
        m_init = true;

        this.attach(divElem);
    }

    this.attach = function(divElem)
    {
        if (!m_init)
            throw "PageDisplay.attach: Not initialized";

        if (m_parentDiv)
            m_parentDiv.removeChild(m_canvas);

        m_parentDiv = divElem;
        if (m_parentDiv)
            m_parentDiv.appendChild(m_canvas);
    }

    this.destroy = function()
    {
        if (!m_init)
            return;

        this.attach(null);

        // Clean up the 3D context 

        m_context.deleteShader(m_fragmentShader);
        m_context.deleteShader(m_vertexShader);
        m_context.deleteProgram(m_program);
        m_context.deleteBuffer(m_vertexBuffer);
        m_context.deleteBuffer(m_texCoordBuffer);
        m_context.deleteTexture(m_texture);
        m_context.clear(m_context.COLOR_BUFFER_BIT | m_context.DEPTH_BUFFER_BIT); // make sure the buffer is clear

        m_canvas.removeEventListener("webglcontextlost", lostContextHandler, false);

        m_canvas = null;
        m_context = null;

        m_init = false;
    }

    var loadShader = function(shaderSource, shaderType) 
    {
        var shader = m_context.createShader(shaderType);
        m_context.shaderSource(shader, shaderSource);
        m_context.compileShader(shader);

        var compiled = m_context.getShaderParameter(shader, m_context.COMPILE_STATUS);
        if (!compiled) 
        {
            var lastError = m_context.getShaderInfoLog(shader);
            m_context.deleteShader(shader);
    
            console.log("Error compiling shader:" + lastError);
            return null;
        }

        return shader;
    }

    var initWebGLContext = function()
    {
        var vertexShaderSource = [ "" , 
            "attribute vec3 a_position;",
            "attribute vec2 a_texCoord;",
            "varying vec2 v_texCoord;",
            "varying float v_yPos;",
            "uniform vec2 dimImage;" ,
            "uniform vec2 dimCanvas;" ,
            "uniform float imageScale;" ,
            "uniform vec2 imageOffset;" ,
            "uniform int trans;" ,
            "void main()",
            "{",
            "    v_texCoord = a_texCoord;" ,
            "    float ax, ay, dx, dy;" , 
            "    int t = trans;" ,
            "    if (t == 0)" , 
            "    {",
            "        ax = a_position.x*dimImage.x;" ,
            "        ay = a_position.y*dimImage.y;" ,
            "    }" ,
            "    else if (t == 1)" ,
            "    {",
            "        ax = (1.0-a_position.y)*dimImage.y;" ,
            "        ay = a_position.x*dimImage.x;" ,
            "    }" ,
            "    else if (t == 2)" ,
            "    {",
            "        ax = (1.0-a_position.x)*dimImage.x;" ,
            "        ay = (1.0-a_position.y)*dimImage.y;" ,
            "    }" ,
            "    else" ,
            "    {",
            "        ax = a_position.y*dimImage.y;" ,
            "        ay = (1.0-a_position.x)*dimImage.x;" ,
            "    }" ,
            "    float x = 2.0*(ax+imageOffset.x)*imageScale/dimCanvas.x - 1.0;" ,
            "    float y = -(2.0*(ay+imageOffset.y)*imageScale/dimCanvas.y - 1.0);" ,
            "    gl_Position = vec4(x, y, a_position.z, 1);",
            "    v_yPos = ay;" , 
            "}"].join("\n");
    
        var fragmentShaderSource = [ "" ,
		    "precision mediump float;" ,
			"uniform sampler2D u_image;" ,
			"varying vec2 v_texCoord;" ,
            "varying float v_yPos;" ,
            "uniform float barPosition;" ,
            "uniform float barWidth;" ,
            "uniform int barEnable;" ,
			"" ,
			"void main() " ,
			"{" ,
			"    vec4 c = texture2D(u_image, v_texCoord);" ,
            "    if (barEnable == 1)" ,
            "    {" ,
            "        float w = 0.3;" ,
            "        if (abs(barPosition-v_yPos) < barWidth)" ,
            "            w = 1.0;" , 
            "        vec4 d = vec4(0.0,0.0,0.0,1.0);" ,
            "        c = d*(1.0-w)+w*c;" ,
            "    }" , 
            "    gl_FragColor = vec4(c.x, c.y, c.z, 1.0);" ,
			"}"].join("\n");

        m_context.clearColor(1, 1, 1, 1);
        m_context.enable(m_context.DEPTH_TEST);
        m_context.enable(m_context.BLEND);
        m_context.depthFunc(m_context.LESS);
        m_context.blendFunc(m_context.SRC_ALPHA, m_context.ONE_MINUS_SRC_ALPHA);

        var vertexShader = loadShader(vertexShaderSource, m_context.VERTEX_SHADER);
        var fragmentShader = loadShader(fragmentShaderSource, m_context.FRAGMENT_SHADER);

        var program = m_context.createProgram();
        m_context.attachShader(program, vertexShader);
        m_context.attachShader(program, fragmentShader);
        m_context.linkProgram(program);
        
        m_context.useProgram(program);

        m_vertexShader = vertexShader;
        m_fragmentShader = fragmentShader;
        m_program = program;

        var positionLocation = m_context.getAttribLocation(program, "a_position");
        var buffer = m_context.createBuffer();

        m_context.bindBuffer(m_context.ARRAY_BUFFER, buffer);
        m_context.bufferData(m_context.ARRAY_BUFFER, new Float32Array([ 
                                                                        -300,300,0.1, 300,300,0.1, -300,-300,0.1, -300,-300,0.1, 300,300,0.1, 300,-300,0.1,
                                                                        0,1,0, 1,1,0, 0,0,0, 0,0,0, 1,1,0, 1,0,0,
                                                                       ]), m_context.STATIC_DRAW);
        m_context.enableVertexAttribArray(positionLocation);
        m_context.vertexAttribPointer(positionLocation, 3, m_context.FLOAT, false, 0, 0);

        m_vertexBuffer = buffer;

        var texCoordLocation = m_context.getAttribLocation(program, "a_texCoord");
        var texCoordBuffer = m_context.createBuffer();

        m_context.bindBuffer(m_context.ARRAY_BUFFER, texCoordBuffer);
        m_context.bufferData(m_context.ARRAY_BUFFER, new Float32Array([
                                                                        0,0, 0,0, 0,0, 0,0, 0,0, 0,0,
                                                                        0,1, 1,1, 0,0, 0,0, 1,1, 1,0,
                                                                       ]), m_context.STATIC_DRAW);
        m_context.enableVertexAttribArray(texCoordLocation);
        m_context.vertexAttribPointer(texCoordLocation, 2, m_context.FLOAT, false, 0, 0);

        m_texCoordBuffer = texCoordBuffer;

        m_locDimImage = m_context.getUniformLocation(program, "dimImage");
        m_locDimCanvas = m_context.getUniformLocation(program, "dimCanvas");
        m_locImgScale = m_context.getUniformLocation(program, "imageScale");
        m_locOffset = m_context.getUniformLocation(program, "imageOffset");
        m_locTransform = m_context.getUniformLocation(program, "trans");
        m_locBarWidth = m_context.getUniformLocation(program, "barWidth");
        m_locBarPos = m_context.getUniformLocation(program, "barPosition");
        m_locBarEnable = m_context.getUniformLocation(program, "barEnable");

        m_context.uniform2f(m_locDimImage, 1, 1);
        m_context.uniform2f(m_locDimCanvas, 1, 1);
        m_context.uniform1f(m_locImgScale, 1);
        m_context.uniform2f(m_locOffset, 0, 0);
        m_context.uniform1i(m_locTransform, 0);
        m_context.uniform1f(m_locBarWidth, 100);
        m_context.uniform1f(m_locBarPos, 300);
        m_context.uniform1i(m_locBarEnable, 0);

        m_texture = m_context.createTexture();
        m_context.bindTexture(m_context.TEXTURE_2D, m_texture);
        m_context.texParameteri(m_context.TEXTURE_2D, m_context.TEXTURE_MAG_FILTER, m_context.LINEAR);
        m_context.texParameteri(m_context.TEXTURE_2D, m_context.TEXTURE_MIN_FILTER, m_context.LINEAR_MIPMAP_NEAREST);
        m_context.texParameteri(m_context.TEXTURE_2D, m_context.TEXTURE_WRAP_S, m_context.CLAMP_TO_EDGE);
        m_context.texParameteri(m_context.TEXTURE_2D, m_context.TEXTURE_WRAP_T, m_context.CLAMP_TO_EDGE);
        m_context.generateMipmap(m_context.TEXTURE_2D);

        // Make sure there's actual texture data, to prevent WebGL error messages

        var tmpImage = new Image();
        
        // This is a 1x1 PNG image
        tmpImage.onload = function()
        {
            if (!m_setImageCalled)
            {
                var imageData = tmpImage;
            
                m_context.texImage2D(m_context.TEXTURE_2D, 0, m_context.RGBA, m_context.RGBA, m_context.UNSIGNED_BYTE, imageData);
                m_context.generateMipmap(m_context.TEXTURE_2D);

                m_context.uniform2f(m_locDimImage, imageData.width, imageData.height);
                render();
            }
        }
        tmpImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2P8DwQMFADGUQMYRsOAYTQMgHloGKQDACUfP9E8ZIjlAAAAAElFTkSuQmCC"
    }

    var adjustViewPort = function(width, height)
    {
        m_context.viewport(0, 0, width, height);
        m_context.uniform2f(m_locDimCanvas, width, height);
    }

    var realRender = function()
    {
        m_animationRequested = false;

        if (!m_init)
            return;
        
        m_context.clear(m_context.COLOR_BUFFER_BIT | m_context.DEPTH_BUFFER_BIT);
        m_context.drawArrays(m_context.TRIANGLES, 0, 12);
    }

    var render = function()
    {
        if (!m_init)
            return;

        if (m_animationRequested)
            return;

        m_animationRequested = true;
        requestAnimationFrame(realRender, m_canvas);
    }

    this.resize = function(width, height)
    {
        if (!m_init)
            return;
        
        if (width == m_canvas.width && height == m_canvas.height)
            return;

        m_canvas.width = width;
        m_canvas.height = height;

        adjustViewPort(width, height);

        render();

        console.log("Resized to " + width + "x" + height);

        setTimeout(function() 
        { 
            m_animationRequested = true;
            requestAnimationFrame(realRender, m_canvas);
        }, 0);
    }

    this.setImage = function(imageData)
    {
        if (!m_init)
            throw "PageDisplay.setImage: Not initialized";

        m_setImageCalled = true;

        m_context.texImage2D(m_context.TEXTURE_2D, 0, m_context.RGBA, m_context.RGBA, m_context.UNSIGNED_BYTE, imageData);
        m_context.generateMipmap(m_context.TEXTURE_2D);

        m_context.uniform2f(m_locDimImage, imageData.width, imageData.height);
        render();
    }

    this.setOffset = function(xOffset, yOffset)
    {
        if (!m_init)
            return;

        m_context.uniform2f(m_locOffset, xOffset, yOffset);
        render();
    }

    this.setScaleAndOffset = function(scale, xOffset, yOffset)
    {
        if (!m_init)
            return;

        m_context.uniform1f(m_locImgScale, scale);
        m_context.uniform2f(m_locOffset, xOffset, yOffset);
        render();
    }

    this.setTransform = function(t)
    {
        if (!m_init)
            return;

        m_context.uniform1i(m_locTransform, t);
        render();
    }

    this.getWidth = function()
    {
        if (!m_init)
            return 0;
        return m_canvas.width;
    }

    this.getHeight = function()
    {
        if (!m_init)
            return 0;
        return m_canvas.height;
    }

    this.setHighlight = function(f)
    {
        if (!m_init)
            return;

        var t;
        if (f)
            t = 1;
        else
            t = 0;

        m_context.uniform1i(m_locBarEnable, t);
        render();
    }

    this.setBarWidth = function(w)
    {
        if (!m_init)
            return;
        m_context.uniform1f(m_locBarWidth, w);
        render();
    }

    this.setBarPosition = function(p)
    {
        if (!m_init)
            return;
        m_context.uniform1f(m_locBarPos, p);
        render();
    }

    this.loseContext = function()
    {
         var evt = document.createEvent("HTMLEvents");
         evt.initEvent("webglcontextlost", true, true ); // event type,bubbling,cancelable
         m_canvas.dispatchEvent(evt);
    }

    this.isSetImageCalled = function()
    {
        return m_setImageCalled;
    }
}



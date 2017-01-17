/*
* Copyright (C) 2011 Samsung Electronics Corporation. All rights reserved.
*
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided the following conditions
* are met:
*
* 1.  Redistributions of source code must retain the above copyright
*     notice, this list of conditions and the following disclaimer.
*
* 2.  Redistributions in binary form must reproduce the above copyright
*     notice, this list of conditions and the following disclaimer in the
*     documentation and/or other materials provided with the distribution.
*
* THIS SOFTWARE IS PROVIDED BY SAMSUNG ELECTRONICS CORPORATION AND ITS
* CONTRIBUTORS "AS IS", AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING
* BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
* FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL SAMSUNG
* ELECTRONICS CORPORATION OR ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
* INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES(INCLUDING
* BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
* DATA, OR PROFITS, OR BUSINESS INTERRUPTION), HOWEVER CAUSED AND ON ANY THEORY
* OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT(INCLUDING
* NEGLIGENCE OR OTHERWISE ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
* EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var WINW                = 400;          // drawing canvas width
var WINH                = 400;          // drawing canvas height

var NBODY               = 4096;         // default number of particles to simulate
var INNER_FLOPS         = 25;           // number of flops in inner loop of simulation

var SAMPLEPERIOD        = 10;           // calculate fps and sim/draw times over this many frames
var DISPLAYPERIOD       = 400;          // msecs between display updates of fps and sim/draw times

var POS_ATTRIB_SIZE     = 4;            // xyzm, xyzm, xyzm, ...
var VEL_ATTRIB_SIZE     = 4;            // vx, vy, vz, unused, vx, vy, vz, unused, ...
var CUBE_ATTRIB_SIZE    = 3;            // xyz, xyz, ...

var JS_SIM_MODE         = "JS";         // simMode is boolean
var CL_SIM_MODE         = "CL";
var VK_SIM_MODE         = "VK";

var JS_DRAW_MODE        = true;         // drawMode is boolean
var GL_DRAW_MODE        = false;

var GLCL_SHARE_MODE     = true;         // shareMode is boolean

var EPSSQR              = 50;           // softening factor
var DT                  = 0.005;        // time delta


function UserData() {
    this.curPos         = null;         // current particle position and mass
    this.curVel         = null;         // current particle velocity
    this.nxtPos         = null;         // updated particle position and mass
    this.nxtVel         = null;         // updated particle velocity
    this.curPosLoc      = null;         // location of curPos attribute in vertex shader
    this.curVelLoc      = null;         // location of curVel attribute in vertex shader

    this.mvpPointLoc    = null;         // location of mvp matrix in point vertex shader
    this.mvpCubeLoc     = null;         // location of mvp matrix in cube vertex shader

    this.cubeVertices   = null;         // cube vertex array
    this.cubeIndices    = null;         // cube indice array
    this.cubeLoc        = null;         // location of cube attribute in vertex shader

    this.pointProgram   = null;         // GL program with point shaders
    this.cubeProgram    = null;         // GL program with cube shaders

    this.curPosVBO      = null;         // shared buffer between GL and CL
    this.curVelVBO      = null;         // shared buffer between GL and CL

    this.cubeVertexVBO  = null;
    this.cubeIndiceVBO  = null;

    this.theta          = 0.2;                  // angle to rotate model
    this.modelMatrix    = new J3DIMatrix4();    // updated each frame
    this.vpMatrix       = new J3DIMatrix4();    // constant
    this.mvpMatrix      = new J3DIMatrix4();    // updated each frame

    this.simMode        = null;
    this.drawMode       = null;
    this.isSimRunning   = true;
    this.is3D           = true;
    this.isGLCLshared   = GLCL_SHARE_MODE;

    this.ctx            = null;         // handle for Canvas2D context
    this.gl             = null;         // handle for GL context
    this.cl             = null;         // handle for CL context
    this.fpsSampler     = null;         // FPS sampler
    this.simSampler     = null;         // Sim time sampler
    this.drawSampler    = null;         // Draw time sampler
    this.gpu            = true;         // Use GPU as default device in CL context
    this.vk             = null;

    this.mainLoop = null;
    this.justOnce = false;
    this.maxTestNum = 1000;
    this.curTestNum = 0;

    this.timeSetArg = 0;
    this.timeFinish = 0;
    this.timeCopyBuffer = 0;
    this.timeReadBuffer = 0;
    this.timeNDRangeKernel = 0;
    this.timeSetArg1 = 0;
    this.timeSetArg2 = 0;
    this.timeSetArg3 = 0;
}

var userData = null;

function RANDM1TO1() { return Math.random() * 2 - 1; }
function RAND0TO1() { return Math.random(); }

function onLoad() {
    if(WINW !== WINH) {
        console.error("Error: drawing canvas must be square");
        return;
    }

    userData = new UserData();
    userData.fpsSampler = new FpsSampler(SAMPLEPERIOD, "fps");
    userData.simSampler = new MSecSampler(SAMPLEPERIOD, "sms");
    userData.drawSampler = new MSecSampler(SAMPLEPERIOD, "dms");

    // setup work group size
    var clWorkGroupSize = GetWorkGroupSize();
    if (clWorkGroupSize !== null) {
        // assure particle count is a workgroup size multiple
        NBODY = 4 * clWorkGroupSize;
    }

    userData.curPos = new Float32Array(NBODY * POS_ATTRIB_SIZE);
    userData.curVel = new Float32Array(NBODY * VEL_ATTRIB_SIZE);
    userData.nxtPos = new Float32Array(NBODY * POS_ATTRIB_SIZE);
    userData.nxtVel = new Float32Array(NBODY * VEL_ATTRIB_SIZE);

    InitParticleState();

    userData.ctx = InitJS("canvas2D");
    userData.gl  = InitGL("canvas3D");
    userData.cl  = InitCL();
    userData.vk = InitVK();

    SetSimMode(JS_SIM_MODE);
    SetDrawMode(JS_DRAW_MODE);

    userData.mainLoop = setInterval( MainLoop, 0 );
    setInterval( function() { userData.fpsSampler.display(); }, DISPLAYPERIOD);
    setInterval( function() { userData.simSampler.display(); }, DISPLAYPERIOD);
    setInterval( function() { userData.drawSampler.display(); }, DISPLAYPERIOD);
    setInterval( ShowFLOPS, 2*DISPLAYPERIOD);
}

function ShowFLOPS() {
    var flops = 0;
    if(userData.simSampler.ms > 0)
        flops = (INNER_FLOPS * NBODY * NBODY * 1000) / (userData.simSampler.ms);

    if(flops > 1000 * 1000 * 1000) {
        flops = Math.round(flops / (1000 * 1000 * 1000));
        document.getElementById("f1").firstChild.nodeValue = "GFLOPS:";
    }
    else {
        flops = Math.round(flops / (1000 * 1000));
        document.getElementById("f1").firstChild.nodeValue = "MFLOPS:";
    }
    document.getElementById("f2").firstChild.nodeValue = flops;
}

function InitParticleState() {
    //InitRandomParticles();
    //InitParticlesOnSphere();
    //InitParticlesOnDisc();
    InitParticlesOnSpinningDisc();
    //InitParticlesOnRing();
    //InitTwoParticles();
    //InitFourParticles();

    document.getElementById("num").firstChild.nodeValue = NBODY;
}

function MainLoop() {

    userData.drawSampler.endFrame();    // started at beginning of previous Draw()
    userData.fpsSampler.markFrame();    // count a new frame

    userData.simSampler.startFrame();
    if(userData.isSimRunning) {
        if(userData.simMode === JS_SIM_MODE) {
            SimulateJS();
        }
        else if (userData.simMode === CL_SIM_MODE) {
            SimulateCL(userData.cl);
        }
        else {
            SimulateVK(userData.vk);
        }
    }
    userData.simSampler.endFrame();

    userData.drawSampler.startFrame();

    if(userData.simMode !== JS_SIM_MODE) {
        ++userData.curTestNum;

        if(userData.curTestNum == userData.maxTestNum) {
            // clearInterval(userData.mainLoop);    
            if (userData.simMode === CL_SIM_MODE) {
                console.log("setArg1:" +((userData.timeSetArg1/userData.maxTestNum)/1000)+"s");
                console.log("setArg2:" +((userData.timeSetArg2/userData.maxTestNum)/1000)+"s");
                console.log("queue.finish:" +((userData.timeFinish/userData.maxTestNum)/1000)+"s");
                console.log("queue.enqueueNDRangeKernel:"+((userData.timeNDRangeKernel/userData.maxTestNum)/1000)+"s");
                console.log("queue.enqueueCopyBuffer:" +((userData.timeCopyBuffer/userData.maxTestNum)/1000)+"s");
                console.log("queue.enqueueReadBuffer:" +((userData.timeReadBuffer/userData.maxTestNum)/1000)+"s");
            } else if (userData.simMode === VK_SIM_MODE) {
                console.log("vkQueueSubmit:" + ((userData.timeFinish/userData.maxTestNum)/1000)+"s");
                console.log("readBuffer:" + ((userData.timeReadBuffer/userData.maxTestNum)/1000)+"s");
                console.log("writeBuffer:" + ((userData.timeCopyBuffer/userData.maxTestNum)/1000)+"s");
            }
            userData.curTestNum = 0;
            userData.timeSetArg1 = 0;
            userData.timeSetArg2 = 0;
            userData.timeFinish = 0;
            userData.timeNDRangeKernel = 0;
            userData.timeCopyBuffer = 0;
            userData.timeReadBuffer = 0;
        }
    }

    Draw();
    // end drawSampler when we re-enter MainLoop()
}

function Draw() {
    if(userData.drawMode === JS_DRAW_MODE)
        DrawJS(userData.ctx);
    else
        DrawGL(userData.gl);
}

function SetSimMode(simMode) {
    var div = document.getElementById("sim");

    if(simMode === JS_SIM_MODE) {
        div.firstChild.nodeValue = "JS";
        document.getElementById("devices").style.visibility = "hidden";
    } else if(simMode == CL_SIM_MODE) {
        div.firstChild.nodeValue = (userData.cl === null)? "NA" : "CL";
        document.getElementById("devices").style.visibility = "visible";
    }
    else {
        div.firstChild.nodeValue = "VK";
        document.getElementById("devices").style.visibility = "hidden";
    }

    userData.simMode = simMode;
}

function SetDrawMode(drawMode) {
    var canvas2D = document.getElementById("canvas2D");
    var canvas3D = document.getElementById("canvas3D");
    var div = document.getElementById("drw");

    if(drawMode === JS_DRAW_MODE) {
        canvas2D.style.visibility = "visible";
        canvas3D.style.visibility = "hidden";
        div.firstChild.nodeValue = "JS";
    }
    else {
        canvas2D.style.visibility = "hidden";
        canvas3D.style.visibility = "visible";
        div.firstChild.nodeValue = (userData.gl === null)? "NA" : "GL";
    }

    userData.drawMode = drawMode;
}

function ToggleDrawMode()
{
    SetDrawMode(!userData.drawMode);
}

function ToggleSimMode()
{
    if (userData.simMode === JS_SIM_MODE) {
        SetSimMode(CL_SIM_MODE);
    } else if (userData.simMode == CL_SIM_MODE) {
        SetSimMode(VK_SIM_MODE);
    } else {
        SetSimMode(JS_SIM_MODE);
    }
}

function ToggleSimRunning()
{
    userData.isSimRunning = !userData.isSimRunning;
}

function Toggle3D()
{
    userData.is3D = !userData.is3D;
}

function ToggleDevice(device)
{
    userData.gpu = (device === 'CPU') ? false : true;
    InitCL();
}

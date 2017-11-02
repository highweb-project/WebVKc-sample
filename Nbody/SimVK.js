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

var vkCurPosBuffer;                           // Vulkan buffer
var vkCurVelBuffer;                           // Vulkan buffer
var vkNxtPosBuffer;                           // Vulkan buffer
var vkNxtVelBuffer;                           // Vulkan buffer

var vkBufferSize = null;

var vkGlobalWorkSize = new Int32Array(1);
var vkLocalWorkSize = new Int32Array(1);
var vkWorkGroupSize = null;

var vkDevice = null;
var vkCommandQueue = null;
var vkProgram = null;

function InitVK() {
    var vk = null;

    try {
        vk = window.webvkc;

        if (vk === null) {
            console.error("No webvkc object available");
            return null;
        }

        vk.initialize();

        vkBufferSize = NBODY * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT;

        vkDevice = vk.createDevice();
        vkCommandQueue = vkDevice.createCommandQueue();

        var code = getKernel("nbody_shader");
        console.log("createProgramWithShaderCode")
        vkProgram = vkDevice.createProgramWithShaderCode(code, 8);

        vkCurPosBuffer = vkDevice.createBuffer(vkBufferSize);
        vkCurVelBuffer = vkDevice.createBuffer(vkBufferSize);
        vkNxtPosBuffer = vkDevice.createBuffer(vkBufferSize);
        vkNxtVelBuffer = vkDevice.createBuffer(vkBufferSize);

        vkGlobalWorkSize[0] = NBODY;
        vkLocalWorkSize[0] = 256;

        var vkNumBodies = vkDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
        var vkDeltaTime = vkDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT);
        var vkEpsSqr = vkDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
        var vkLocalPos = vkDevice.createBuffer(localWorkSize[0] * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT);

        vkCurPosBuffer.fillBuffer(0, 0);
        vkCurVelBuffer.fillBuffer(0, 0);
        vkNxtPosBuffer.fillBuffer(0, 0);
        vkNxtVelBuffer.fillBuffer(0, 0);
        vkNumBodies.fillBuffer(0, 0);
        vkDeltaTime.fillBuffer(0, 0);
        vkEpsSqr.fillBuffer(0, 0);
        vkLocalPos.fillBuffer(0, 0);

        vkNumBodies.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([NBODY]));
        vkDeltaTime.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT, new Float32Array([DT]));
        vkEpsSqr.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([EPSSQR]));

        vkCurPosBuffer.writeBuffer(0, vkBufferSize, userData.curPos);
        vkCurVelBuffer.writeBuffer(0, vkBufferSize, userData.curVel);

        vkProgram.setArg(0, vkCurPosBuffer);
        vkProgram.setArg(1, vkCurVelBuffer);
        vkProgram.setArg(2, vkNumBodies);
        vkProgram.setArg(3, vkDeltaTime);
        vkProgram.setArg(4, vkEpsSqr);
        vkProgram.setArg(5, vkLocalPos);
        vkProgram.setArg(6, vkNxtPosBuffer);
        vkProgram.setArg(7, vkNxtVelBuffer);

        vkProgram.updateDescriptor();

        startTimer();

        vkCommandQueue.begin(vkProgram);
        // vkCommandQueue.dispatch(vkBufferSize/NBODY);
        vkCommandQueue.dispatch(4);
        vkCommandQueue.barrier();
        vkCommandQueue.copyBuffer(vkNxtPosBuffer, vkCurPosBuffer, vkBufferSize);
        vkCommandQueue.copyBuffer(vkNxtVelBuffer, vkCurVelBuffer, vkBufferSize);
        vkCommandQueue.end();

        endTimer(3);
    } catch(e) {
        console.error("Nbody Demo Failed, Message: "+ e.message);
    }

    return vk;
}

var enabled = true;

function SimulateVK(vk) {
    if (vk === null) {
        return;
    }

    try {
        startTimer();
        vkDevice.submit(vkCommandQueue);
        vkDevice.wait();
        vkCurPosBuffer.readBuffer(0, vkBufferSize, userData.curPos);
        vkCurVelBuffer.readBuffer(0, vkBufferSize, userData.curVel);
        endTimer(4);

    } catch (e) {
        console.error("Nbody Demo Failed, Message: "+ e.message);
    }
}

var startTime = 0;
function startTimer() {
  var d = new Date();
  startTime = d.getTime();
}

function endTimer(msg) {
  var d = new Date();

  switch(msg) {
    case 1:
    userData.timeSetArg += (d.getTime()-startTime);
    break;
    case 2:
    userData.timeFinish += (d.getTime()-startTime);
    break;
    case 3:
    userData.timeCopyBuffer += (d.getTime()-startTime);
    break;
    case 4:
    userData.timeReadBuffer += (d.getTime()-startTime);
    break;
    case 5:
    userData.timeNDRangeKernel += (d.getTime()-startTime);
    break;
    case 6:
    userData.timeSetArg1 += (d.getTime()-startTime);
    break;
    case 7:
    userData.timeSetArg2 += (d.getTime()-startTime);
    break;
    case 8:
    userData.timeSetArg3 += (d.getTime()-startTime);
    break;
  }

  startTime = 0;
}

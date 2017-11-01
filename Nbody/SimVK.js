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

var code = "\
#version 430\n\
/*\n\
 * This confidential and proprietary software may be used only as\n\
 * authorised by a licensing agreement from ARM Limited\n\
 * (C) COPYRIGHT 2016 ARM Limited\n\
 *     ALL RIGHTS RESERVED\n\
 * The entire notice above must be reproduced on all authorised\n\
 * copies and copies may only be made to the extent permitted\n\
 * by a licensing agreement from ARM Limited.\n\
 */\n\
layout(local_size_x=256, local_size_y=1, local_size_z=1) in;\n\
\n\
layout (binding=0, std430) buffer a2\n\
{\n\
    float curPos[];\n\
};\n\
layout (binding=1, std430) buffer a1\n\
{\n\
    float curVel[];\n\
};\n\
layout (binding=2, std430) buffer a4\n\
{\n\
    int numBodies;\n\
};\n\
layout (binding=3, std430) buffer a5\n\
{\n\
    float deltaTime;\n\
};\n\
layout (binding=4, std430) buffer a6\n\
{\n\
    int epsSqr;\n\
};\n\
layout (binding=5, std430) buffer a7\n\
{\n\
    float localPos[];\n\
};\n\
layout (binding=6, std430) buffer a8\n\
{\n\
    float nxtPos[];\n\
};\n\
layout (binding=7, std430) buffer a9\n\
{\n\
    float nxtVel[];\n\
};\n\
\n\
const float PI = 3.1415926535897932384626433832795;\n\
\n\
void main()\n\
{\n\
    uint gid = gl_GlobalInvocationID.x;\n\
\n\
    uint tid = gl_LocalInvocationID.x;\n\
\n\
    uint localSize = 256;\n\
\n\
//     // Number of tiles we need to iterate\n\
    uint numTiles = numBodies / localSize;\n\
\n\
    vec4 myPos = { curPos[4 * gid + 0], curPos[4 * gid + 1], curPos[4 * gid + 2], curPos[4 * gid + 3] };\n\
    vec4 acc = { 0.0f, 0.0f, 0.0f, 0.0f };\n\
\n\
    for(int i = 0; i < numTiles; ++i) {\n\
        // load one tile into local memory\n\
        uint idx = i * localSize + tid;\n\
        for(int k=0; k<4; k++)\n\
        {\n\
              localPos[4*tid+k] = curPos[4*idx+k];\n\
        }\n\
        // Synchronize to make sure data is available for processing\n\
        //barrier();\n\
        // calculate acceleration effect due to each body\n\
        // a[i->j] = m[j] * r[i->j] / (r^2 + epsSqr)^(3/2)\n\
        for(int j = 0; j < localSize; ++j)\n\
        {\n\
            // Calculate acceleration caused by particle j on particle i\n\
            vec4 aLocalPos = { localPos[4*j + 0], localPos[4*j + 1], localPos[4*j + 2], localPos[4*j + 3] };\n\
            vec4 r = aLocalPos - myPos;\n\
            float distSqr = r.x * r.x  +  r.y * r.y +  r.z * r.z;\n\
            float invDist = 1.0f / sqrt(distSqr + epsSqr);\n\
            float invDistCube = invDist * invDist * invDist;\n\
            float s = aLocalPos.w * invDistCube;\n\
            // accumulate effect of all particles\n\
            acc += s * r;\n\
        }\n\
        // Synchronize so that next tile can be loaded\n\
        //barrier();\n\
    }\n\
    vec4 oldVel = { curVel[4*gid + 0], curVel[4*gid + 1], curVel[4*gid + 2], curVel[4*gid + 3] };\n\
\n\
        // updated position and velocity\n\
    vec4 newPos = myPos + oldVel * deltaTime + acc * 0.5f * deltaTime * deltaTime;\n\
    newPos.w = myPos.w;\n\
    vec4 newVel = oldVel + acc * deltaTime;\n\
\n\
    // check boundry\n\
    if(newPos.x > 1.0f || newPos.x < -1.0f || newPos.y > 1.0f || newPos.y < -1.0f || newPos.z > 1.0f || newPos.z < -1.0f) {\n\
        float rand = (1.0f * gid) / numBodies;\n\
        float r = 0.05f *  rand;\n\
        float theta = rand;\n\
        float phi = 2 * rand;\n\
        newPos.x = r * sin(PI * theta) * cos(PI * phi);\n\
        newPos.y = r * sin(PI * theta) * sin(PI * phi);\n\
        newPos.z = r * cos(PI * theta);\n\
        newVel.x = 0.0f;\n\
        newVel.y = 0.0f;\n\
        newVel.z = 0.0f;\n\
    }\n\
\n\
    // write to global memory\n\
    nxtPos[4*gid + 0] = newPos.x;\n\
    nxtPos[4*gid + 1] = newPos.y;\n\
    nxtPos[4*gid + 2] = newPos.z;\n\
    nxtPos[4*gid + 3] = newPos.w;\n\
\n\
    nxtVel[4*gid + 0] = newVel.x;\n\
    nxtVel[4*gid + 1] = newVel.y;\n\
    nxtVel[4*gid + 2] = newVel.z;\n\
    nxtVel[4*gid + 3] = newVel.w;\n\
}\n\
\n\
";

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

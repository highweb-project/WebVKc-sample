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

var vkcDevice;
var vkcCommandQueue;
var vkcProgram;

var vkcInitPosBuffer;
var vkcCurPosBuffer;
var vkcCurNorBuffer;
var vkcParamBuffer;
var vkcVerticesBuffer;
var vkcPBuffer;
var vkcGBuffer;
var vkcPhase;

var vkcGlobalWorkSize = new Int32Array(2);

var vkcP = new Int32Array([151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
  151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
]);

  var vkcG = new Float32Array([
  	 +1.0, +1.0, +0.0, 0.0 ,
  	 -1.0, +1.0, +0.0, 0.0 ,
  	 +1.0, -1.0, +0.0, 0.0 ,
  	 -1.0, -1.0, +0.0, 0.0 ,
  	 +1.0, +0.0, +1.0, 0.0 ,
  	 -1.0, +0.0, +1.0, 0.0 ,
  	 +1.0, +0.0, -1.0, 0.0 ,
  	 -1.0, +0.0, -1.0, 0.0 ,
  	 +0.0, +1.0, +1.0, 0.0 ,
  	 +0.0, -1.0, +1.0, 0.0 ,
  	 +0.0, +1.0, -1.0, 0.0 ,
  	 +0.0, -1.0, -1.0, 0.0 ,
  	 +1.0, +1.0, +0.0, 0.0 ,
  	 -1.0, +1.0, +0.0, 0.0 ,
  	 +0.0, -1.0, +1.0, 0.0 ,
  	 +0.0, -1.0, -1.0, 0.0
  ]);

function InitVKC() {
    try  {
        var vk = window.webvkc;
        if (vk === null) {
            console.error("Failed to fetch a webvkc instance.");
            return null;
        }
        var VKC_BUFFER_SIZE = userData.nVertices * NUM_VERTEX_COMPONENTS;

        vk.initialize();

        vkcDevice = vk.createDevice();
        vkcCommandQueue = vkcDevice.createCommandQueue();

        var code = getKernel("deform_shader");
        vkcProgram = vkcDevice.createProgramWithShaderCode(code, 8);
    } catch (e) {
        console.error("Deform Demo Failed ; Message: " + e.message);
    }
    return vk;
}

function InitVKCBuffers(vk) {
  try {
    var VKC_BUFFER_SIZE = userData.nVertices * NUM_VERTEX_COMPONENTS;

    console.log("InitVKCBuffers");
    if (vk === null)
        return;

    vkcGlobalWorkSize[0] = 1;
    vkcGlobalWorkSize[1] = 1;
    while(vkcGlobalWorkSize[0] * vkcGlobalWorkSize[1] <userData.nVertices) {
        vkcGlobalWorkSize[0] = vkcGlobalWorkSize[0] * 2;
        vkcGlobalWorkSize[1] = vkcGlobalWorkSize[1] * 2;
    }

    console.log("userData.nVertices" + userData.nVertices);
    console.log("globalWorkSize[0]: " + vkcGlobalWorkSize[0]);
    console.log("globalWorkSize[1]: " + vkcGlobalWorkSize[1]);

    vkcInitPosBuffer = vkcDevice.createBuffer(VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT);
    vkcCurPosBuffer = vkcDevice.createBuffer(VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT);
    vkcCurNorBuffer = vkcDevice.createBuffer(VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT);
    vkcParamBuffer = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT * 7);
    vkcVerticesBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
    vkcPBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT * 512);
    vkcGBuffer = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT * 64);
    vkcPhase = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT);

    vkcInitPosBuffer.writeBuffer(0, VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT, userData.initPos);
    var param = new Float32Array([userData.frequency, userData.amplitude, userData.lacunarity, userData.increment, userData.octaves, userData.roughness]);

    vkcParamBuffer.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT * 6, param);
    vkcVerticesBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([userData.nVertices]));
    vkcPBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT * 512, vkcP);
    vkcGBuffer.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT * 64, vkcG);
    vkcPhase.fillBuffer(0, 0);

    vkcProgram.setArg(0, vkcInitPosBuffer);
    vkcProgram.setArg(1, vkcCurNorBuffer);
    vkcProgram.setArg(2, vkcCurPosBuffer);
    vkcProgram.setArg(3, vkcParamBuffer);
    vkcProgram.setArg(4, vkcVerticesBuffer);
    vkcProgram.setArg(5, vkcPBuffer);
    vkcProgram.setArg(6, vkcGBuffer);
    vkcProgram.setArg(7, vkcPhase);
    vkcProgram.updateDescriptor();

    vkcCommandQueue.begin(vkcProgram);
    vkcCommandQueue.dispatch(vkcGlobalWorkSize[0] / 32, vkcGlobalWorkSize[1] / 32);
    vkcCommandQueue.barrier();
    vkcCommandQueue.end();
  }
  catch (e) {
      console.error("Deform Demo Failed ; Message: " + e.message);
  }

}

var vkconce = 0;
function SimulateVKC(vk)
{
  try {
    if (vk === null)
      return;

    var VKC_BUFFER_SIZE = userData.nVertices * NUM_VERTEX_COMPONENTS;

    vkcPhase.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT, new Float32Array([userData.phase]));

    vkcDevice.submit(vkcCommandQueue);
    vkcDevice.wait();

    vkcCurPosBuffer.readBuffer(0, VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT, userData.curPos);
    vkcCurNorBuffer.readBuffer(0, VKC_BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT, userData.curNor);
  }
  catch (e) {
    console.error("Deform Demo Failed ; Message: " + e.message);
  }
  //
  userData.phase += PHASE_DELTA;
}

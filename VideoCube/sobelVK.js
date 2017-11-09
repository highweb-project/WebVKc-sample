var vkc;
var vkcDevice;
var vkcCommandQueue;
var vkcProgram;

var vkcInputBuffer = null; // VK buffer
var vkcOutputBuffer = null; // VK buffer
var vkcWidthBuffer = null;
var vkcHeightBuffer = null;
var vkcInputData = null; // Float32Array
var vkcOutputData = null; // Float32Array

var vkcGlobalWorkSize = null;
var vkcLocalWorkSize = null;

var vkcBlockSizeX;
var vkcBlockSizeY;

function initVK() {
    vkc = window.webvkc;
    if (vkc === null) {
        console.error("window.webvkc is null");
    }

    vkc.initialize();
    vkcDevice = vkc.createDevice();
    vkcCommandQueue = vkcDevice.createCommandQueue();

    fetch('videocube.comp').then(function(response) {
        return response.text();
    }).then(function(content) {
        vkcProgram = vkcDevice.createProgramWithShaderCode(content, 4);
    });

    return vkc;
}

function sobelVK(vk, inputCanvas, outputCanvas, inputContext, outputContext) {
    try {
        var i;
        var imageData = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
        var nPixels = imageData.data.length;

        if (vkcInputData === null) {
            vkcInputData = new Float32Array(nPixels);
        }

        for (i = 0; i < nPixels; i++) {
            vkcInputData[i] = imageData.data[i];
        }

        if (vkcInputBuffer === null) {
            vkcInputBuffer = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT * nPixels);
        }

        if (vkcOutputBuffer === null) {
            vkcOutputBuffer = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT * nPixels);
        }

        if (vkcWidthBuffer === null) {
            vkcWidthBuffer = vkcDevice.createBuffer(Uint32Array.BYTES_PER_ELEMENT);
        }

        if (vkcHeightBuffer === null) {
            vkcHeightBuffer = vkcDevice.createBuffer(Uint32Array.BYTES_PER_ELEMENT);
        }

        if (vkcInputBuffer === null || vkcOutputBuffer === null || vkcWidthBuffer === null || vkcHeightBuffer === null) {
            console.error("Failed to create buffers");
            return;
        }

        vkcInputBuffer.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT * nPixels, vkcInputData);
        var w = inputCanvas.width;
        var h = inputCanvas.height;

        vkcWidthBuffer.writeBuffer(0, Uint32Array.BYTES_PER_ELEMENT, new Uint32Array([w]));
        vkcHeightBuffer.writeBuffer(0, Uint32Array.BYTES_PER_ELEMENT, new Uint32Array([h]));

        if (vkcGlobalWorkSize === null || vkcLocalWorkSize === null) {
            vkcProgram.setArg(0, vkcInputBuffer);
            vkcProgram.setArg(1, vkcOutputBuffer);
            vkcProgram.setArg(2, vkcWidthBuffer);
            vkcProgram.setArg(3, vkcHeightBuffer);
            vkcProgram.updateDescriptor();

            var workGroupSize = vkcDevice.getInfo(vkc.VKC_maxComputeWorkGroupInvocations);
            if (workGroupSize < inputCanvas.width) {
                console.error("Max work group size is too small: " + workGroupSize);
                return;
            }

            vkcBlockSizeX = inputCanvas.width;
            vkcBlockSizeY = 1;
            if (vkcBlockSizeX * vkcBlockSizeY > workGroupSize) {
                console.error("Block sizes are too big");
                return;
            }

            vkcGlobalWorkSize = new Int32Array([w, h]);
            vkcLocalWorkSize = new Int32Array([vkcBlockSizeX, vkcBlockSizeY]);

            vkcCommandQueue.begin(vkcProgram);
            vkcCommandQueue.dispatch(1, 16);
            vkcCommandQueue.barrier();
            vkcCommandQueue.end();
        }

        vkcDevice.submit(vkcCommandQueue);
        vkcDevice.wait();

        imageData = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
        nPixels = imageData.data.length;

        if (vkcOutputData === null) {
            vkcOutputData = new Float32Array(nPixels);
        }
        vkcOutputBuffer.readBuffer(0, Float32Array.BYTES_PER_ELEMENT * nPixels, vkcOutputData);

        for (i = 0; i < nPixels; i += 4) {
            imageData.data[i] = vkcOutputData[i];
            imageData.data[i + 1] = vkcOutputData[i + 1];
            imageData.data[i + 2] = vkcOutputData[i + 2];
            imageData.data[i + 3] = 255;
        }

        outputContext.putImageData(imageData, 0, 0);
    } catch (e) {
        console.error("Error on SobelVK = " + e.message);
        throw e;
    }
}

function resetBuffersVK() {
    vkcInputBuffer = null;
    vkcOutputBuffer = null;
}
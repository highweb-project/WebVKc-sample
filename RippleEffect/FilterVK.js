var vkc;
var vkcDevice;
var vkcCommandQueue;
var vkcProgram;

var vkcInputBuffer = null;
var vkcOutputBuffer = null;
var vkcWidthBuffer = null;
var vkcHeightBuffer = null;
var vkcDiagBuffer = null;
var vkcTBuffer = null;
var vkcCxBuffer = null;
var vkcCyBuffer = null;

var nRGBAvalsVK;
var nBytesVK;
var dataVK; // Float32Array (Uint8 does not work)

var vkcBlockSizeX = 64; // for ripple
var vkcBlockSizeY = 64; // for ripple

var vkcGlobalThreads = new Int32Array(2);
var vkcLocalThreads = new Int32Array(2);

var isVKActive = false; // prevent requeuing while still active

function initVK() {
    try {
        var maxWorkGroupSize;
        vkc = window.webvkc;

        vkc.initialize();
        vkcDevice = vkc.createDevice();
        vkcCommandQueue = vkcDevice.createCommandQueue();

        fetch('ripple.comp').then(function(response) {
            return response.text();
        }).then(function(content) {
            vkcProgram = vkcDevice.createProgramWithShaderCode(content, 8);

            vkcWidthBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
            vkcHeightBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
            vkcDiagBuffer = vkcDevice.createBuffer(Float32Array.BYTES_PER_ELEMENT);
            vkcTBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
            vkcCxBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);
            vkcCyBuffer = vkcDevice.createBuffer(Int32Array.BYTES_PER_ELEMENT);

            vkcProgram.setArg(0, vkcInputBuffer);
            vkcProgram.setArg(1, vkcOutputBuffer);
            vkcProgram.setArg(2, vkcWidthBuffer);
            vkcProgram.setArg(3, vkcHeightBuffer);
            vkcProgram.setArg(4, vkcDiagBuffer);
            vkcProgram.setArg(5, vkcTBuffer);
            vkcProgram.setArg(6, vkcCxBuffer);
            vkcProgram.setArg(7, vkcCyBuffer);
            vkcProgram.updateDescriptor();

            vkcCommandQueue.begin(vkcProgram);
            vkcCommandQueue.dispatch(10, 25);
            vkcCommandQueue.barrier();
            vkcCommandQueue.end();
        });

        maxWorkGroupSize = vkcDevice.getInfo(vkc.VKC_maxComputeWorkGroupInvocations);

        while (vkcBlockSizeX * vkcBlockSizeY > maxWorkGroupSize) {
            vkcBlockSizeX = vkcBlockSizeX / 2;
            vkcBlockSizeY = vkcBlockSizeY / 2;
        }

        nRGBAvalsVK = width * height * 4;
        nBytesVK = nRGBAvalsVK * Float32Array.BYTES_PER_ELEMENT;

        vkcInputBuffer = vkcDevice.createBuffer(nBytesVK);
        vkcOutputBuffer = vkcDevice.createBuffer(nBytesVK);
        dataVK = new Float32Array(nRGBAvalsVK);

        var inputPixels = inputContext.getImageData(0, 0, width, height).data;
        var i;
        for (i = 0; i < nRGBAvalsVK; i++) {
            dataVK[i] = inputPixels[i];
        }

        vkcInputBuffer.writeBuffer(0, nBytesVK, dataVK);
    } catch (e) {
        console.error("ERROR: " + e.message, e);
        return false;
    }

    return true;
}

function releaseBuffersVK() {
    try {
        vkcOutputBuffer.release();
        vkcInputBuffer.release();
    } catch (e) {
        console.error(e.message);
    }
}

function runFilterVK(t, cx, cy, diag) {
    if (isVKActive) {
        return;
    }

    isVKActive = true;
    runRippleVK(t, cx, cy, diag);
}

function runRippleVK(t, cx, cy, diag) {
    vkcWidthBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([width]));
    vkcHeightBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([height]));
    vkcDiagBuffer.writeBuffer(0, Float32Array.BYTES_PER_ELEMENT, new Float32Array([diag]));
    vkcTBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([t]));
    vkcCxBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([cx]));
    vkcCyBuffer.writeBuffer(0, Int32Array.BYTES_PER_ELEMENT, new Int32Array([cy]));

    vkcGlobalThreads[0] = width;
    vkcGlobalThreads[1] = height;
    vkcLocalThreads[0] = vkcBlockSizeX;
    vkcLocalThreads[1] = vkcBlockSizeY;

    tStart = new Date().valueOf();
    vkcDevice.submit(vkcCommandQueue);
    vkcDevice.wait();

    getResultsVK();
}

function getResultsVK() {
    tEnd = new Date().valueOf();

    vkcOutputBuffer.readBuffer(0, nBytesVK, dataVK);
    isVKActive = false;

    var outputImageData = outputContext.getImageData(0, 0, width, height);
    var outputPixels = outputImageData.data;

    var i;
    for (i = 0; i < nRGBAvalsVK; i++) {
        outputPixels[i] = dataVK[i];
    }

    outputContext.putImageData(outputImageData, 0, 0);

    showResults();
}
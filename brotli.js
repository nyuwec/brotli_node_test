#!/usr/bin/env node

var brotliCompressSync = require('iltorb').compressSync;
var lzmaCompress = require('lzma-native').compress;
var zlib = require('zlib');
var loremIpsum = require('lorem-ipsum');
var request = require('sync-request');
var _ = require("highland");
var runningTests = {
    items: [],
    push: function(testName, dataPrefix) { runningTests.items.push(testName + dataPrefix);},
    remove: function(testName, dataPrefix) { runningTests.items.splice(runningTests.items.indexOf(testName + dataPrefix), 1);},
    length: function() { return runningTests.items.length; }
};
var testResults = {
    items: {},
    push: function(compressType, elapsed, prefix, orig, compressed) {
        elapsed = process.hrtime(elapsed);

        if (!testResults.items[prefix]) {
            testResults.items[prefix] = {"originalSize": orig.length};
            testResults.items[prefix][compressType] = {};
        }
        testResults.items[prefix][compressType] = {
            "elapsed": Math.round(elapsed[0]*1000 + elapsed[1]/1000000) + "ms",
            "resultSize": compressed.length,
            "compressionRatio": Math.round(compressed.length / orig.length * 100) + "%"
        };
        runningTests.remove(compressType, prefix);
    },
    dump: function() {
        return testResults.items;
    }
};

function compressLZMA(prefix, text, t, myself) {
    lzmaCompress(text, function(result){
        testResults.push(myself, t, prefix, text, result);
    });
}

function compressBrotli(prefix, text, t, myself) {
    var result = brotliCompressSync(
        new Buffer(text), {
            mode: 0,
            quality: 6, // this gets close results to deflate
            lgwin: 24,
            lgblock: 0
        });
    testResults.push(myself, t, prefix, text, result);
}

function compressDeflate(prefix, text, t, myself) {
    var result = zlib.deflateSync(text);
    testResults.push(myself, t, prefix, text, result);
}

function compressGZIP(prefix, text, t, myself) {
    var result = zlib.gzipSync(text);
    testResults.push(myself, t, prefix, text, result);
}

function runAllCompressors(arrText) {
    var functions = [compressDeflate, compressBrotli, compressLZMA, compressGZIP];
    _(arrText).each(function(obj) {
        _(functions).each(function(func){
            runningTests.push(func.name, obj.name);
            var t = process.hrtime();
            func(obj.name, obj.text, t, func.name);
        });
    });
}

function waitForTests() {
    if (runningTests.length() > 0) {
        setTimeout(waitForTests, 100);
    } else {
        console.log(JSON.stringify(testResults.dump(), null, 2));
    }
}

// tests:
var loremText = loremIpsum({count: 10000});
console.log("lorem text generated: %d", loremText.length);

var cssText = request('GET', 'https://prezi-a.akamaihd.net/your-versioned/1166-45553d3942a0e45b984f115bbfcc112159f4c0cd/CACHE/css/8ab55e441066.css').getBody();
console.log("css downloaded: %d", loremText.length);

var jsText = request('GET', 'https://prezi-a.akamaihd.net/your-versioned/1166-45553d3942a0e45b984f115bbfcc112159f4c0cd/CACHE/js/5dac91d2f2f4.js').getBody();
console.log("js downloaded: %d", loremText.length);

var wikipedia = require("node-wikipedia");
var wikipediaContent = "";
wikipedia.page.data("Marthandavarma_(novel)", { content: true }, function(response) {
    wikipediaContent = response.text['*'];
    console.log("wikipedia text fetched: %d", wikipediaContent.length);
    runAllCompressors([
        {"name": "lorem", "text": loremText},
        {"name": "wikipedia", "text": wikipediaContent},
        {"name": "css", "text": cssText},
        {"name": "js", "text": jsText}
    ]);
    waitForTests();
});

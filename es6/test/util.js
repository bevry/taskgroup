'use strict'

let fs = require('fs'), profiler = require('v8-profiler')

let util = {}
util.saveSnapshot = function (testname, next) {
	// https://github.com/node-inspector/v8-profiler/blob/851baf05bb8c98936751e0b3984a4e4195c3e3af/test/cpu_cprofiler.js#L200-L212
	let filename = testname+'.heapsnapshot'
	let result = '' // not a buffer
	let snapshot = profiler.takeSnapshot(testname)

	next = next || function(error){
		if ( error ) return console.error(error)
		console.log('Snapshot taken successfully:', filename)
	}

	let concatIterator = function (data) {
		result += data // not a buffer
	}
	let complete = function () {
		fs.writeFile(filename, result, next)
	}
	snapshot.serialize(concatIterator, complete)
}

util.startProfile = function (testname) {
	let recordSamples = true // generate flame data
	profiler.startProfiling(testname, recordSamples)
}
util.stopProfile = function (testname, next) {
	let filename = testname+'.cpuprofile'
	let cpuProfile = profiler.stopProfiling(testname)
	let profileJSON = JSON.stringify(cpuProfile)

	next = next || function(error){
		if ( error ) return console.error(error)
		console.log('Profile taken successfully:', filename)
	}

	// lets us see the deopt reason in latest chrome
	profileJSON = profileJSON.replace(/"bailoutReason":/g, '"deoptReason":')

	// Write the file
	fs.writeFile(filename, profileJSON, next)
}
module.exports = util

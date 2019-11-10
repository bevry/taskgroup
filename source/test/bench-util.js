'use strict'

const fsUtil = require('fs')
const pathUtil = require('path')
const profiler = require('v8-profiler')

function writeFile(filepath, data, next) {
	try {
		fsUtil.writeFileSync(filepath, data)
	} catch (error) {
		next(error)
		return
	}
	next()
}

function saveSnapshot(testname, next) {
	// https://github.com/node-inspector/v8-profiler/blob/851baf05bb8c98936751e0b3984a4e4195c3e3af/test/cpu_cprofiler.js#L200-L212
	const filename = testname + '.heapsnapshot'
	const filepath = pathUtil.join(process.cwd(), filename)
	let result = '' // not a buffer
	let snapshot = profiler.takeSnapshot(testname)

	next =
		next ||
		function(error) {
			if (error) return console.error(error)
			console.log('Snapshot taken successfully:', filepath)
		}

	function concatIterator(data) {
		result += data // not a buffer
	}
	function complete() {
		snapshot.delete()
		snapshot = null

		writeFile(filepath, result, next)
	}

	snapshot.serialize(concatIterator, complete)
}

function startProfile(testname) {
	profiler.startProfiling(testname, true)
}

function stopProfile(testname, next) {
	const filename = testname + '.cpuprofile'
	const filepath = pathUtil.join(process.cwd(), filename)
	let cpuProfile = profiler.stopProfiling(testname)
	let profileJSON = JSON.stringify(cpuProfile)

	cpuProfile.delete()
	cpuProfile = null

	next =
		next ||
		function(error) {
			if (error) return console.error(error)
			console.log('Profile taken successfully:', filepath)
		}

	// lets us see the deopt reason in latest chrome
	profileJSON = profileJSON.replace(/"bailoutReason":/g, '"deoptReason":')

	// Write the file
	writeFile(filepath, profileJSON, next)
}

// Exports
module.exports = { saveSnapshot, startProfile, stopProfile }

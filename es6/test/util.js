const fsUtil = require('fs'), pathUtil = require('path'), profiler = require('v8-profiler')

const writeFile = function (filepath, data, next) {
	try {
		fsUtil.writeFileSync(filepath, data)
	}
	catch (error) {
		next(error)
		return
	}
	next()
}

export const saveSnapshot = function (testname, next) {
	// https://github.com/node-inspector/v8-profiler/blob/851baf05bb8c98936751e0b3984a4e4195c3e3af/test/cpu_cprofiler.js#L200-L212
	const filename = testname+'.heapsnapshot'
	const filepath = pathUtil.join(process.cwd(), filename)
	let result = '' // not a buffer
	let snapshot = profiler.takeSnapshot(testname)

	next = next || function (error) {
		if ( error )  return console.error(error)
		console.log('Snapshot taken successfully:', filepath)
	}

	const concatIterator = function (data) {
		result += data // not a buffer
	}
	const complete = function () {
		snapshot.delete()
		snapshot = null

		writeFile(filepath, result, next)
	}

	snapshot.serialize(concatIterator, complete)
}

export const startProfile = function (testname) {
	profiler.startProfiling(testname, true)
}

export const stopProfile = function (testname, next) {
	const filename = testname+'.cpuprofile'
	const filepath = pathUtil.join(process.cwd(), filename)
	let cpuProfile = profiler.stopProfiling(testname)
	let profileJSON = JSON.stringify(cpuProfile)

	cpuProfile.delete()
	cpuProfile = null

	next = next || function (error) {
		if ( error )  return console.error(error)
		console.log('Profile taken successfully:', filepath)
	}

	// lets us see the deopt reason in latest chrome
	profileJSON = profileJSON.replace(/"bailoutReason":/g, '"deoptReason":')

	// Write the file
	writeFile(filepath, profileJSON, next)
}

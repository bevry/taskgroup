'use strict'

const { TaskGroup } = require('../../')

const testname = 'taskgroup-profile-test'
const mode = 'bench' // 'profile'
const total = 100000 // 100,000

// Start profiling
const profileUtils = mode !== 'bench' ? require('./profile-utils') : null
if (mode === 'profile') profileUtils.startProfile(testname)

// Prepare
function createTask(name, value) {
	return function () {
		// $status.innerHTML += value
		return value
	}
}

// Log
console.log('Running benchmarks on:', process.versions)

// Create the taskgroup
const start = new Date().getTime()
const tasks = TaskGroup.create()

// Add the tasks
console.log(`Adding ${total} tasks`)
for (let i = 0, n = total; i < n; ++i) {
	const name = 'Task ' + i
	const value = 'Value ' + i
	const task = createTask(name, value)
	tasks.addTask(name, task)
}

// Listen for complete
tasks.done(function () {
	const end = new Date().getTime()
	const totalSeconds = ((end - start) / 1000).toFixed(2)
	console.log(`Completed ${total} tasks. Total seconds: ${totalSeconds}`)

	if (mode === 'heap') {
		profileUtils.saveSnapshot(testname + '-before') // 121mb heap (due to itemsCompleted in GC)
		setTimeout(function () {
			profileUtils.saveSnapshot(testname + '-after') // 3mb heap
		}, 1000)
	} else if (mode === 'profile') {
		setTimeout(function () {
			profileUtils.stopProfile(testname)
		}, 2000)
	}
})

// Run the tasks
console.log('Running tasks')
tasks.run()

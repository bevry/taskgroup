import * as util from './util'
let TaskGroup = require('../../')
let testname = 'taskgroup-profile-test'
let mode = 'heap'

// Start profiling
if ( mode === 'profile' ) util.startProfile(testname)

// Prepare
const createTask = function (name, value) {
	return function () {
		// $status.innerHTML += value
		return value
	}
}

// Create the taskgroup
const tasks = TaskGroup.create()

// Add the tasks
for ( let i = 0, n = 50000; i < n; ++i ) {
	const name = 'Task '+i
	const value = 'Value '+i
	const task = createTask(name, value)
	tasks.addTask(name, task)
}

// Listen for complete
tasks.done(function () {
	if ( mode === 'heap ') {
		util.saveSnapshot(testname)
	}
	else {
		setTimeout(function () {
			util.stopProfile(testname)
		}, 2000)
	}
})

// Run the tasks
tasks.run()

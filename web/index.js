/* eslinte-env browser */
'use strict'

const TaskGroup = require('../es2015/index.js').TaskGroup
const $status = document.getElementById('status')
const $performance = document.getElementById('performance')
$performance.onclick = window.performanceTest = function () {
	$status.innerHTML = 'Running!'

	// Prepare
	function createTask (name, value) {
		return function () {
			// $status.innerHTML += value
			return value
		}
	}

	// Create the taskgroup
	const tasks = TaskGroup.create()

	// Add the tasks
	for ( let i = 0, n = 50000; i < n; ++i ) {
		const name = 'Task ' + i
		const value = 'Value ' + i
		const task = createTask(name, value)
		tasks.addTask(name, task)
	}

	// Listen for completion
	tasks.done(function () {
		$status.innerHTML = 'Done!'
	})

	// Start the taskgroup
	tasks.run()
}
$status.innerHTML = 'Loaded!'

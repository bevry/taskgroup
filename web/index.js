'use strict'
let TaskGroup = require('../esnext/lib/index.js')
let $status = document.getElementById('status')
let $performance = document.getElementById('performance')
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
	let tasks = TaskGroup.create()

	// Add the tasks
	for ( let i = 0, n = 50000; i < n; ++i ) {
		let name = 'Task ' + i
		let value = 'Value ' + i
		let task = createTask(name, value)
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

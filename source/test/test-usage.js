// Import
const joe = require('joe')
const {expectErrorViaFunction, throwErrorViaCallback, returnViaCallback, completeViaCallback, expectViaCallback, expectErrorViaCallback} = require('assert-helpers')
const {wait} = require('./test-util')
const {Task, TaskGroup} = require('../../')

// Prepare
const delay = 100

// Helpers
class TaskGroupDebug extends TaskGroup {
	get TaskGroup () { return TaskGroupDebug }
	constructor (...args) {
		super(...args)
		this.events.forEach((event) => {
			console.log(`${this.names}: ${event}: listening`)
			this.on(event, console.log.bind(console.log, `${this.names}: ${event}:`))
		})
	}
}

// Task
joe.suite('task', function (suite, test) {
	// failure: done with no run
	test('Task.create(...).done(...) should time out when run was not called', function (complete) {
		Task.create(returnViaCallback(5))
			.done(throwErrorViaCallback('unexpected error'))
		wait(delay, complete)
	})

	// failure: done with no task method
	test('Task.create().run().done(...) should fail as there was no task method defined', function (complete) {
		Task.create()
			.run()
			.done(expectErrorViaCallback('no method', 'error was as expected', complete))
	})

	// success: run then done
	test('Task.create(...).run().done(...) should fire the completion callback with the expected result', function (complete) {
		Task.create(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, 5))
			.done(complete)
	})

	// success: done then run
	test('Task.create(...).done(...).run() should fire the completion callback with the expected result', function (complete) {
		Task.create(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, 5))
			.done(complete)
	})

	// failure: done then run then run
	test('Task.create(...).done(...).run().run() should fail as a task is not allowed to run twice', function (complete) {
		Task.create(returnViaCallback(5))
			.on('error', expectErrorViaCallback('run status', 'error was emitted and caught by the listener expected', complete))
			.run().run()
	})

	// failure: run then run then done
	test('Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', function (complete) {
		expectErrorViaFunction('run status', function () {
			Task.create(returnViaCallback(5))
				.run().run()
				.on('error', throwErrorViaCallback('unexpected error'))
		}, 'error was uncaught by the error listener as expected, because the error listener was bound after the error was emitted', complete)
	})
})

// Taskgroup
joe.suite('taskgroup', function (suite, test) {
	// failure: done with no run
	test('TaskGroup.create().addTask(...).done(...) should time out when run was not called', function (complete) {
		TaskGroup.create()
			.addTask(returnViaCallback(5))
			.done(throwErrorViaCallback('unexpected error'))
		wait(delay, complete)
	})

	// success: done with no tasks then run
	test('TaskGroup.create().run().done(...) should complete with no result', function (complete) {
		TaskGroup.create()
			.run()
			.done(expectViaCallback(null, []))
			.done(complete)
	})

	/*
	// failure: multiple runs
	test('Taskgroup should not be able to complete multiple times by default', function (complete) {
		const tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, [[null, 5]]))
		wait(delay, function () {
			tasks
				// @TODO failure detection should go here, however it is harder to do
				// as this is not a documented failure condition...
				// as addTask actually calls fire... which detecting destruction is difficult...
				// perhaps addTask should not call fire... perhaps another call to .run() should be required
				// which makes sense, will leave until other tests are passing
				.addTask(returnViaCallback(10))
				.done(expectViaCallback(null, [[null, 5], [null, 10]]))
				.done(complete)
		})
	})
	*/

	// success: multiple runs
	test('Taskgroup should be able to complete multiple times with destroyOnceDone: false', function (complete) {
		const tasks = TaskGroup.create({destroyOnceDone: false})
			.addTask(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, [[null, 5]]))
		wait(delay, function () {
			tasks
				.addTask(returnViaCallback(10))
				.done(expectViaCallback(null, [[null, 5], [null, 10]]))
				.done(complete)
		})
	})

	// success: run then done then add
	test('TaskGroup.create().run().done(...).addTask(...) should complete with the tasks result', function (complete) {
		TaskGroupDebug.create()
			.run()
			.done(expectViaCallback(null, [[null, 5]]))
			.done(complete)
			.addTask(returnViaCallback(5))
	})

	// success: done then task then run then done
	test('TaskGroup.create().done().addTask(...).run().addTask(...).done(...) should complete correctly', function (complete) {
		TaskGroup.create()
			.done(expectViaCallback(null, [[null, 5], [null, 10]]))
			.addTask('task 1 that will return 5', returnViaCallback(5))
			.run()
			.addTask('task 2 that will return 10', returnViaCallback(10))
			.done(complete)
	})

	// success: done then task then run then done
	test('TaskGroup.create().run().run().done(...) should complete only once', function (complete) {
		TaskGroup.create()
			.done(expectViaCallback(null, [[null, 5], [null, 10]]))
			.addTask(returnViaCallback(5))
			.run().run()
			.addTask(returnViaCallback(10))
			.done(complete)
	})

	// success: pause after error
	test('Taskgroup should pause when encountering an error', function (complete) {
		const err = new Error('fail after 5')
		TaskGroup.create()
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null, 5], [err]]))
			.done(function () {
				complete()
			})
	})

	// success: resume after error
	test('Taskgroup should be able to resume after an error', function (complete) {
		const err = new Error('fail after 5')
		const tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null, 5], [err]]))
		wait(delay, function () {
			tasks
				.addTask(returnViaCallback(15))
				.done(expectViaCallback(null, [[null, 5], [err], [null, 10], [null, 15]]))
				.done(complete)
		})
	})

	// success: ignore after error
	test('Taskgroup should ignore when encountering an error with different config', function (complete) {
		const err = new Error('fail after 5')
		TaskGroup.create({onError: 'ignore'})
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(null, [
				[null, 5], [err], [null, 10]
			]))
			.done(function () {
				complete()
			})
	})

	// failure: nested timeouts
	test('Taskgroup should apply nested configuration to tasks', function (complete) {
		TaskGroup.create()
			.setConfig({
				nestedTaskConfig: {
					timeout: delay,
					onError: 'ignore'
				}
			})
			.addTask(returnViaCallback(5))
			.addTask(completeViaCallback(10, delay * 2))
			.addTask(returnViaCallback(15))
			.run()
			.done(expectErrorViaCallback('timed out', 'error was as expected', complete))
	})
})

// @TODO for each test here, give a real world example of where it is actually used
// so we know if it is actually real usage, or imagined usage, if imagined usage, then we can break/remove/change

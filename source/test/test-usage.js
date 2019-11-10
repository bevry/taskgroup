'use strict'

// Import
const kava = require('kava')
const {
	equal,
	errorEqual,
	expectThrowViaFunction,
	throwErrorViaCallback,
	returnViaCallback,
	expectViaCallback,
	expectErrorViaCallback
} = require('assert-helpers')
const { wait } = require('./test-util')
const { Task, TaskGroup } = require('../')

// Prepare
const delay = 100

function bump(checks, thrower) {
	if (checks.i == null) checks.i = 0
	if (checks.n == null) checks.n = 0
	++checks.n
	return err => {
		++checks.i
		if (err && thrower) {
			checks.error = err
			if (thrower === 'function') {
				thrower(err)
			}
			throw err
		}
	}
}

function bumped(checks, next) {
	if (checks.i == null) checks.i = 0
	if (checks.n == null) checks.n = 0
	wait(delay * 2, () => {
		errorEqual(checks.error || null, null, 'checks ran without error')
		equal(checks.i, checks.n, 'all expected checks ran')
		if (next) next()
	})
}

// Task
kava.suite('test-usage: task', function(suite, test) {
	// failure: done with no run
	test('Task.create(...).done(...) should time out when run was not called', function(complete) {
		const checks = {}
		Task.create(returnViaCallback(5)).done(
			throwErrorViaCallback('unexpected error')
		)
		bumped(checks, complete)
	})

	// failure: done with no task method
	test('Task.create().run().done(...) should fail as there was no task method defined', function(complete) {
		const checks = {}
		Task.create()
			.run()
			.done(
				expectErrorViaCallback(
					'no method',
					'error was as expected',
					bump(checks, complete)
				)
			)
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: run then done
	test('Task.create(...).run().done(...) should fire the completion callback with the expected result', function(complete) {
		const checks = {}
		Task.create(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, 5))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: done then run
	test('Task.create(...).done(...).run() should fire the completion callback with the expected result', function(complete) {
		const checks = {}
		Task.create(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, 5))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// failure: done then run then run
	test('Task.create(...).done(...).run().run() should fail as a task is not allowed to run twice', function(complete) {
		const checks = {}
		Task.create(returnViaCallback(5))
			.on(
				'error',
				expectErrorViaCallback(
					'run status',
					'error was emitted and caught by the listener expected',
					bump(checks, complete)
				)
			)
			.run()
			.run()
		bumped(checks, complete)
	})

	// failure: run then run then done
	test('Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', function(complete) {
		const checks = {}
		expectThrowViaFunction(
			'run status',
			function() {
				Task.create(returnViaCallback(5))
					.run()
					.run()
					.on('error', throwErrorViaCallback('unexpected error'))
			},
			'error was uncaught by the error listener as expected',
			bump(checks, complete)
		)
		bumped(checks, complete)
	})
})

// Taskgroup
kava.suite('test-usage: taskgroup', function(suite, test) {
	// success: done with no tasks then run
	test('TaskGroup.create().run().done(...) should complete with no result', function(complete) {
		const checks = {}
		TaskGroup.create()
			.run()
			.done(expectViaCallback(null, []))
			.done(bump(checks))
		bumped(checks, complete)
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
	test('Taskgroup should be able to complete multiple times with destroyOnceDone: false', function(complete) {
		const checks = {}
		const tasks = TaskGroup.create({
			destroyOnceDone: false,
			storeResult: true
		})
			.addTask(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, [[null, 5]]))

		// @TODO should probably require a new .run() and a clear of results

		wait(delay, function() {
			tasks
				.addTask(returnViaCallback(10))
				.done(
					expectViaCallback(null, [
						[null, 5],
						[null, 10]
					])
				)
				.done(bump(checks))
			bumped(checks, complete)
		})
	})

	// success: run then done then add
	test('TaskGroup.create().run().done(...).addTask(...) should complete with the tasks result', function(complete) {
		const checks = {}
		TaskGroup.create()
			.run()
			.done(expectViaCallback(null, [[null, 5]]))
			.done(bump(checks))
			.addTask(returnViaCallback(5))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: done then task then run then done
	test('TaskGroup.create().done().addTask(...).run().addTask(...).done(...) should complete correctly', function(complete) {
		const checks = {}
		TaskGroup.create()
			.done(
				expectViaCallback(null, [
					[null, 5],
					[null, 10]
				])
			)
			.done(bump(checks))
			.addTask('task 1 that will return 5', returnViaCallback(5))
			.run()
			.done(
				expectViaCallback(null, [
					[null, 5],
					[null, 10]
				])
			)
			.done(bump(checks))
			.addTask('task 2 that will return 10', returnViaCallback(10))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: done then task then run then done
	test('TaskGroup.create().run().run().done(...) should complete only once', function(complete) {
		const checks = {}
		TaskGroup.create()
			.done(
				expectViaCallback(null, [
					[null, 5],
					[null, 10]
				])
			)
			.done(bump(checks))
			.addTask(returnViaCallback(5))
			.run()
			.run()
			.addTask(returnViaCallback(10))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: pause after error
	test('Taskgroup should pause when encountering an error', function(complete) {
		const checks = {}
		const err = new Error('fail after 5')
		TaskGroup.create()
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null, 5], [err]]))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: ignore after error
	test('Taskgroup should ignore when encountering an error with different config', function(complete) {
		const checks = {}
		const err = new Error('fail after 5')
		TaskGroup.create({ abortOnError: false })
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(null, [[null, 5], [err], [null, 10]]))
			.done(bump(checks))
		bumped(checks, complete)
	})

	// success: resume after error
	test('Taskgroup should be able to resume after an error', function(complete) {
		const checks = {}
		const err = new Error('fail after 5')
		const tasks = TaskGroup.create({
			destroyOnceDone: false,
			storeResult: true
		})
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null, 5], [err]]))
			.done(bump(checks))

		// @TODO should probably require a new .run() and a clear of results

		wait(delay, function() {
			tasks
				.addTask(returnViaCallback(15))
				.done(
					expectViaCallback(null, [[null, 5], [err], [null, 10], [null, 15]])
				)
				.done(bump(checks))
			bumped(checks, complete)
		})
	})
})

// @TODO for each test here, give a real world example of where it is actually used
// so we know if it is actually real usage, or imagined usage, if imagined usage, then we can break/remove/change

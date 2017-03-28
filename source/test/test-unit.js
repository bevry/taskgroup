/* eslint consistent-this:0 */
'use strict'

// Imports
const joe = require('joe')
const {equal, deepEqual, errorEqual} = require('assert-helpers')
const {wait} = require('./test-util')
const {Task, TaskGroup} = require('../')

/* eslint no-extend-native:0, no-cond-assign:0, prefer-rest-params:0 */
// do not use ...args instead of arguments, will crash node v5 and below
// https://travis-ci.org/bevry/taskgroup/jobs/134675452
Array.prototype.remove = function () {
	// http://stackoverflow.com/a/3955096/130638
	let what, L = arguments.length, ax
	while ( L && this.length ) {
		what = arguments[--L]
		while ((ax = this.indexOf(what)) !== -1) {
			this.splice(ax, 1)
		}
	}
	return this
}

// Helpers
class TaskGroupDebug extends TaskGroup {

	get TaskGroup () { return TaskGroupDebug }

	prepare () {
		if ( !this.itemsStatusMap ) {
			const me = this
			this.itemsStatusMap = {
				remaining: [],
				pending: [],
				running: [],
				done: []
			}
			this.on('item.add', function (item) {
				me.updateItemStatus(item, 'remaining')
				item.once('pending', function () {
					me.updateItemStatus(item, 'pending')
				})
				item.once('running', function () {
					me.updateItemStatus(item, 'running')
				})
				item.done(function () {
					me.updateItemStatus(item, 'done')
				})
			})
		}
	}

	updateItemStatus (item, status) {
		this.itemsStatusMap.remaining.remove(item)
		this.itemsStatusMap.pending.remove(item)
		this.itemsStatusMap.running.remove(item)
		this.itemsStatusMap.done.remove(item)
		this.itemsStatusMap[status].push(item)
	}

	getNamesOfItemsByStatus (status) {
		return this.itemsStatusMap[status].map((item) => item.name)
	}

	get itemDetails () {
		const status = this.state.status
		const remaining = this.getNamesOfItemsByStatus('remaining')
		const pending = this.getNamesOfItemsByStatus('pending')
		const running = this.getNamesOfItemsByStatus('running')
		const done = this.getNamesOfItemsByStatus('done')
		const result = this.result
		const error = this.error
		return {status, remaining, pending, running, done, result, error}
	}

	compare (_expectedDetails, testName) {
		// Do user comparison
		const debugDetails = this.itemDetails

		// Ensure details exist and are in correct order
		const expectedDetails = {
			status: _expectedDetails.status,
			remaining: _expectedDetails.remaining || [],
			pending: _expectedDetails.pending || [],
			running: _expectedDetails.running || [],
			done: _expectedDetails.done || [],
			result: typeof _expectedDetails.result === 'undefined' ? [] : _expectedDetails.result,
			error: _expectedDetails.error || null
		}

		// Add totals comparison too
		const actualTotals = this.itemTotals
		const debugTotals = {
			remaining: debugDetails.remaining.length,
			executing: debugDetails.pending.length + debugDetails.running.length,
			done: debugDetails.done.length,
			total: debugDetails.remaining.length + debugDetails.pending.length + debugDetails.running.length + debugDetails.done.length,
			result: debugDetails.result && debugDetails.result.length
		}
		debugDetails.totals = debugTotals
		expectedDetails.totals = actualTotals

		// Do the comparison
		deepEqual(debugDetails, expectedDetails, testName)

		// Compare result argument
		if ( _expectedDetails.resultArgument ) {
			deepEqual(_expectedDetails.resultArgument, this.result, testName + ': result argument was as expected')
		}

		// Compare error argument
		if ( _expectedDetails.errorArgument ) {
			errorEqual(_expectedDetails.errorArgument, this.error, testName + ': error argument was as expected')
		}
	}

}

// Prepare
const delay = 100

// Task
joe.suite('task', function (suite) {
	// Basic
	suite('basic', function (suite, test) {
		// Async
		// Test that the task executes correctly asynchronously
		test('should work with async', function (done) {
			// Specify how many special checks we are expecting
			const checks = []

			// Create our asynchronous task
			const task = Task.create(function (complete) {
				checks.push('task 1 - before wait')
				// Wait a while as this is an async test
				wait(delay, function () {
					checks.push('task 1 - after wait')
					equal(task.status, 'running', 'status to be running as we are within the task')
					equal(task.result, null, 'result to be null as we haven\'t set it yet')
					// Return no error, and the result to the completion callback completing the task
					complete(null, 10)
				})
			})

			// Check the task completed as expected
			task.done(function (err, result) {
				checks.push('completion callback')
				errorEqual(err, null, 'the callback error to be null as we did not error')
				equal(result, 10, 'the callback result to be as expected')
				deepEqual(task.result, [result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, 'created', 'status to be created as we haven\'t called run yet')
			equal(task.result, null, 'result to be null as we haven\'t called run yet')

			// Run the task
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'pending', 'status to be pending as we just called run, and execute tasks asynchronously')
			equal(task.result, null, 'result to be null as we just called run, and execute tasks asynchronously')

			// Check that all our special checks have run
			wait(delay * 2, function () {
				deepEqual(checks, [
					'task 1 - before wait',
					'task 1 - after wait',
					'completion callback'
				], 'all testing checks fired correctly')
				done()
			})
		})

		// Sync
		// Test that the task
		test('should work with sync', function (done) {
			// Specify how many special checks we are expecting
			let checks = 0

			// Create our synchronous task
			const task = new Task(function () {
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, 'result to be null as we haven\'t set it yet')
				// Return our result completing the task
				return 10
			})

			// Check the task completed as expected
			task.done(function (err, result) {
				++checks
				errorEqual(err, null, 'the callback error to be null as we did not error')
				equal(result, 10, 'the callback result to be as expected')
				deepEqual(task.result, [result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, 'created', 'status to be created as we haven\'t called run yet')
			equal(task.result, null, 'result to be null as we haven\'t called run yet')

			// Run the task
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'pending', 'status to be pending as we just called run, and execute tasks asynchronously')
			equal(task.result, null, 'result to be null as we just called run, and execute tasks asynchronously')

			// Check that all our special checks have run
			wait(delay, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				done()
			})
		})
	})

	// Error Handling
	suite('errors', function (suite, test) {
		test('should detect return error on synchronous task', function (done) {
			// Specify how many special checks we are expecting
			let checks = 0
			const errMessage = 'deliberate return error'
			const err = new Error(errMessage)

			// Create our synchronous task
			const task = new Task(function () {
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, 'result to be null as we haven\'t set it yet')
				return err
			})

			// Check the task completed as expected
			task.done(function (_err, result) {
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				deepEqual(task.result, [], 'the set result to be as expected as the task has completed')
				equal(_err, err, 'the callback error to be set as we errord')
				equal(result, null, 'the callback result to be null we errord')
			})

			// Check task hasn't run yet
			equal(task.status, 'created', 'status to be created as we haven\'t called run yet')
			equal(task.result, null, 'result to be null as we haven\'t called run yet')

			// Run the task
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'pending', 'status to be pending as we just called run, and execute tasks asynchronously')
			equal(task.result, null, 'result to be null as we just called run, and execute tasks asynchronously')

			// Check that all our special checks have run
			wait(delay, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				done()
			})
		})

		test('should detect sync throw error on synchronous task', function (done) {
			// Specify how many special checks we are expecting
			let checks = 0
			const errMessage = 'deliberate sync throw error'
			const err = new Error(errMessage)

			// Create our synchronous task
			const task = new Task(function () {
				++checks
				equal(task.result, null, 'result to be null as we haven\'t set it yet')
				equal(task.status, 'running', 'status to be running as we are within the task')
				throw err
			})

			// Check the task completed as expected
			task.done(function (_err, result) {
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				equal(_err, err, 'the callback error to be set as we errord')
				equal(result, null, 'result to be null as there was no result')
			})

			// Check task hasn't run yet
			equal(task.status, 'created', 'status to be created as we haven\'t called run yet')
			equal(task.result, null, 'result to be null as we haven\'t called run yet')

			// Run the task
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'pending', 'status to be pending as we just called run, and execute tasks asynchronously')
			equal(task.result, null, 'result to be null as we just called run, and execute tasks asynchronously')

			// Check that all our special checks have run
			wait(delay, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				done()
			})
		})

		test('should detect async throw error on asynchronous task', function (done) {
			// Check node version
			if ( process.versions.node.substr(0, 3) === '0.8' ) {
				console.log('skip this test on node 0.8 because domains behave differently')
				return done()
			}

			// Specify how many special checks we are expecting
			let checks = 0
			const errMessage = 'deliberate async throw error'
			const err = new Error(errMessage)

			// Create our asynchronous task
			/* eslint no-unused-vars:0 */
			const task = new Task(function (done) {
				wait(delay, function () {
					++checks
					equal(task.status, 'running', 'status to be running as we are within the task')
					equal(task.result, null, 'result to be null as we haven\'t set it yet')
					throw err
				})
			})

			// Check the task completed as expected
			task.done(function (_err, result) {
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				equal(_err, err, 'the callback error to be set as we errord')
				equal(result, null, 'result to be null as there was no result')
			})

			// Check task hasn't run yet
			equal(task.status, 'created', 'status to be created as we haven\'t called run yet')
			equal(task.result, null, 'result to be null as we haven\'t called run yet')

			// Run the task
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'pending', 'status to be pending as we just called run, and execute tasks asynchronously')
			equal(task.result, null, 'result to be null as we just called run, and execute tasks asynchronously')

			// Check that all our special checks have run
			wait(delay * 2, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				done()
			})
		})

		// https://github.com/bevry/taskgroup/issues/17
		test('it should not catch errors within the completion callback: issue 17, with domains', function (done) {
			// Run our test file
			/* eslint handle-callback-err:0 */
			require('safeps').exec(`node ${__dirname}/test-issue17-a.js`, {cwd: __dirname}, function (err, stdout, stderr) {
				// Check if we got the error we expected
				if ( stderr.indexOf('Error: goodbye world') !== -1 ) {
					done()
				}
				else {
					const err = new Error('Issue 17 check did not execute correctly')
					console.log('stdout:\n', stdout, '\nstderr:\n', stderr, '\n')
					done(err)
				}
			})
		})

		test('it should not catch errors within the completion callback: issue 17, without domains', function (done) {
			// Run our test file
			/* eslint handle-callback-err:0 */
			require('safeps').exec(`node ${__dirname}/test-issue17-b.js`, {cwd: __dirname}, function (err, stdout, stderr) {
				// Check if we got the error we expected
				if ( stderr.indexOf('Error: goodbye world\n    at Task.') !== -1 ) {
					done()
				}
				else {
					const err = new Error('Issue 17 check did not execute correctly')
					console.log('stdout:\n', stdout, '\nstderr:\n', stderr, '\n')
					done(err)
				}
			})
		})
	})

	// Basic
	suite('arguments', function (suite, test) {
		// Sync
		test('should work with arguments in sync', function (done) {
			// Prepare
			const checks = []

			// Create
			const task = new Task(function (a, b) {
				checks.push('my task')
				equal(task.result, null)
				return a * b
			})

			// Apply the arguments
			task.setConfig({args: [2, 5]})

			// Check
			task.done(function (err, result) {
				checks.push('completion callback')
				deepEqual(task.result, [result])
				errorEqual(err, null)
				equal(result, 10)
			})

			// Check
			wait(delay, function () {
				deepEqual(checks, ['my task', 'completion callback'])
				done()
			})

			// Run
			task.run()
		})

		// Async
		test('should work with arguments in async', function (done) {
			// Prepare
			const checks = []

			// Create
			const task = new Task(function (a, b, complete) {
				checks.push('my task - before wait')
				wait(delay, function () {
					checks.push('my task - after wait')
					equal(task.result, null)
					complete(null, a * b)
				})
			})

			// Apply the arguments
			task.setConfig({args: [2, 5]})

			// Check
			task.done(function (err, result) {
				checks.push('completion callback')
				deepEqual(task.result, [result])
				errorEqual(err, null)
				equal(result, 10)
			})

			// Check
			wait(delay * 2, function () {
				deepEqual(checks, ['my task - before wait', 'my task - after wait', 'completion callback'])
				done()
			})

			// Run
			task.run()
		})
	})
})

// Task Group
joe.suite('taskgroup', function (suite) {
	// Basic
	suite('basic', function (suite, test) {
		// Serial
		test('should work when running in serial', function (done) {

			const tasks = new TaskGroupDebug({name: 'my parent group'})
			tasks.done(function (err, result) {
				errorEqual(err, null)
				equal(tasks.config.concurrency, 1)

				tasks.compare({
					status: 'passed',
					done: ['my task 1', 'my task 2'],
					result: [[null, 10], [null, 20]],
					resultArgument: result,
					errorArgument: err
				}, 'inside tasks.done')

				done()
			})

			tasks.addTask('my task 1', function (complete) {
				tasks.compare({
					status: 'running',
					remaining: ['my task 2'],
					running: ['my task 1']
				}, 'inside task 1 before wait')

				wait(delay, function () {
					tasks.compare({
						status: 'running',
						remaining: ['my task 2'],
						running: ['my task 1']
					}, 'inside task 1 after wait')

					complete(null, 10)
				})
			})

			tasks.addTask('my task 2', function () {
				tasks.compare({
					status: 'running',
					running: ['my task 2'],
					done: ['my task 1'],
					result: [[null, 10]]
				}, 'inside task 2')

				return 20
			})

			tasks.compare({
				status: 'created',
				remaining: ['my task 1', 'my task 2'],
				result: null
			}, 'before tasks.run')

			tasks.run()

			tasks.compare({
				status: 'pending',
				remaining: ['my task 1', 'my task 2']
			}, 'after tasks.run')
		})

		// Parallel with new API
		test('should work when running in parallel', function (done) {

			const tasks = new TaskGroupDebug({concurrency: 0})
			tasks.done(function (err, result) {
				errorEqual(err, null)
				equal(tasks.config.concurrency, 0)

				tasks.compare({
					status: 'passed',
					done: ['task 2', 'task 1'],
					result: [[null, 20], [null, 10]],
					resultArgument: result,
					errorArgument: err
				}, 'inside tasks.done')

				done()
			})

			tasks.addTask('task 1', function (complete) {
				tasks.compare({
					status: 'running',
					pending: ['task 2'],
					running: ['task 1']
				}, 'inside task 1 before wait')

				wait(delay, function () {
					tasks.compare({
						status: 'running',
						running: ['task 1'],
						done: ['task 2'],
						result: [[null, 20]]
					}, 'inside task 1 after wait')

					complete(null, 10)
				})
			})

			tasks.addTask('task 2', function () {
				tasks.compare({
					status: 'running',
					running: ['task 1', 'task 2']
				}, 'inside task 2')

				return 20
			})

			tasks.compare({
				status: 'created',
				remaining: ['task 1', 'task 2'],
				result: null
			}, 'before tasks.run')

			tasks.run()

			tasks.compare({
				status: 'pending',
				remaining: ['task 1', 'task 2']
			}, 'after tasks.run')
		})

		// Parallel
		test('should work when running in parallel with new API', function (done) {

			const tasks = TaskGroupDebug.create({
				name: 'my tasks',
				concurrency: 0,
				next (err, result) {
					errorEqual(err, null)
					equal(tasks.config.concurrency, 0)

					tasks.compare({
						status: 'passed',
						done: ['task 2 for [my tasks]', 'task 1 for [my tasks]'],
						result: [[null, 20], [null, 10]],
						resultArgument: result,
						errorArgument: err
					}, 'inside tasks.done')

					done()
				},

				tasks: [
					function (complete) {
						tasks.compare({
							status: 'running',
							pending: ['task 2 for [my tasks]'],
							running: ['task 1 for [my tasks]']
						}, 'inside task 1 before wait')

						wait(delay, function () {
							tasks.compare({
								status: 'running',
								running: ['task 1 for [my tasks]'],
								done: ['task 2 for [my tasks]'],
								result: [[null, 20]]
							}, 'inside task 1 after wait')

							complete(null, 10)
						})
					},
					function () {
						tasks.compare({
							status: 'running',
							running: ['task 1 for [my tasks]', 'task 2 for [my tasks]']
						}, 'inside task 1 after wait')

						return 20
					}
				]
			})

			tasks.compare({
				status: 'created',
				remaining: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
				result: null
			}, 'before tasks.run')

			tasks.run()

			tasks.compare({
				status: 'pending',
				remaining: ['task 1 for [my tasks]', 'task 2 for [my tasks]']
			}, 'after tasks.run')
		})
	})

	// Basic
	suite('errors', function (suite, test) {
		const err1 = new Error('deliberate error')
		const err2 = new Error('unexpected error')

		// Error Serial
		test('should handle error correctly in serial', function (done) {

			const tasks = new TaskGroupDebug({name: 'my tasks', concurrency: 1}).done(function (err, result) {
				equal(tasks.config.concurrency, 1)

				tasks.compare({
					status: 'failed',
					remaining: ['task 2'],
					done: ['task 1'],
					result: [[err1]],
					resultArgument: result,
					error: err1,
					errorArgument: err
				}, 'inside tasks.done')

				done()
			})

			tasks.addTask('task 1', function (complete) {
				tasks.compare({
					status: 'running',
					remaining: ['task 2'],
					running: ['task 1']
				}, 'inside task 1')

				complete(err1)
			})

			tasks.addTask('task 2', function () {
				throw err2
			})

			tasks.compare({
				status: 'created',
				remaining: ['task 1', 'task 2'],
				result: null
			}, 'before tasks.run')

			tasks.run()

			tasks.compare({
				status: 'pending',
				remaining: ['task 1', 'task 2']
			}, 'after tasks.run')
		})

		// Parallel
		test('should handle error correctly in parallel', function (done) {

			const tasks = new TaskGroupDebug({name: 'my tasks', concurrency: 0}).done(function (err, result) {
				equal(tasks.config.concurrency, 0)

				tasks.compare({
					status: 'failed',
					done: ['task 2', 'task 1'],
					result: [[err2], [err1]],
					resultArgument: result,
					error: err2,
					errorArgument: err
				}, 'inside tasks.done')

				done()
			})

			// Error via completion callback
			tasks.addTask('task 1', function (complete) {
				tasks.compare({
					status: 'running',
					pending: ['task 2'],
					running: ['task 1'],
					total: 2,
					result: []
				}, 'inside task 1 before wait')

				wait(delay, function () {
					tasks.compare({
						status: 'running',
						running: ['task 1'],
						done: ['task 2'],
						error: err2,
						result: [[err2]]
					}, 'inside task 1 after wait')

					complete(err1)
				})

				return null
			})

			// Error via return
			tasks.addTask('task 2', function () {
				tasks.compare({
					status: 'running',
					running: ['task 1', 'task 2']
				}, 'inside task 2')

				return err2
			})

			tasks.compare({
				status: 'created',
				remaining: ['task 1', 'task 2'],
				result: null
			}, 'before tasks.run')

			tasks.run()

			tasks.compare({
				status: 'pending',
				remaining: ['task 1', 'task 2']
			}, 'after tasks.run')
		})
	})
})

// Test Runner
joe.suite('nested', function (suite, test) {

	// Traditional
	test('traditional format', function (done) {
		const checks = []

		const tasks = new TaskGroupDebug({name: 'my parent group'}).run()

		tasks.addTask('my task a', function (complete) {
			checks.push('my task a - part 1/2')
			equal(this.name, 'my task a')

			// totals for parent group
			tasks.compare({
				status: 'running',
				remaining: ['my group b'],
				running: ['my task a']
			}, 'inside my task a before wait')

			wait(delay, function () {
				checks.push('my task a - part 2/2')

				// totals for parent group
				tasks.compare({
					status: 'running',
					remaining: ['my group b'],
					running: ['my task a']
				}, 'inside my task a after wait')

				complete(null, 10)
			})
		})

		tasks.addTaskGroup('my group b', function () {
			const myGroup = this
			checks.push('my group b')
			equal(this.name, 'my group b')

			// totals for parent group
			tasks.compare({
				status: 'running',
				running: ['my group b'],
				done: ['my task a'],
				result: [[null, 10]]
			}, 'inside my group b method, comparing parent')

			// totals for sub group
			myGroup.compare({
				status: 'running',
				running: ['taskgroup method for my group b']
			}, 'inside my group b method, comparing my group')

			this.addTask('my task c', function () {
				checks.push('my task c')
				equal(this.name, 'my task c')

				// totals for parent group
				tasks.compare({
					status: 'running',
					running: ['my group b'],
					done: ['my task a'],
					result: [[null, 10]]
				}, 'inside my group b task c, comparing parent')

				// totals for sub group
				myGroup.compare({
					status: 'running',
					running: ['my task c'],
					done: ['taskgroup method for my group b']
				}, 'inside my group b task c, comparing my group')

				return 20
			})

			// totals for sub group
			myGroup.compare({
				status: 'running',
				remaining: ['my task c'],
				running: ['taskgroup method for my group b']
			}, 'inside my group b method, at end, comparing my group')

		})

		tasks.done(function (err, result) {
			deepEqual(checks, [
				'my task a - part 1/2',
				'my task a - part 2/2',
				'my group b',
				'my task c'
			], 'all the expected checks ran')

			// totals for parent group
			tasks.compare({
				status: 'passed',
				done: ['my task a', 'my group b'],
				result: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				],
				resultArgument: result,
				errorArgument: err
			}, 'inside tasks.done')

			done()
		})
	})

	// Inline
	test('inline format', function (done) {
		const checks = []

		const tasks = new TaskGroupDebug('my parent group', function (addGroup, addTask) {
			equal(this.name, 'my parent group')

			addTask('my task a', function (complete) {
				checks.push('my task a - part 1/2')
				equal(this.name, 'my task a')

				tasks.compare({
					status: 'running',
					remaining: ['my group b'],
					running: ['my task a'],
					done: ['taskgroup method for my parent group']
				}, 'inside my task a before wait')

				wait(delay, function () {
					checks.push('my task a - part 2/2')

					tasks.compare({
						status: 'running',
						remaining: ['my group b'],
						running: ['my task a'],
						done: ['taskgroup method for my parent group']
					}, 'inside my task a after wait')

					complete(null, 10)
				})
			})

			addGroup('my group b', function (addGroup, addTask) {
				const myGroup = this
				checks.push('my group b')
				equal(this.name, 'my group b')

				// totals for parent group
				tasks.compare({
					status: 'running',
					running: ['my group b'],
					done: ['taskgroup method for my parent group', 'my task a'],
					result: [[null, 10]]
				}, 'inside my group b method, comparing parent group')

				// totals for sub group
				myGroup.compare({
					status: 'running',
					running: ['taskgroup method for my group b']
				}, 'inside my group b method, comparing my group b')

				addTask('my task c', function () {
					checks.push('my task c')
					equal(this.name, 'my task c')

					// totals for parent group
					tasks.compare({
						status: 'running',
						running: ['my group b'],
						done: ['taskgroup method for my parent group', 'my task a'],
						result: [[null, 10]]
					}, 'inside my group b task c, comparing parent group')

					// totals for sub group
					myGroup.compare({
						status: 'running',
						running: ['my task c'],
						done: ['taskgroup method for my group b']
					}, 'inside my group b task c, comparing my group b')

					return 20
				})

				// totals for sub group
				myGroup.compare({
					status: 'running',
					remaining: ['my task c'],
					running: ['taskgroup method for my group b']
				}, 'inside my group b method, at end, comparing my group b')
			})
		})

		tasks.done(function (err, result) {
			deepEqual(checks, [
				'my task a - part 1/2',
				'my task a - part 2/2',
				'my group b',
				'my task c'
			], 'all the expected checks ran')

			// totals for parent group
			tasks.compare({
				status: 'passed',
				done: ['taskgroup method for my parent group', 'my task a', 'my group b'],
				result: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				],
				resultArgument: result,
				errorArgument: err
			}, 'inside tasks.done')

			done()
		})
	})

	// Mixed
	test('mixed format', function (done) {
		const checks = []

		const tasks = new TaskGroupDebug({name: 'my parent group'})

		tasks.addTask('my task 1', function () {
			checks.push('my task 1')

			// totals for parent group
			tasks.compare({
				status: 'running',
				remaining: ['my group 1', 'my task 3'],
				running: ['my task 1']
			}, 'inside my task 1')

			return 10
		})

		tasks.addTaskGroup('my group 1', function () {
			const myGroup = this
			checks.push('my group 1')
			equal(this.name, 'my group 1')

			// totals for parent group
			tasks.compare({
				status: 'running',
				remaining: ['my task 3'],
				running: ['my group 1'],
				done: ['my task 1'],
				result: [[null, 10]]
			}, 'inside my group 1 method, comparing parent')

			// totals for sub group
			myGroup.compare({
				status: 'running',
				running: ['taskgroup method for my group 1']
			}, 'inside my group 1 method, comparing my group')

			this.addTask('my task 2', function () {
				checks.push('my task 2')
				equal(this.name, 'my task 2')

				// totals for parent group
				tasks.compare({
					status: 'running',
					remaining: ['my task 3'],
					running: ['my group 1'],
					done: ['my task 1'],
					result: [[null, 10]]
				}, 'inside my group 1 my task 2, comparing parent')

				// totals for sub group
				myGroup.compare({
					status: 'running',
					running: ['my task 2'],
					done: ['taskgroup method for my group 1']
				}, 'inside my group 1 my task 2, comparing my group')

				return 20
			})

			// totals for sub group
			myGroup.compare({
				status: 'running',
				remaining: ['my task 2'],
				running: ['taskgroup method for my group 1']
			}, 'inside my group 1 method, comparing my group')
		})

		tasks.addTask('my task 3', function () {
			checks.push('my task 3')
			equal(this.name, 'my task 3')

			// totals for parent group
			tasks.compare({
				status: 'running',
				running: ['my task 3'],
				done: ['my task 1', 'my group 1'],
				result: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				]
			}, 'inside my task 3')

			return 30
		})

		tasks.done(function (err, result) {
			deepEqual(checks, [
				'my task 1',
				'my group 1',
				'my task 2',
				'my task 3'
			], 'all the expected checks ran')

			// totals for parent group
			tasks.compare({
				status: 'passed',
				done: ['my task 1', 'my group 1', 'my task 3'],
				result: [
					[null, 10],
					[null, [
						[null, 20]
					]],
					[null, 30]
				],
				resultArgument: result,
				errorArgument: err
			}, 'inside tasks.done')

			done()
		})

		tasks.run()
	})

	/*
	// Idle
	test('idling', function (done) {
		checks = []

		tasks = new TaskGroup()

		task = tasks(addTask 'my task 1', function (complete) {
			checks.push('my task 1')
			equal(this.name, 'my task 1')
			equal(tasks.remaining.length, 0)
			equal(tasks.running, 1)

		tasks.done (err) ->
			console.log(err)  if err
			errorEqual(err, null)
			throw new Error('should never reach here')

		tasks.on 'idle', (item) ->
			checks.push('idle check')
			equal(item, task)

			console.log(checks)  if checks.length isnt 2
			equal(checks.length, 'checks', 2)

			tasks.destroy()

		tasks.run()
	*/
})

// @TODO add tests for nested events, to see if they actually work, and are actually useful
// otherwise could remove them

// @TODO add tests for storeResult for task, taskgroup, and nested tasks

// @TODO add tests for nested configuration

/* eslint consistent-this:0 */

// @TODO
// - Add tests for nested configuration

// Imports
const joe = require('joe')
const eachr = require('eachr')
const {equal, deepEqual, errorEqual} = require('assert-helpers')
const {wait} = require('./test-util')
const {Task, TaskGroup} = require('../../')

// Helpers
class TaskGroupTracker {
	constructor (tasks) {
		if ( tasks )  this.taskGroup = tasks
	}

	set taskGroup (tasks) {
		if ( this._taskGroup )  throw new Error('already set')
		this._taskGroup = tasks
		this.items = {}
		tasks.on('item.add', (item) => {
			this.items[item.name] = 'remaining'
			item.once('run', () => {
				this.items[item.name] = 'running'
			})
			item.once('completed', () => {
				this.items[item.name] = 'completed'
			})
		})
	}
	get taskGroup () {
		return this._taskGroup
	}

	get details () {
		const totals = this.taskGroup.itemTotals
		const details = {
			remaining: this.remaining,
			running: this.running,
			completed: this.completed,
			total: this.taskGroup.totalItems,
			results: this.taskGroup.results
		}
		equal(totals.remaining, details.remaining.length, 'item totals and item details has the same count for remaining')
		equal(totals.running, details.running.length, 'item totals and item details has the same count for running')
		equal(totals.completed, details.completed.length, 'item totals and item details has the same count for completed')
		equal(totals.results, details.results.length, 'item totals and item details has the same count for results')
		return details
	}

	get remaining () {
		const arr = []
		eachr(this.items, function (status, name) {
			if ( status === 'remaining' ) {
				arr.push(name)
			}
		})
		return arr
	}

	get running () {
		const arr = []
		eachr(this.items, function (status, name) {
			if ( status === 'running' ) {
				arr.push(name)
			}
		})
		return arr
	}

	get completed () {
		const arr = []
		eachr(this.items, function (status, name) {
			if ( status === 'completed' ) {
				arr.push(name)
			}
		})
		return arr
	}
}

// Prepare
const delay = 100

// Task
joe.suite('task', function (suite, test) {
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
				deepEqual(task.result, [err, result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run thet ask
			task.run()

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

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
				deepEqual(task.result, [err, result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run
			task.run()

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			// Check that all our special checks have run
			wait(delay, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				done()
			})
		})
	})

	// Sync Flag
	suite('sync flag', function (suite, test) {
		// Async
		// Test that the task executes correctly asynchronously
		test('should work with async', function (done) {
			// Specify how many special checks we are expecting
			const checks = []

			// Create our asynchronous task
			const task = Task.create({sync: true}, function (complete) {
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
				equal(err, null, 'the callback error to be null as we did not error')
				equal(result, 10, 'the callback result to be as expected')
				deepEqual(task.result, [err, result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run thet ask
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'running', 'status to be running as we have started running due to sync flag')
			equal(task.result, null, 'result to be set as tasks execute asynchronously')

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
			const task = new Task({sync: true}, function () {
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, 'result to be null as we haven\'t set it yet')
				// Return our result completing the task
				return 10
			})

			// Check the task completed as expected
			task.done(function (err, result) {
				++checks
				equal(err, null, 'the callback error to be null as we did not error')
				equal(result, 10, 'the callback result to be as expected')
				deepEqual(task.result, [err, result], 'the set result to be as expected as the task has completed')
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run
			task.run()

			// Check task hasn't run yet
			equal(task.status, 'destroyed', 'status to be destroyed as we have already finished due to the sync flag')
			deepEqual(task.result, [null, 10], 'result to be set as we have already finished due to the sync flag')

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
				deepEqual(task.result, [err], 'the set result to be as expected as the task has completed')
				equal(_err, err, 'the callback error to be set as we errord')
				equal(result, null, 'the callback result to be null we errord')
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run
			task.run()

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

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
			const neverReached = false
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
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run
			task.run()

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

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
			const neverReached = false
			const errMessage = 'deliberate async throw error'
			const err = new Error(errMessage)

			// Create our asynchronous task
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
			})

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as we haven\'t started running yet')

			// Run
			task.run()

			// Check task hasn't run yet
			equal(task.status, null, 'status to be null as we haven\'t started running yet')
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			// Check that all our special checks have run
			wait(delay * 2, function () {
				++checks
				equal(checks, 3, 'all our special checks have run')
				equal(neverReached, false, 'never reached to be false')
				done()
			})
		})

		test('should error when a timeout has exceeded', function (done) {
			// Specify how many special checks we are expecting
			const checks = []

			// Create our asynchronous task
			const task = Task.create({timeout: delay}, function (complete) {
				wait(delay * 2, function () {
					complete()
				})
			})

			// Check the task completed as expected
			task.whenDone(function (err, result) {
				if ( checks.length === 0 ) {
					checks.push('timeout')
					errorEqual(err, 'timed out')
				}
				else if ( checks.length === 1 ) {
					checks.push('completed twice')
					errorEqual(err, 'already completed')
					done()
				}
			})

			// Run
			task.run()
		})

		test('should not error when a timeout has not exceeded', function (done) {
			// Specify how many special checks we are expecting
			const checks = []

			// Create our asynchronous task
			const task = Task.create({timeout: delay * 2}, function (complete) {
				wait(delay, function () {
					complete()
				})
			})

			// Check the task completed as expected
			task.whenDone(done)

			// Run
			task.run()
		})

		// https://github.com/bevry/taskgroup/issues/17
		test('it should not catch errors within the completion callback: issue 17', function (done) {
			// Run our test file
			/* eslint handle-callback-err:0 */
			require('safeps').exec(`node ${__dirname}/test-issue17.js`, {cwd: __dirname}, function (err, stdout, stderr) {
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
				deepEqual(task.result, [err, result])
				equal(err, null)
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
				deepEqual(task.result, [err, result])
				equal(err, null)
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
joe.suite('taskgroup', function (suite, test) {
	// Basic
	suite('basic', function (suite, test) {
		// Serial
		test('should work when running in serial', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = new TaskGroup({name: 'my tests'})
			tasks.done(function (err, results) {
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.concurrency, 1)

				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: [],
					completed: ['my task 1', 'my task 2'],
					total: 2,
					results: [[null, 10], [null, 20]]
				}

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()
			})

			tasks.addTask('my task 1', function (complete) {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: ['my task 2'],
					running: ['my task 1'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 items before wait items')

				wait(delay, function () {
					const actualItems = tracker.details
					deepEqual(actualItems, expectedItems, 'task 1 items after wait items')

					complete(null, 10)
				})
			})

			tasks.addTask('my task 2', function () {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['my task 2'],
					completed: ['my task 1'],
					total: 2,
					results: [[null, 10]]
				}
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20
			})

			tasks.run()

			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['my task 1', 'my task 2'],
				running: [],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'tasks totals')
		})

		// Parallel with new API
		test('should work when running in parallel', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = new TaskGroup({concurrency: 0})
			tasks.done(function (err, results) {
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.concurrency, 0)

				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: [],
					completed: ['task 2', 'task 1'],
					total: 2,
					results: [[null, 20], [null, 10]]
				}

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()
			})

			tasks.addTask('task 1', function (complete) {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['task 1', 'task 2'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				wait(delay, function () {
					const actualItems = tracker.details
					const expectedItems = {
						remaining: [],
						running: ['task 1'],
						completed: ['task 2'],
						total: 2,
						results: [[null, 20]]
					}
					deepEqual(actualItems, expectedItems, 'task 1 after wait items')

					complete(null, 10)
				})
			})

			tasks.addTask('task 2', function () {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['task 1', 'task 2'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20
			})

			tasks.run()

			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['task 1', 'task 2'],
				running: [],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'tasks totals')
		})

		// Parallel
		test('should work when running in parallel with new API', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = TaskGroup.create({
				name: 'my tasks',
				concurrency: 0,
				next: function (err, results) {
					equal(err, null)
					equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
					equal(tasks.concurrency, 0)

					const actualItems = tracker.details
					const expectedItems = {
						remaining: [],
						running: [],
						completed: ['task 2 for [my tasks]', 'task 1 for [my tasks]'],
						total: 2,
						results: [[null, 20], [null, 10]]
					}
					deepEqual(results, expectedItems.results)
					deepEqual(actualItems, expectedItems, 'completion items')

					done()
				},

				tasks: [
					function (complete) {
						const actualItems = tracker.details
						const expectedItems = {
							remaining: [],
							running: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
							completed: [],
							total: 2,
							results: []
						}
						deepEqual(actualItems, expectedItems, 'task 1 before wait items')

						wait(delay, function () {
							const actualItems = tracker.details
							const expectedItems = {
								remaining: [],
								running: ['task 1 for [my tasks]'],
								completed: ['task 2 for [my tasks]'],
								total: 2,
								results: [[null, 20]]
							}
							deepEqual(actualItems, expectedItems, 'task 1 after wait items')

							complete(null, 10)
						})
					},
					function () {
						const actualItems = tracker.details
						const expectedItems = {
							remaining: [],
							running: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
							completed: [],
							total: 2,
							results: []
						}
						deepEqual(actualItems, expectedItems, 'task 1 after wait items')

						return 20
					}
				]
			})
			tasks.run()

			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
				running: [],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'tasks totals')
		})
	})

	// Sync flag
	suite('sync flag', function (suite, test) {
		// Serial
		test('should work when running in serial', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = new TaskGroup({sync: true, name: 'my tests', concurrency: 1}).done(function (err, results) {
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.concurrency, 1)

				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: [],
					completed: ['task 1', 'task 2'],
					total: 2,
					results: [[null, 10], [null, 20]]
				}

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()
			})

			tasks.addTask('task 1', function (complete) {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: ['task 2'],
					running: ['task 1'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 items before wait items')

				wait(delay, function () {
					const actualItems = tracker.details
					deepEqual(actualItems, expectedItems, 'task 1 items after wait items')

					complete(null, 10)
				})
			})

			tasks.addTask('task 2', function () {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['task 2'],
					completed: ['task 1'],
					total: 2,
					results: [[null, 10]]
				}
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20
			})

			tasks.run()

			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['task 2'],
				running: ['task 1'],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'tasks totals')
		})
	})

	// Serial
	test('should work when running in serial with sync tasks', function (done) {
		const tracker = new TaskGroupTracker()
		const tasks = tracker.taskGroup = new TaskGroup({sync: true, name: 'my tests', concurrency: 1}).done(function (err, results) {
			equal(err, null)
			equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
			equal(tasks.concurrency, 1)

			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: [],
				completed: ['task 1', 'task 2'],
				total: 2,
				results: [[null, 10], [null, 20]]
			}

			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')
		})

		tasks.addTask('task 1', function (complete) {
			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['task 2'],
				running: ['task 1'],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'task 1 items')
			complete(null, 10)
		})

		tasks.addTask('task 2', function () {
			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: ['task 2'],
				completed: ['task 1'],
				total: 2,
				results: [[null, 10]]
			}
			deepEqual(actualItems, expectedItems, 'task 2 items')
			return 20
		})

		tasks.run()

		const actualItems = tracker.details
		const expectedItems = {
			remaining: [],
			running: [],
			completed: [],
			total: 0,
			results: [[null, 10], [null, 20]]
		}
		deepEqual(actualItems, expectedItems, 'tasks totals')

		setTimeout(done, 1000)
	})

	// Basic
	suite('errors', function (suite, test) {
		const err1 = new Error('deliberate error')
		const err2 = new Error('unexpected error')

		// Error Serial
		test('should handle error correctly in serial', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = new TaskGroup({name: 'my tasks', concurrency: 1}).done(function (err, results) {
				errorEqual(err, 'deliberate error')
				equal(tasks.concurrency, 1)
				equal(tasks.status, 'failed')
				equal(tasks.error, err)

				const actualItems = tracker.details
				const expectedItems = {
					remaining: ['task 2 for [my tasks]'],
					running: [],
					completed: ['task 1 for [my tasks]'],
					total: 2,
					results: [[err1]]
				}
				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()
			})

			tasks.addTask(function (complete) {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: ['task 2 for [my tasks]'],
					running: ['task 1 for [my tasks]'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 items')

				complete(err1)
			})

			tasks.addTask(function () {
				throw err2
			})

			tasks.run()
		})

		// Parallel
		test('should handle error correctly in parallel', function (done) {
			const tracker = new TaskGroupTracker()
			const tasks = tracker.taskGroup = new TaskGroup({name: 'my tasks', concurrency: 0}).done(function (err, results) {
				errorEqual(err, err2)
				equal(tasks.status, 'failed')
				equal(tasks.error, err)
				equal(tasks.concurrency, 0)

				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: [],
					completed: ['task 2 for [my tasks]', 'task 1 for [my tasks]'],
					total: 2,
					results: [[err2], [err1]]
				}
				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()
			})

			// Error via completion callback
			tasks.addTask(function (complete) {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				wait(delay, function () {
					const actualItems = tracker.details
					const expectedItems = {
						remaining: [],
						running: ['task 1 for [my tasks]'],
						completed: ['task 2 for [my tasks]'],
						total: 2,
						results: [[err2]]
					}
					deepEqual(actualItems, expectedItems, 'task 1 after wait items')

					complete(err1)
				})

				return null
			})

			// Error via return
			tasks.addTask(function () {
				const actualItems = tracker.details
				const expectedItems = {
					remaining: [],
					running: ['task 1 for [my tasks]', 'task 2 for [my tasks]'],
					completed: [],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				return err2
			})

			// Run tasks
			tasks.run()
		})
	})
})

// Test Runner
joe.suite('nested', function (suite, test) {
	// Inline
	test('inline format', function (done) {
		const checks = []

		const tracker = new TaskGroupTracker()
		const tasks = tracker.taskGroup = new TaskGroup('my tests', function (addGroup, addTask) {
			equal(this.name, 'my tests')

			addTask('my task', function (complete) {
				checks.push('my task 1')
				equal(this.name, 'my task')

				// totals for parent group
				const actualItems = tracker.details
				const expectedItems = {
					remaining: ['my group'],
					running: ['my task'],
					completed: ['taskgroup method for my tests'],
					total: 3,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'my task items before wait')

				wait(delay, function () {
					checks.push('my task 2')

					// totals for parent group
					const actualItems = tracker.details
					deepEqual(actualItems, expectedItems, 'my task items after wait')

					complete(null, 10)
				})
			})

			addGroup('my group', function (addGroup, addTask) {
				const myGroup = this
				checks.push('my group')
				equal(this.name, 'my group')

				// totals for parent group
				let actualItems = tracker.details
				let expectedItems = {
					remaining: [],
					running: ['my group'],
					completed: ['taskgroup method for my tests', 'my task'],
					total: 3,
					results: [[null, 10]]
				}
				deepEqual(actualItems, expectedItems, 'my group parent items')

				// totals for sub group
				actualItems = myGroup.itemNames
				expectedItems = {
					remaining: [],
					running: ['taskgroup method for my group'],
					completed: [],
					total: 1,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'my group items')

				addTask('my second task', function () {
					checks.push('my second task')
					equal(this.name, 'my second task')

					// totals for parent group
					let actualItems = tracker.details
					let expectedItems = {
						remaining: [],
						running: ['my group'],
						completed: ['taskgroup method for my tests', 'my task'],
						total: 3,
						results: [[null, 10]]
					}
					deepEqual(actualItems, expectedItems, 'my group parent items')

					// totals for sub group
					actualItems = myGroup.itemNames
					expectedItems = {
						remaining: [],
						running: ['my second task'],
						completed: ['taskgroup method for my group'],
						total: 2,
						results: []
					}
					deepEqual(actualItems, expectedItems, 'my group items')

					return 20
				})
			})
		})

		tasks.done(function (err, results) {
			equal(err, null, 'inline taskgroup executed without error')

			if ( checks.length !== 4 )  console.log(checks)
			equal(checks.length, 4, 'all the expected checks ran')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: [],
				completed: ['taskgroup method for my tests', 'my task', 'my group'],
				total: 3,
				results: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				]
			}
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

			done()
		})
	})

	// Traditional
	test('traditional format', function (done) {
		const checks = []

		const tracker = new TaskGroupTracker()
		const tasks = tracker.taskGroup = new TaskGroup({name: 'my tests'}).run()

		tasks.addTask('my task', function (complete) {
			checks.push('my task 1')
			equal(this.name, 'my task')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['my group'],
				running: ['my task'],
				completed: [],
				total: 2,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'my task items before wait')

			wait(delay, function () {
				checks.push('my task 2')

				// totals for parent group
				const actualItems = tracker.details
				deepEqual(actualItems, expectedItems, 'my task items after wait')

				complete(null, 10)
			})
		})

		tasks.addGroup('my group', function () {
			const myGroup = this
			checks.push('my group')
			equal(this.name, 'my group')

			// totals for parent group
			let actualItems = tracker.details
			let expectedItems = {
				remaining: [],
				running: ['my group'],
				completed: ['my task'],
				total: 2,
				results: [[null, 10]]
			}
			deepEqual(actualItems, expectedItems, 'my group parent items')

			// totals for sub group
			actualItems = myGroup.itemNames
			expectedItems = {
				remaining: [],
				running: ['taskgroup method for my group'],
				completed: [],
				total: 1,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'my group items')

			this.addTask('my second task', function () {
				checks.push('my second task')
				equal(this.name, 'my second task')

				// totals for parent group
				let actualItems = tracker.details
				expectedItems = {
					remaining: [],
					running: ['my group'],
					completed: ['my task'],
					total: 2,
					results: [[null, 10]]
				}
				deepEqual(actualItems, expectedItems, 'my group parent items')

				// totals for sub group
				actualItems = myGroup.itemNames
				expectedItems = {
					remaining: [],
					running: ['my second task'],
					completed: ['taskgroup method for my group'],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'my group items')

				return 20
			})
		})

		tasks.done(function (err, results) {
			equal(err, null, 'traditional format taskgroup executed without error')

			if ( checks.length !== 4 )  console.log(checks)
			equal(checks.length, 4, 'all the expected checks ran')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: [],
				completed: ['my task', 'my group'],
				total: 2,
				results: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				]
			}
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

			done()
		})
	})

	// Mixed
	test('mixed format', function (done) {
		const checks = []

		const tracker = new TaskGroupTracker()
		const tasks = tracker.taskGroup = new TaskGroup({name: 'my tests'})

		tasks.addTask('my task 1', function () {
			checks.push('my task 1')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: ['my group 1', 'my task 3'],
				running: ['my task 1'],
				completed: [],
				total: 3,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'my task 1 items')

			return 10
		})

		tasks.addGroup('my group 1', function () {
			const myGroup = this
			checks.push('my group 1')
			equal(this.name, 'my group 1')

			// totals for parent group
			let actualItems = tracker.details
			let expectedItems = {
				remaining: ['my task 3'],
				running: ['my group 1'],
				completed: ['my task 1'],
				total: 3,
				results: [[null, 10]]
			}
			deepEqual(actualItems, expectedItems, 'my group 1 parent items')

			// totals for sub group
			actualItems = myGroup.itemNames
			expectedItems = {
				remaining: [],
				running: ['taskgroup method for my group 1'],
				completed: [],
				total: 1,
				results: []
			}
			deepEqual(actualItems, expectedItems, 'my group 1 items')

			this.addTask('my task 2', function () {
				checks.push('my task 2')
				equal(this.name, 'my task 2')

				// totals for parent group
				let actualItems = tracker.details
				let expectedItems = {
					remaining: ['my task 3'],
					running: ['my group 1'],
					completed: ['my task 1'],
					total: 3,
					results: [[null, 10]]
				}
				deepEqual(actualItems, expectedItems, 'my group 1 after wait parent items')

				// totals for sub group
				actualItems = myGroup.itemNames
				expectedItems = {
					remaining: [],
					running: ['my task 2'],
					completed: ['taskgroup method for my group 1'],
					total: 2,
					results: []
				}
				deepEqual(actualItems, expectedItems, 'my group 1 items')

				return 20
			})
		})

		tasks.addTask('my task 3', function () {
			checks.push('my task 3')
			equal(this.name, 'my task 3')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: ['my task 3'],
				completed: ['my task 1', 'my group 1'],
				total: 3,
				results: [
					[null, 10],
					[null, [
						[null, 20]
					]]
				]
			}
			deepEqual(actualItems, expectedItems, 'my task 3 items')

			return 30
		})

		tasks.done(function (err, results) {
			equal(err, null, 'mixed format taskgroup executed without error')

			if ( checks.length !== 4 )  console.log(checks)
			equal(checks.length, 4, 'all the expected checks ran')

			// totals for parent group
			const actualItems = tracker.details
			const expectedItems = {
				remaining: [],
				running: [],
				completed: ['my task 1', 'my group 1', 'my task 3'],
				total: 3,
				results: [
					[null, 10],
					[null, [
						[null, 20]
					]],
					[null, 30]
				]
			}
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

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
			equal(err, null)
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

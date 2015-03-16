###
@TODO

- Add tests for nested configuration
###

# Import
util = require('util')
joe = require('joe')
{wait, equal, deepEqual, errorEqual} = require('assert-helpers')
{Task,TaskGroup} = require('../../')

# Prepare
delay = 100

# Task
joe.describe 'task', (describe,it) ->
	# Basic
	describe "basic", (suite,it) ->
		# Async
		# Test that the task executes correctly asynchronously
		it 'should work with async', (done) ->
			# Specify how many special checks we are expecting
			checks = []

			# Create our asynchronous task
			task = Task.create (complete) ->
				checks.push 'task 1 - before wait'
				# Wait a while as this is an async test
				wait delay, ->
					checks.push 'task 1 - after wait'
					equal(task.status, 'running', 'status to be running as we are within the task')
					equal(task.result, null, "result to be null as we haven't set it yet")
					# Return no error, and the result to the completion callback completing the task
					complete(null, 10)

			# Check the task completed as expected
			task.done (err,result) ->
				checks.push 'completion callback'
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
				deepEqual(task.result, [err,result], "the set result to be as expected as the task has completed")
				errorEqual(err, null, "the callback error to be null as we did not error")
				equal(result, 10, "the callback result to be as expected")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run thet ask
			task.run()

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay*2, ->
				deepEqual(checks, [
					'task 1 - before wait'
					'task 1 - after wait'
					'completion callback'
				])
				done()

		# Sync
		# Test that the task
		it 'should work with sync', (done) ->
			# Specify how many special checks we are expecting
			checks = 0

			# Create our synchronous task
			task = new Task ->
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, "result to be null as we haven't set it yet")
				# Return our result completing the task
				return 10

			# Check the task completed as expected
			task.done (err,result) ->
				++checks
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
				deepEqual(task.result, [err,result], "the set result to be as expected as the task has completed")
				errorEqual(err, null, "the callback error to be null as we did not error")
				equal(result, 10, "the callback result to be as expected")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run
			task.run()

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay, ->
				++checks
				equal(checks, 3, "all our special checks have run")
				done()

	# Sync Flag
	describe "sync flag", (suite,it) ->
		# Async
		# Test that the task executes correctly asynchronously
		it 'should work with async', (done) ->
			# Specify how many special checks we are expecting
			checks = []

			# Create our asynchronous task
			task = Task.create {sync:true}, (complete) ->
				checks.push 'task 1 - before wait'
				# Wait a while as this is an async test
				wait delay, ->
					checks.push 'task 1 - after wait'
					equal(task.status, 'running', 'status to be running as we are within the task')
					equal(task.result, null, "result to be null as we haven't set it yet")
					# Return no error, and the result to the completion callback completing the task
					complete(null, 10)

			# Check the task completed as expected
			task.done (err,result) ->
				checks.push 'completion callback'
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
				deepEqual(task.result, [err,result], "the set result to be as expected as the task has completed")
				equal(err, null, "the callback error to be null as we did not error")
				equal(result, 10, "the callback result to be as expected")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run thet ask
			task.run()

			# Check task hasn't run yet
			equal(task.status, 'running', "status to be running as we have started running due to sync flag")
			equal(task.result, null, 'result to be set as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay*2, ->
				deepEqual(
					checks
					[
						'task 1 - before wait'
						'task 1 - after wait'
						'completion callback'
					]
				)
				done()

		# Sync
		# Test that the task
		it 'should work with sync', (done) ->
			# Specify how many special checks we are expecting
			checks = 0

			# Create our synchronous task
			task = new Task {sync:true}, ->
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, "result to be null as we haven't set it yet")
				# Return our result completing the task
				return 10

			# Check the task completed as expected
			task.done (err,result) ->
				++checks
				equal(task.status, 'passed', 'status to be passed as we are within the completion callback')
				deepEqual(task.result, [err,result], "the set result to be as expected as the task has completed")
				equal(err, null, "the callback error to be null as we did not error")
				equal(result, 10, "the callback result to be as expected")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run
			task.run()

			# Check task hasn't run yet
			equal(task.status, 'passed', "status to be passed as we have already finished due to the sync flag")
			deepEqual(task.result, [null, 10], 'result to be set as we have already finished due to the sync flag')

			# Check that all our special checks have run
			wait delay, ->
				++checks
				equal(checks, 3, "all our special checks have run")
				done()

	# Error Handling
	describe "errors", (suite,it) ->
		it 'should detect return error on synchronous task', (done) ->
			# Specify how many special checks we are expecting
			checks = 0
			errMessage = 'deliberate return error'
			err = new Error(errMessage)

			# Create our synchronous task
			task = new Task ->
				++checks
				equal(task.status, 'running', 'status to be running as we are within the task')
				equal(task.result, null, "result to be null as we haven't set it yet")
				return err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				deepEqual(task.result, [err], "the set result to be as expected as the task has completed")
				equal(_err, err, "the callback error to be set as we errord")
				equal(result, null, "the callback result to be null we errord")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run
			task.run()

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay, ->
				++checks
				equal(checks, 3, "all our special checks have run")
				done()

		it 'should detect sync throw error on synchronous task', (done) ->
			# Specify how many special checks we are expecting
			checks = 0
			neverReached = false
			errMessage = 'deliberate sync throw error'
			err = new Error(errMessage)

			# Create our synchronous task
			task = new Task ->
				++checks
				equal(task.result, null, "result to be null as we haven't set it yet")
				equal(task.status, 'running', 'status to be running as we are within the task')
				throw err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				equal(_err, err, "the callback error to be set as we errord")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run
			task.run()

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay, ->
				++checks
				equal(checks, 3, "all our special checks have run")
				done()

		it 'should detect async throw error on asynchronous task', (done) ->
			# Check node version
			if process.versions.node.substr(0,3) is '0.8'
				console.log 'skip this test on node 0.8 because domains behave differently'
				return done()

			# Specify how many special checks we are expecting
			checks = 0
			neverReached = false
			errMessage = 'deliberate async throw error'
			err = new Error(errMessage)

			# Create our asynchronous task
			task = new Task (done) ->
				wait delay, ->
					++checks
					equal(task.status, 'running', 'status to be running as we are within the task')
					equal(task.result, null, "result to be null as we haven't set it yet")
					throw err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				equal(task.status, 'failed', 'status to be failed as we are within the completion callback')
				equal(_err, err, "the callback error to be set as we errord")

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, "result to be null as we haven't started running yet")

			# Run
			task.run()

			# Check task hasn't run yet
			equal(task.status, null, "status to be null as we haven't started running yet")
			equal(task.result, null, 'result to be null as tasks execute asynchronously')

			# Check that all our special checks have run
			wait delay*2, ->
				++checks
				equal(checks, 3, "all our special checks have run")
				equal(neverReached, false, "never reached to be false")
				done()

		it 'should error when a timeout has exceeded', (done) ->
			# Specify how many special checks we are expecting
			checks = []

			# Create our asynchronous task
			task = Task.create timeout:delay, (complete) ->
				wait delay*2, ->
					complete()

			# Check the task completed as expected
			task.whenDone (err,result) ->
				if checks.length is 0
					checks.push('timeout')
					errorEqual(err, 'timed out')
				else if checks.length is 1
					checks.push('completed twice')
					errorEqual(err, 'already completed')
					done()

			# Run
			task.run()

		it 'should not error when a timeout has not exceeded', (done) ->
			# Specify how many special checks we are expecting
			checks = []

			# Create our asynchronous task
			task = Task.create timeout:delay*2, (complete) ->
				wait delay, ->
					complete()

			# Check the task completed as expected
			task.whenDone(done)

			# Run
			task.run()

		# https://github.com/bevry/taskgroup/issues/17
		it 'it should not catch errors within the completion callback: issue 17', (done) ->
			# Run our test file
			require('safeps').exec 'node issue17.js', {cwd:__dirname}, (err, stdout, stderr) ->
				# Check if we got the error we expected
				if stderr.indexOf("Error: goodbye world\n    at Task.") isnt -1
					done()
				else
					err = new Error('Issue 17 check did not execute correctly')
					console.log('stdout:\n', stdout, '\nstderr:\n', stderr, '\n')
					done(err)

	# Basic
	describe "arguments", (suite,it) ->
		# Sync
		it 'should work with arguments in sync', (done) ->
			# Prepare
			checks = []

			# Create
			task = new Task (a,b) ->
				checks.push('my task')
				equal(task.result, null)
				return a*b

			# Apply the arguments
			task.setConfig(args:[2,5])

			# Check
			task.done (err,result) ->
				checks.push('completion callback')
				deepEqual(task.result, [err,result])
				equal(err, null)
				equal(result, 10)

			# Check
			wait delay, ->
				deepEqual(checks, ['my task', 'completion callback'])
				done()

			# Run
			task.run()

		# Async
		it 'should work with arguments in async', (done) ->
			# Prepare
			checks = []

			# Create
			task = new Task (a,b,complete) ->
				checks.push('my task - before wait')
				wait delay, ->
					checks.push('my task - after wait')
					equal(task.result, null)
					complete(null, a*b)

			# Apply the arguments
			task.setConfig(args:[2,5])

			# Check
			task.done (err,result) ->
				checks.push('completion callback')
				deepEqual(task.result, [err,result])
				equal(err, null)
				equal(result, 10)

			# Check
			wait delay*2, ->
				deepEqual(checks, ['my task - before wait', 'my task - after wait', 'completion callback'])
				done()

			# Run
			task.run()

# Task Group
joe.describe 'taskgroup', (describe,it) ->
	# Basic
	describe "basic", (suite,it) ->
		# Serial
		it 'should work when running in serial', (done) ->
			tasks = new TaskGroup().setConfig({name:'my tests',concurrency:1}).done (err,results) ->
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.config.concurrency, 1)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 1', 'task 2']
					total: 2
					results: [[null,10], [null,20]]

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()

			tasks.addTask 'task 1', (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2']
					running: ['task 1']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 items before wait items')

				wait delay, ->
					actualItems = tasks.getItemNames()
					deepEqual(actualItems, expectedItems, 'task 1 items after wait items')

					complete(null, 10)


			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 2']
					completed: ['task 1']
					total: 2
					results:  [[null,10]]
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20

			tasks.run()

			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['task 1', 'task 2']
				running: []
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'tasks totals')

		# Parallel with new API
		it 'should work when running in parallel', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:0}).done (err,results) ->
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.config.concurrency, 0)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 2', 'task 1']
					total: 2
					results: [[null,20], [null,10]]

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()

			tasks.addTask 'task 1', (complete) ->

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1', 'task 2']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				wait delay, ->

					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['task 1']
						completed: ['task 2']
						total: 2
						results: [[null,20]]
					deepEqual(actualItems, expectedItems, 'task 1 after wait items')

					complete(null,10)

			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1', 'task 2']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20

			tasks.run()

			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['task 1', 'task 2']
				running: []
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'tasks totals')

		# Parallel
		it 'should work when running in parallel with new API', (done) ->
			tasks = TaskGroup.create(
				name: 'my tasks'
				concurrency: 0
				next: (err,results) ->
					equal(err, null)
					equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
					equal(tasks.config.concurrency, 0)

					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: []
						completed: ['task 2 for my tasks', 'task 1 for my tasks']
						total: 2
						results: [[null,20], [null,10]]
					deepEqual(results, expectedItems.results)
					deepEqual(actualItems, expectedItems, 'completion items')

					done()

				tasks: [
					(complete) ->
						actualItems = tasks.getItemNames()
						expectedItems =
							remaining: []
							running: ['task 1 for my tasks', 'task 2 for my tasks']
							completed: []
							total: 2
							results: []
						deepEqual(actualItems, expectedItems, 'task 1 before wait items')

						wait delay, ->
							actualItems = tasks.getItemNames()
							expectedItems =
								remaining: []
								running: ['task 1 for my tasks']
								completed: ['task 2 for my tasks']
								total: 2
								results: [[null,20]]
							deepEqual(actualItems, expectedItems, 'task 1 after wait items')

							complete(null, 10)

					->
						actualItems = tasks.getItemNames()
						expectedItems =
							remaining: []
							running: ['task 1 for my tasks', 'task 2 for my tasks']
							completed: []
							total: 2
							results: []
						deepEqual(actualItems, expectedItems, 'task 1 after wait items')

						return 20
				]
			).run()

			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['task 1 for my tasks', 'task 2 for my tasks']
				running: []
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'tasks totals')

	# Sync flag
	describe "sync flag", (suite,it) ->
		# Serial
		it 'should work when running in serial', (done) ->
			tasks = new TaskGroup().setConfig({sync:true,name:'my tests',concurrency:1}).done (err,results) ->
				equal(err, null)
				equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
				equal(tasks.config.concurrency, 1)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 1', 'task 2']
					total: 2
					results: [[null,10], [null,20]]

				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()

			tasks.addTask 'task 1', (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2']
					running: ['task 1']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 items before wait items')

				wait delay, ->
					actualItems = tasks.getItemNames()
					deepEqual(actualItems, expectedItems, 'task 1 items after wait items')

					complete(null, 10)

			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 2']
					completed: ['task 1']
					total: 2
					results:  [[null,10]]
				deepEqual(actualItems, expectedItems, 'task 2 items')

				return 20

			tasks.run()

			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['task 2']
				running: ['task 1']
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'tasks totals')

	# Serial
	it 'should work when running in serial with sync tasks', (done) ->
		tasks = new TaskGroup().setConfig({sync:true,name:'my tests',concurrency:1}).done (err,results) ->
			equal(err, null)
			equal(tasks.status, 'passed', 'status to be passed as we are within the completion callback')
			equal(tasks.config.concurrency, 1)

			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: []
				completed: ['task 1', 'task 2']
				total: 2
				results: [[null,10], [null,20]]

			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

		tasks.addTask 'task 1', (complete) ->
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['task 2']
				running: ['task 1']
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'task 1 items')
			complete(null, 10)

		tasks.addTask 'task 2', ->
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: ['task 2']
				completed: ['task 1']
				total: 2
				results:  [[null,10]]
			deepEqual(actualItems, expectedItems, 'task 2 items')
			return 20

		tasks.run()

		actualItems = tasks.getItemNames()
		expectedItems =
			remaining: []
			running: []
			completed: []
			total: 0
			results: [[null,10], [null,20]]
		deepEqual(actualItems, expectedItems, 'tasks totals')

		setTimeout(done, 1000)

	# Basic
	describe "errors", (suite,it) ->
		# Error Serial
		it 'should handle error correctly in serial', (done) ->
			err1 = new Error('deliberate error')
			err2 = new Error('unexpected error')
			tasks = new TaskGroup().setConfig({name:'my tasks', concurrency:1}).done (err,results) ->
				errorEqual(err, 'deliberate error')
				equal(tasks.config.concurrency, 1)
				equal(tasks.status, 'failed')
				equal(tasks.err, err)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2 for my tasks']
					running: []
					completed: ['task 1 for my tasks']
					total: 2
					results: [[err1]]
				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()

			tasks.addTask (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2 for my tasks']
					running: ['task 1 for my tasks']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 items')

				complete(err1)

			tasks.addTask ->
				throw err2

			tasks.run()

		# Parallel
		it 'should handle error correctly in parallel', (done) ->
			err1 = new Error('task 1 deliberate error')
			err2 = new Error('task 2 deliberate error')
			tasks = new TaskGroup().setConfig({name:'my tasks', concurrency:0}).done (err,results) ->
				errorEqual(err, 'task 2 deliberate error')
				equal(tasks.status, 'failed')
				equal(tasks.err, err)
				equal(tasks.config.concurrency, 0)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 2 for my tasks', 'task 1 for my tasks']
					total: 2
					results: [[err2], [err1]]
				deepEqual(results, expectedItems.results)
				deepEqual(actualItems, expectedItems, 'completion items')

				done()

			# Error via completion callback
			tasks.addTask (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1 for my tasks', 'task 2 for my tasks']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				wait delay, ->
					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['task 1 for my tasks']
						completed: ['task 2 for my tasks']
						total: 2
						results: [[err2]]
					deepEqual(actualItems, expectedItems, 'task 1 after wait items')

					complete(err1)
				return null

			# Error via return
			tasks.addTask ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1 for my tasks', 'task 2 for my tasks']
					completed: []
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'task 1 before wait items')

				return err2

			# Run tasks
			tasks.run()



# Test Runner
joe.describe 'nested', (describe,it) ->
	# Inline
	it 'inline format', (done) ->
		checks = []

		tasks = new TaskGroup 'my tests', (addGroup,addTask) ->
			equal(@config.name, 'my tests')

			addTask 'my task', (complete) ->
				checks.push('my task 1')
				equal(@config.name, 'my task')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['my group']
					running: ['my task']
					completed: ['taskgroup method for my tests']
					total: 3
					results: []
				deepEqual(actualItems, expectedItems, 'my task items before wait')

				wait delay, ->
					checks.push('my task 2')

					# totals for parent group
					actualItems = tasks.getItemNames()
					deepEqual(actualItems, expectedItems, 'my task items after wait')

					complete(null, 10)

			addGroup 'my group', (addGroup,addTask) ->
				myGroup = @
				checks.push('my group')
				equal(@config.name, 'my group')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['my group']
					completed: ['taskgroup method for my tests', 'my task']
					total: 3
					results: [[null,10]]
				deepEqual(actualItems, expectedItems, 'my group parent items')

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['taskgroup method for my group']
					completed: []
					total: 1
					results: []
				deepEqual(actualItems, expectedItems, 'my group items')

				addTask 'my second task', ->
					checks.push('my second task')
					equal(@config.name, 'my second task')

					# totals for parent group
					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['my group']
						completed: ['taskgroup method for my tests', 'my task']
						total: 3
						results: [[null,10]]
					deepEqual(actualItems, expectedItems, 'my group parent items')

					# totals for sub group
					actualItems = myGroup.getItemNames()
					expectedItems =
						remaining: []
						running: ['my second task']
						completed: ['taskgroup method for my group']
						total: 2
						results: []
					deepEqual(actualItems, expectedItems, 'my group items')

					return 20

		tasks.done (err, results) ->
			equal(err, null, 'inline taskgroup executed without error')

			console.log(checks)  if checks.length isnt 4
			equal(checks.length, 4, 'all the expected checks ran')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: []
				completed: ['taskgroup method for my tests', 'my task', 'my group']
				total: 3
				results: [
					[null,10],
					[null, [
						[null,20]
					]]
				]
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

			done()

	# Traditional
	it 'traditional format', (done) ->
		checks = []

		tasks = new TaskGroup(name: 'my tests').run()

		tasks.addTask 'my task', (complete) ->
			checks.push('my task 1')
			equal(@config.name, 'my task')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['my group']
				running: ['my task']
				completed: []
				total: 2
				results: []
			deepEqual(actualItems, expectedItems, 'my task items before wait')

			wait delay, ->
				checks.push('my task 2')

				# totals for parent group
				actualItems = tasks.getItemNames()
				deepEqual(actualItems, expectedItems, 'my task items after wait')

				complete(null, 10)

		tasks.addGroup 'my group', ->
			myGroup = @
			checks.push('my group')
			equal(@config.name, 'my group')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: ['my group']
				completed: ['my task']
				total: 2
				results: [[null,10]]
			deepEqual(actualItems, expectedItems, 'my group parent items')

			# totals for sub group
			actualItems = myGroup.getItemNames()
			expectedItems =
				remaining: []
				running: ['taskgroup method for my group']
				completed: []
				total: 1
				results: []
			deepEqual(actualItems, expectedItems, 'my group items')

			@addTask 'my second task', ->
				checks.push('my second task')
				equal(@config.name, 'my second task')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['my group']
					completed: ['my task']
					total: 2
					results: [[null,10]]
				deepEqual(actualItems, expectedItems, 'my group parent items')

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['my second task']
					completed: ['taskgroup method for my group']
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'my group items')

				return 20


		tasks.done (err, results) ->
			equal(err, null, 'traditional format taskgroup executed without error')

			console.log(checks)  if checks.length isnt 4
			equal(checks.length, 4, 'all the expected checks ran')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: []
				completed: ['my task', 'my group']
				total: 2
				results: [
					[null,10],
					[null, [
						[null,20]
					]]
				]
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')

			done()

	# Mixed
	it 'mixed format', (done) ->
		checks = []

		tasks = new TaskGroup(name: 'my tests')

		tasks.addTask 'my task 1', ->
			checks.push('my task 1')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['my group 1', 'my task 3']
				running: ['my task 1']
				completed: []
				total: 3
				results: []
			deepEqual(actualItems, expectedItems, 'my task 1 items')

			return 10

		tasks.addGroup 'my group 1', ->
			myGroup = @
			checks.push('my group 1')
			equal(@config.name, 'my group 1')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['my task 3']
				running: ['my group 1']
				completed: ['my task 1']
				total: 3
				results: [[null,10]]
			deepEqual(actualItems, expectedItems, 'my group 1 parent items')

			# totals for sub group
			actualItems = myGroup.getItemNames()
			expectedItems =
				remaining: []
				running: ['taskgroup method for my group 1']
				completed: []
				total: 1
				results: []
			deepEqual(actualItems, expectedItems, 'my group 1 items')


			@addTask 'my task 2', ->
				checks.push('my task 2')
				equal(@config.name, 'my task 2')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['my task 3']
					running: ['my group 1']
					completed: ['my task 1']
					total: 3
					results: [[null,10]]
				deepEqual(actualItems, expectedItems, 'my group 1 after wait parent items')

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['my task 2']
					completed: ['taskgroup method for my group 1']
					total: 2
					results: []
				deepEqual(actualItems, expectedItems, 'my group 1 items')

				return 20

		tasks.addTask 'my task 3', ->
			checks.push('my task 3')
			equal(@config.name, 'my task 3')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: ['my task 3']
				completed: ['my task 1', 'my group 1']
				total: 3
				results: [
					[null,10],
					[null, [
						[null,20]
					]]
				]
			deepEqual(actualItems, expectedItems, 'my task 3 items')

			return 30

		tasks.done (err, results) ->
			equal(err, null, 'mixed format taskgroup executed without error')

			console.log(checks)  if checks.length isnt 4
			equal(checks.length, 4, 'all the expected checks ran')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: []
				completed: ['my task 1', 'my group 1', 'my task 3']
				total: 3
				results: [
					[null,10],
					[null, [
						[null,20]
					]]
					[null,30],
				]
			deepEqual(results, expectedItems.results)
			deepEqual(actualItems, expectedItems, 'completion items')


			done()

		tasks.run()

	###
	# Idle
	it 'idling', (done) ->
		checks = []

		tasks = new TaskGroup()

		task = tasks.addTask 'my task 1', (complete) ->
			checks.push('my task 1')
			equal(@config.name, 'my task 1')
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
	###

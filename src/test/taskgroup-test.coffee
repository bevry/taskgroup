# Import
util = require('util')
{expect} = require('chai')
joe = require('joe')
{Task,TaskGroup} = require('../../')

# Prepare
wait = (delay,fn) -> setTimeout(fn,delay)
delay = 100
inspect = (args...) ->
	for arg in args
		console.log util.inspect(arg, {colors:true})

# Task
joe.describe 'task', (describe,it) ->
	# Basic
	describe "basic", (suite,it) ->
		# Async
		# Test that the task executes correctly asynchronously
		it 'should work with async', (done) ->
			# Specify how many special checks we are expecting
			checks = 0

			# Create our asynchronous task
			task = Task.create (complete) ->
				# Wait a while as this is an async test
				wait delay, ->
					++checks
					expect(task.status, 'status to be running as we are within the task').to.equal('running')
					expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
					# Return no error, and the result to the completion callback completing the task
					complete(null,10)

			# Check the task completed as expected
			task.done (err,result) ->
				++checks
				expect(task.status, 'status to be completed as we are within the completion callback').to.equal('completed')
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err,result])
				expect(err, "the callback error to be null as we did not error").to.equal(null)
				expect(result, "the callback result to be as expected").to.equal(10)

			# Check task hasn't run yet
			expect(task.status, "status to be null as we haven't started running yet").to.equal(null)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run thet ask
			task.run()

			# Check that task has started running
			expect(task.status, 'running to be started as tasks execute asynchronously').to.equal('started')
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay*2, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
				done()

		# Sync
		# Test that the task
		it 'should work with sync', (done) ->
			# Specify how many special checks we are expecting
			checks = 0

			# Create our synchronous task
			task = new Task ->
				++checks
				expect(task.status, 'status to be running as we are within the task').to.equal('running')
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				# Return our result completing the task
				return 10

			# Check the task completed as expected
			task.done (err,result) ->
				++checks
				expect(task.status, 'status to be completed as we are within the completion callback').to.equal('completed')
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err,result])
				expect(err, "the callback error to be null as we did not error").to.equal(null)
				expect(result, "the callback result to be as expected").to.equal(10)

			# Check task hasn't run yet
			expect(task.status, "status to be null as we haven't started running yet").to.equal(null)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.status, 'status to be started as tasks execute asynchronously').to.equal('started')
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
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
				expect(task.status, 'status to be running as we are within the task').to.equal('running')
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				return err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				expect(task.status, 'status to be failed as we are within the completion callback').to.equal('failed')
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err])
				expect(_err, "the callback error to be set as we errord").to.equal(err)
				expect(result, "the callback result to be null we errord").to.not.exist

			# Check task hasn't run yet
			expect(task.status, "status to be null as we haven't started running yet").to.equal(null)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.status, 'status to be started as tasks execute asynchronously').to.equal('started')
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
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
				expect(task.status, 'status to be running as we are within the task').to.equal('running')
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				throw err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				expect(task.status, 'status to be failed as we are within the completion callback').to.equal('failed')
				expect(_err, "the callback error to be set as we errord").to.equal(err)

			# Check task hasn't run yet
			expect(task.status, "status to be null as we haven't started running yet").to.equal(null)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.status, 'status to be started as tasks execute asynchronously').to.equal('started')
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
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
					expect(task.status, 'status to be running as we are within the task').to.equal('running')
					expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
					throw err

			# Check the task completed as expected
			task.done (_err,result) ->
				++checks
				expect(task.status, 'status to be failed as we are within the completion callback').to.equal('failed')
				expect(_err, "the callback error to be set as we errord").to.equal(err)

			# Check task hasn't run yet
			expect(task.status, "status to be null as we haven't started running yet").to.equal(null)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.status, 'status to be started as tasks execute asynchronously').to.equal('started')
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay*2, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
				expect(neverReached, "never reached to be false").to.equal(false)
				done()

	# Basic
	describe "arguments", (suite,it) ->
		# Sync
		it 'should work with arguments in sync', (done) ->
			# Prepare
			checks = 0

			# Create
			task = new Task (a,b) ->
				++checks
				expect(task.result).to.equal(null)
				return a*b

			# Apply the arguments
			task.setConfig(args:[2,5])

			# Check
			task.done (err,result) ->
				++checks
				expect(task.result).to.deep.equal([err,result])
				expect(err?.message or null).to.equal(null)
				expect(result).to.equal(10)

			# Check
			wait 1000, ->
				++checks
				expect(checks).to.equal(3)
				done()

			# Run
			task.run()

		# Async
		it 'should work with arguments in async', (done) ->
			# Prepare
			checks = 0

			# Create
			task = new Task (a,b,complete) ->
				wait 500, ->
					++checks
					expect(task.result).to.equal(null)
					complete(null,a*b)

			# Apply the arguments
			task.setConfig(args:[2,5])

			# Check
			task.done (err,result) ->
				++checks
				expect(task.result).to.deep.equal([err,result])
				expect(err?.message or null).to.equal(null)
				expect(result).to.equal(10)

			# Check
			wait 1000, ->
				++checks
				expect(checks).to.equal(3)
				done()

			# Run
			task.run()


# Task Group
joe.describe 'taskgroup', (describe,it) ->
	# Basic
	describe "basic", (suite,it) ->
		# Serial
		it 'should work when running in serial', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:1}).done (err,results) ->
				expect(err?.message or null).to.equal(null)
				expect(tasks.config.concurrency).to.equal(1)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 1', 'task 2']
					total: 2
					results: [[null,10], [null,20]]

				expect(results).to.deep.equal(expectedItems.results)
				expect(actualItems, 'completion items').to.deep.equal(expectedItems)

				done()

			tasks.addTask 'task 1', (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2']
					running: ['task 1']
					completed: []
					total: 2
					results: []
				expect(actualItems, 'task 1 items before wait items').to.deep.equal(expectedItems)

				wait 500, ->
					actualItems = tasks.getItemNames()
					expect(actualItems, 'task 1 items after wait items').to.deep.equal(expectedItems)

					complete(null, 10)

			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 2']
					completed: ['task 1']
					total: 2
					results:  [[null,10]]
				expect(actualItems, 'task 2 items').to.deep.equal(expectedItems)

				return 20

			tasks.run()

		# Parallel with new API
		it 'should work when running in parallel', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:0}).done (err,results) ->
				expect(err?.message or null).to.equal(null)
				expect(tasks.config.concurrency).to.equal(0)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 2', 'task 1']
					total: 2
					results: [[null,20], [null,10]]

				expect(results).to.deep.equal(expectedItems.results)
				expect(actualItems, 'completion items').to.deep.equal(expectedItems)

				done()

			tasks.addTask 'task 1', (complete) ->

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1', 'task 2']
					completed: []
					total: 2
					results: []
				expect(actualItems, 'task 1 before wait items').to.deep.equal(expectedItems)

				wait 500, ->

					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['task 1']
						completed: ['task 2']
						total: 2
						results: [[null,20]]
					expect(actualItems, 'task 1 after wait items').to.deep.equal(expectedItems)

					complete(null,10)

			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 1', 'task 2']
					completed: []
					total: 2
					results: []
				expect(actualItems, 'task 2 items').to.deep.equal(expectedItems)

				return 20

			tasks.run()

		# Parallel
		it 'should work when running in parallel with new API', (done) ->
			tasks = TaskGroup.create(
				name: 'my tasks'
				concurrency: 0
				next: (err,results) ->
					expect(err?.message or null).to.equal(null)
					expect(tasks.config.concurrency).to.equal(0)

					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: []
						completed: ['task 2 for my tasks', 'task 1 for my tasks']
						total: 2
						results: [[null,20], [null,10]]
					expect(results).to.deep.equal(expectedItems.results)
					expect(actualItems, 'completion items').to.deep.equal(expectedItems)

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
						expect(actualItems, 'task 1 before wait items').to.deep.equal(expectedItems)

						wait 500, ->
							actualItems = tasks.getItemNames()
							expectedItems =
								remaining: []
								running: ['task 1 for my tasks']
								completed: ['task 2 for my tasks']
								total: 2
								results: [[null,20]]
							expect(actualItems, 'task 1 after wait items').to.deep.equal(expectedItems)

							complete(null, 10)
					->
						actualItems = tasks.getItemNames()
						expectedItems =
							remaining: []
							running: ['task 1 for my tasks', 'task 2 for my tasks']
							completed: []
							total: 2
							results: []
						expect(actualItems, 'task 1 after wait items').to.deep.equal(expectedItems)

						return 20
				]
			).run()

		###
		# Serial, Twice
		it 'should clear results when running again', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:1}).done (err,results) ->
				expect(err?.message or null).to.equal(null)
				expect(results).to.deep.equal([[null,10], [null,20]])
				expect(tasks.config.concurrency).to.equal(1)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 1', 'task 2']
					total: 2
					results: 2
				expect(actualItems, 'completion items').to.deep.equal(expectedItems)

				done()

			tasks.addTask 'task 1', (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2']
					running: ['task 1']
					completed: []
					total: 2
					results: 0
				expect(actualItems, 'task 1 items before wait items').to.deep.equal(expectedItems)

				wait 500, ->
					actualItems = tasks.getItemNames()
					expect(actualItems, 'task 1 items after wait items').to.deep.equal(expectedItems)

					complete(null, 10)

			tasks.addTask 'task 2', ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['task 2']
					completed: ['task 1']
					total: 2
					results: 1
				expect(actualItems, 'task 2 items').to.deep.equal(expectedItems)

				return 20

			tasks.run()
		###

	# Basic
	describe "errors", (suite,it) ->
		# Parallel
		it 'should handle error correctly in parallel', (done) ->
			err1 = new Error('task 1 deliberate error')
			err2 = new Error('task 2 deliberate error')
			tasks = new TaskGroup().setConfig({name:'my tasks', concurrency:0}).done (err,results) ->
				expect(err.message).to.equal('task 2 deliberate error')
				expect(tasks.status).to.equal('failed')
				expect(tasks.err).to.equal(err)
				expect(tasks.config.concurrency).to.equal(0)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: []
					completed: ['task 2 for my tasks', 'task 1 for my tasks']
					total: 2
					results: [[err2], [err1]]
				expect(results).to.deep.equal(expectedItems.results)
				expect(actualItems, 'completion items').to.deep.equal(expectedItems)

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
				expect(actualItems, 'task 1 before wait items').to.deep.equal(expectedItems)

				wait 500, ->
					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['task 1 for my tasks']
						completed: ['task 2 for my tasks']
						total: 2
						results: [[err2]]
					expect(actualItems, 'task 1 after wait items').to.deep.equal(expectedItems)

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
				expect(actualItems, 'task 1 before wait items').to.deep.equal(expectedItems)

				return err2

			# Run tasks
			tasks.run()

		# Error Serial
		it 'should handle error correctly in serial', (done) ->
			err1 = new Error('deliberate error')
			err2 = new Error('unexpected error')
			tasks = new TaskGroup().setConfig({name:'my tasks', concurrency:1}).done (err,results) ->
				expect(err.message).to.equal('deliberate error')
				expect(tasks.config.concurrency).to.equal(1)
				expect(tasks.status).to.equal('failed')
				expect(tasks.err).to.equal(err)

				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2 for my tasks']
					running: []
					completed: ['task 1 for my tasks']
					total: 2
					results: [[err1]]
				expect(results).to.deep.equal(expectedItems.results)
				expect(actualItems, 'completion items').to.deep.equal(expectedItems)

				done()

			tasks.addTask (complete) ->
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['task 2 for my tasks']
					running: ['task 1 for my tasks']
					completed: []
					total: 2
					results: []
				expect(actualItems, 'task 1 items').to.deep.equal(expectedItems)

				complete(err1)

			tasks.addTask ->
				throw err2

			tasks.run()



# Test Runner
joe.describe 'nested', (describe,it) ->
	# Inline
	it 'inline format', (done) ->
		checks = []

		tasks = new TaskGroup 'my tests', (addGroup,addTask) ->
			expect(@config.name).to.equal('my tests')

			addTask 'my task', (complete) ->
				checks.push('my task 1')
				expect(@config.name).to.equal('my task')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['my group']
					running: ['my task']
					completed: ['taskgroup method for my tests']
					total: 3
					results: []
				expect(actualItems, 'my task items before wait').to.deep.equal(expectedItems)

				wait 500, ->
					checks.push('my task 2')

					# totals for parent group
					actualItems = tasks.getItemNames()
					expect(actualItems, 'my task items after wait').to.deep.equal(expectedItems)

					complete(null, 10)

			addGroup 'my group', (addGroup,addTask) ->
				myGroup = @
				checks.push('my group')
				expect(@config.name).to.equal('my group')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['my group']
					completed: ['taskgroup method for my tests', 'my task']
					total: 3
					results: [[null,10]]
				expect(actualItems, 'my group parent items').to.deep.equal(expectedItems)

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['taskgroup method for my group']
					completed: []
					total: 1
					results: []
				expect(actualItems, 'my group items').to.deep.equal(expectedItems)

				addTask 'my second task', ->
					checks.push('my second task')
					expect(@config.name).to.equal('my second task')

					# totals for parent group
					actualItems = tasks.getItemNames()
					expectedItems =
						remaining: []
						running: ['my group']
						completed: ['taskgroup method for my tests', 'my task']
						total: 3
						results: [[null,10]]
					expect(actualItems, 'my group parent items').to.deep.equal(expectedItems)

					# totals for sub group
					actualItems = myGroup.getItemNames()
					expectedItems =
						remaining: []
						running: ['my second task']
						completed: ['taskgroup method for my group']
						total: 2
						results: []
					expect(actualItems, 'my group items').to.deep.equal(expectedItems)

					return 20

		tasks.done (err, results) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

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
			expect(results).to.deep.equal(expectedItems.results)
			expect(actualItems, 'completion items').to.deep.equal(expectedItems)

			done()

	# Traditional
	it 'traditional format', (done) ->
		checks = []

		tasks = new TaskGroup(name: 'my tests').run()

		tasks.addTask 'my task', (complete) ->
			checks.push('my task 1')
			expect(@config.name).to.equal('my task')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['my group']
				running: ['my task']
				completed: []
				total: 2
				results: []
			expect(actualItems, 'my task items before wait').to.deep.equal(expectedItems)

			wait 500, ->
				checks.push('my task 2')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expect(actualItems, 'my task items after wait').to.deep.equal(expectedItems)

				complete(null, 10)

		tasks.addGroup 'my group', ->
			myGroup = @
			checks.push('my group')
			expect(@config.name).to.equal('my group')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: []
				running: ['my group']
				completed: ['my task']
				total: 2
				results: [[null,10]]
			expect(actualItems, 'my group parent items').to.deep.equal(expectedItems)

			# totals for sub group
			actualItems = myGroup.getItemNames()
			expectedItems =
				remaining: []
				running: ['taskgroup method for my group']
				completed: []
				total: 1
				results: []
			expect(actualItems, 'my group items').to.deep.equal(expectedItems)

			@addTask 'my second task', ->
				checks.push('my second task')
				expect(@config.name).to.equal('my second task')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: []
					running: ['my group']
					completed: ['my task']
					total: 2
					results: [[null,10]]
				expect(actualItems, 'my group parent items').to.deep.equal(expectedItems)

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['my second task']
					completed: ['taskgroup method for my group']
					total: 2
					results: []
				expect(actualItems, 'my group items').to.deep.equal(expectedItems)

				return 20


		tasks.done (err, results) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

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
			expect(results).to.deep.equal(expectedItems.results)
			expect(actualItems, 'completion items').to.deep.equal(expectedItems)

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
			expect(actualItems, 'my task 1 items').to.deep.equal(expectedItems)

			return 10

		tasks.addGroup 'my group 1', ->
			myGroup = @
			checks.push('my group 1')
			expect(@config.name).to.equal('my group 1')

			# totals for parent group
			actualItems = tasks.getItemNames()
			expectedItems =
				remaining: ['my task 3']
				running: ['my group 1']
				completed: ['my task 1']
				total: 3
				results: [[null,10]]
			expect(actualItems, 'my group 1 parent items').to.deep.equal(expectedItems)

			# totals for sub group
			actualItems = myGroup.getItemNames()
			expectedItems =
				remaining: []
				running: ['taskgroup method for my group 1']
				completed: []
				total: 1
				results: []
			expect(actualItems, 'my group 1 items').to.deep.equal(expectedItems)


			@addTask 'my task 2', ->
				checks.push('my task 2')
				expect(@config.name).to.equal('my task 2')

				# totals for parent group
				actualItems = tasks.getItemNames()
				expectedItems =
					remaining: ['my task 3']
					running: ['my group 1']
					completed: ['my task 1']
					total: 3
					results: [[null,10]]
				expect(actualItems, 'my group 1 after wait parent items').to.deep.equal(expectedItems)

				# totals for sub group
				actualItems = myGroup.getItemNames()
				expectedItems =
					remaining: []
					running: ['my task 2']
					completed: ['taskgroup method for my group 1']
					total: 2
					results: []
				expect(actualItems, 'my group 1 items').to.deep.equal(expectedItems)

				return 20

		tasks.addTask 'my task 3', ->
			checks.push('my task 3')
			expect(@config.name).to.equal('my task 3')

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
			expect(actualItems, 'my task 3 items').to.deep.equal(expectedItems)

			return 30

		tasks.done (err, results) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

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
			expect(results).to.deep.equal(expectedItems.results)
			expect(actualItems, 'completion items').to.deep.equal(expectedItems)


			done()

		tasks.run()

	###
	# Idle
	it 'idling', (done) ->
		checks = []

		tasks = new TaskGroup()

		task = tasks.addTask 'my task 1', (complete) ->
			checks.push('my task 1')
			expect(@config.name).to.equal('my task 1')
			expect(tasks.remaining.length).to.equal(0)
			expect(tasks.running).to.equal(1)

		tasks.done (err) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)
			throw new Error('should never reach here')

		tasks.on 'idle', (item) ->
			checks.push('idle check')
			expect(item).to.equal(task)

			console.log(checks)  if checks.length isnt 2
			expect(checks.length, 'checks').to.equal(2)

			tasks.destroy()

		tasks.run()
	###

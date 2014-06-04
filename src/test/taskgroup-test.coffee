# Import
{expect} = require('chai')
joe = require('joe')
{Task,TaskGroup} = require('../../')

# Prepare
wait = (delay,fn) -> setTimeout(fn,delay)
delay = 100

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
					expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
					# Return no error, and the result to the completion callback completing the task
					complete(null,10)

			# Check the task completed as expected
			task.on 'complete', (err,result) ->
				++checks
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err,result])
				expect(err, "the callback error to be null as we did not error").to.equal(null)
				expect(result, "the callback result to be as expected").to.equal(10)

			# Check task hasn't run yet
			expect(task.running, "running to be false as we haven't started running yet").to.equal(false)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run thet ask
			task.run()

			# Check that task has started running
			expect(task.running, 'running to be true as tasks execute asynchronously').to.equal(true)
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
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				# Return our result completing the task
				return 10

			# Check the task completed as expected
			task.on 'complete', (err,result) ->
				++checks
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err,result])
				expect(err, "the callback error to be null as we did not error").to.equal(null)
				expect(result, "the callback result to be as expected").to.equal(10)

			# Check task hasn't run yet
			expect(task.running, "running to be false as we haven't started running yet").to.equal(false)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.running, 'running to be true as tasks execute asynchronously').to.equal(true)
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
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				return err

			# Check the task completed as expected
			task.on 'complete', (_err,result) ->
				++checks
				expect(task.result, "the set result to be as expected as the task has completed").to.deep.equal([err])
				expect(_err, "the callback error to be set as we errord").to.equal(err)
				expect(result, "the callback result to be null we errord").to.not.exist

			# Check task hasn't run yet
			expect(task.running, "running to be false as we haven't started running yet").to.equal(false)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.running, 'running to be true as tasks execute asynchronously').to.equal(true)
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
				expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
				throw err

			# Check the task completed as expected
			task.on 'complete', (_err,result) ->
				neverReached = true
			task.on 'error', (_err) ->
				++checks
				expect(_err, "the callback error to be set as we errord").to.equal(err)

			# Check task hasn't run yet
			expect(task.running, "running to be false as we haven't started running yet").to.equal(false)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.running, 'running to be true as tasks execute asynchronously').to.equal(true)
			expect(task.result, 'result to be null as tasks execute asynchronously').to.equal(null)

			# Check that all our special checks have run
			wait delay, ->
				++checks
				expect(checks, "all our special checks have run").to.equal(3)
				expect(neverReached, "never reached to be false").to.equal(false)
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
					expect(task.result, "result to be null as we haven't set it yet").to.equal(null)
					throw err

			# Check the task completed as expected
			task.on 'complete', (_err,result) ->
				neverReached = true
			task.on 'error', (_err) ->
				++checks
				expect(_err, "the callback error to be set as we errord").to.equal(err)

			# Check task hasn't run yet
			expect(task.running, "running to be false as we haven't started running yet").to.equal(false)
			expect(task.result, "result to be null as we haven't started running yet").to.equal(null)

			# Run
			task.run()

			# Check that task has started running
			expect(task.running, 'running to be true as tasks execute asynchronously').to.equal(true)
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
			task.on 'complete', (err,result) ->
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
			task.on 'complete', (err,result) ->
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
			tasks = new TaskGroup().setConfig({concurrency:1}).on 'complete', (err,results) ->
				expect(err?.message or null).to.equal(null)
				expect(results).to.deep.equal([[null,10], [null,5]])
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(0)
				expect(tasks.config.concurrency).to.equal(1)
				done()

			tasks.addTask (complete) ->
				expect(tasks.remaining.length).to.equal(1)
				expect(tasks.running).to.equal(1)
				wait 500, ->
					expect(tasks.remaining.length).to.equal(1)
					expect(tasks.running).to.equal(1)
					complete(null, 10)

			tasks.addTask ->
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(1)
				return 5

			tasks.run()

		# Parallel with new API
		it 'should work when running in parallel', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:0}).on 'complete', (err,results) ->
				expect(err?.message or null).to.equal(null)
				expect(results).to.deep.equal([[null,5],[null,10]])
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(0)
				expect(tasks.config.concurrency).to.equal(0)
				done()

			tasks.addTask (complete) ->
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(2)
				wait 500, ->
					expect(tasks.remaining.length).to.equal(0)
					expect(tasks.running).to.equal(1)
					complete(null,10)

			tasks.addTask ->
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(2)
				return 5

			tasks.run()

		# Parallel
		it 'should work when running in parallel with new API', (done) ->
			tasks = new TaskGroup(
				concurrency: 0
				next: (err,results) ->
					expect(err?.message or null).to.equal(null)
					expect(results).to.deep.equal([[null,5],[null,10]])
					expect(tasks.remaining.length).to.equal(0)
					expect(tasks.running).to.equal(0)
					expect(tasks.config.concurrency).to.equal(0)
					done()
				tasks: [
					(complete) ->
						expect(tasks.remaining.length).to.equal(0)
						expect(tasks.running).to.equal(2)
						wait 500, ->
							expect(tasks.remaining.length).to.equal(0)
							expect(tasks.running).to.equal(1)
							complete(null,10)
					->
						expect(tasks.remaining.length).to.equal(0)
						expect(tasks.running).to.equal(2)
						return 5
				]
			).run()

	# Basic
	describe "errors", (suite,it) ->
		# Parallel
		it 'should handle error correctly in parallel', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:0}).on 'complete', (err,results) ->
				expect(err.message).to.equal('deliberate error')
				expect(results.length).to.equal(1)
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(1)
				expect(tasks.config.concurrency).to.equal(0)
				done()

			# Error via completion callback
			tasks.addTask (complete) ->
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(2)
				wait 500, ->
					err = new Error('deliberate error')
					complete(err)
				return null

			# Error via return
			tasks.addTask ->
				expect(tasks.remaining.length).to.equal(0)
				expect(tasks.running).to.equal(2)
				err = new Error('deliberate error')
				return err

			# Run tasks
			tasks.run()

		# Error Serial
		it 'should handle error correctly in serial', (done) ->
			tasks = new TaskGroup().setConfig({concurrency:1}).on 'complete', (err,results) ->
				expect(err.message).to.equal('deliberate error')
				expect(results.length).to.equal(1)
				expect(tasks.remaining.length).to.equal(1)
				expect(tasks.running).to.equal(0)
				expect(tasks.config.concurrency).to.equal(1)
				done()

			tasks.addTask (complete) ->
				expect(tasks.remaining.length).to.equal(1)
				expect(tasks.running).to.equal(1)
				err = new Error('deliberate error')
				complete(err)

			tasks.addTask ->
				throw 'unexpected'

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
				expect(tasks.remaining.length).to.equal(1)
				expect(tasks.running).to.equal(1)
				wait 500, ->
					checks.push('my task 2')
					expect(tasks.remaining.length).to.equal(1)
					expect(tasks.running).to.equal(1)
					complete()

			addGroup 'my group', (addGroup,addTask) ->
				checks.push('my group')
				expect(@config.name).to.equal('my group')
				expect(tasks.remaining.length, 'my group remaining').to.equal(0)
				expect(tasks.running).to.equal(1)

				addTask 'my second task', ->
					checks.push('my second task')
					expect(@config.name).to.equal('my second task')
					expect(tasks.remaining.length, 'my second task remaining').to.equal(0)
					expect(tasks.running).to.equal(1)

		tasks.on 'complete', (err) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

			done()

	# Traditional
	it 'traditional format', (done) ->
		checks = []

		tasks = new TaskGroup().run()

		tasks.addTask 'my task', (complete) ->
			checks.push('my task 1')
			expect(@config.name).to.equal('my task')
			expect(tasks.remaining.length).to.equal(1)
			expect(tasks.running).to.equal(1)
			wait 500, ->
				checks.push('my task 2')
				expect(tasks.remaining.length).to.equal(1)
				expect(tasks.running).to.equal(1)
				complete()

		tasks.addGroup 'my group', ->
			checks.push('my group')
			expect(@config.name).to.equal('my group')
			expect(tasks.remaining.length, 'my group remaining').to.equal(0)
			expect(tasks.running).to.equal(1)

			@addTask 'my second task', ->
				checks.push('my second task')
				expect(@config.name).to.equal('my second task')
				expect(tasks.remaining.length, 'my second task remaining').to.equal(0)
				expect(tasks.running).to.equal(1)

		tasks.on 'complete', (err) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

			done()

	# Mixed
	it 'mixed format', (done) ->
		checks = []

		tasks = new TaskGroup()

		tasks.addTask 'my task 1', ->
			checks.push('my task 1')
			expect(@config.name).to.equal('my task 1')
			expect(tasks.remaining.length).to.equal(2)
			expect(tasks.running).to.equal(1)

		tasks.addGroup 'my group 1', ->
			checks.push('my group 1')
			expect(@config.name).to.equal('my group 1')
			expect(tasks.remaining.length, 'my group 1 remaining').to.equal(1)
			expect(tasks.running).to.equal(1)

			@addTask 'my task 2', ->
				checks.push('my task 2')
				expect(@config.name).to.equal('my task 2')
				expect(tasks.remaining.length, 'my task 2 remaining').to.equal(1)
				expect(tasks.running).to.equal(1)

		tasks.addTask 'my task 3', ->
			checks.push('my task 3')
			expect(@config.name).to.equal('my task 3')
			expect(tasks.remaining.length).to.equal(0)
			expect(tasks.running).to.equal(1)

		tasks.on 'complete', (err) ->
			console.log(err)  if err
			expect(err?.message or null).to.equal(null)

			console.log(checks)  if checks.length isnt 4
			expect(checks.length, 'checks').to.equal(4)

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

		tasks.on 'complete', (err) ->
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

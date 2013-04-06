# Import
{expect} = require('chai')
joe = require('joe')
{Task,TaskGroup} = require('../../')

# Prepare
wait = (delay,fn) -> setTimeout(fn,delay)

# Task
joe.describe 'task', (describe,it) ->
	# Async
	it 'should work with async', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task (complete) ->
			wait 500, ->
				++checks
				expect(task.result).to.eql(null)
				complete(null,10)

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.result).to.eql([err,result])
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()

	# Sync
	it 'should work with sync', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task ->
			++checks
			expect(task.result).to.eql(null)
			return 10

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.result).to.eql([err,result])
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()

	# Async
	it 'should detect async error', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task (complete) ->
			wait 500, ->
				++checks
				expect(task.result).to.eql(null)
				err = new Error('deliberate error')
				complete(err)

		# Check
		task.on 'complete', (err) ->
			++checks
			expect(task.result).to.eql([err])
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()


	# Sync
	it 'should detect sync error', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task ->
			++checks
			expect(task.result).to.eql(null)
			err = new Error('deliberate error')
			return err

		# Check
		task.on 'complete', (err) ->
			++checks
			expect(task.result).to.eql([err])
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
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
				expect(task.result).to.eql(null)
				complete(null,a*b)

		# Apply the arguments
		task.setConfig(args:[2,5])

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.result).to.eql([err,result])
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()


	# Async
	it 'should work with arguments in sync', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task (a,b) ->
			++checks
			expect(task.result).to.eql(null)
			return a*b

		# Apply the arguments
		task.setConfig(args:[2,5])

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.result).to.eql([err,result])
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()


# Task Group
joe.describe 'taskgroup', (describe,it) ->
	# Parallel
	it 'should work when running in parallel', (done) ->
		tasks = new TaskGroup().setConfig({concurrency:0}).on 'complete', (err,results) ->
			expect(err).to.eql(null)
			expect(results).to.eql([[null,5],[null,10]])
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(0)
			expect(tasks.concurrency).to.eql(0)
			done()

		tasks.addTask (complete) ->
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(2)
			wait 500, ->
				expect(tasks.remaining.length).to.eql(0)
				expect(tasks.running).to.eql(1)
				complete(null,10)

		tasks.addTask ->
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(2)
			return 5

		tasks.run()

	# Serial
	it 'should work when running in serial', (done) ->
		tasks = new TaskGroup().setConfig({concurrency:1}).on 'complete', (err,results) ->
			expect(err).to.eql(null)
			expect(results).to.eql([[null,10],[null,5]])
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(0)
			expect(tasks.concurrency).to.eql(1)
			done()

		tasks.addTask (complete) ->
			expect(tasks.remaining.length).to.eql(1)
			expect(tasks.running).to.eql(1)
			wait 500, ->
				expect(tasks.remaining.length).to.eql(1)
				expect(tasks.running).to.eql(1)
				complete(null,10)

		tasks.addTask ->
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(1)
			return 5

		tasks.run()

	# Error Parallel
	it 'should handle error correctly in parallel', (done) ->
		tasks = new TaskGroup().setConfig({concurrency:0}).on 'complete', (err,results) ->
			expect(err.message).to.eql('deliberate error')
			expect(results.length).to.eql(1)
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(1)
			expect(tasks.concurrency).to.eql(0)
			done()

		tasks.addTask (complete) ->
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(2)
			wait 500, ->
				err = new Error('deliberate error')
				complete(err)

		tasks.addTask ->
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(2)
			err = new Error('deliberate error')
			return err

		tasks.run()

	# Error Serial
	it 'should handle error correctly in serial', (done) ->
		tasks = new TaskGroup().setConfig({concurrency:1}).on 'complete', (err,results) ->
			expect(err.message).to.eql('deliberate error')
			expect(results.length).to.eql(1)
			expect(tasks.remaining.length).to.eql(1)
			expect(tasks.running).to.eql(0)
			expect(tasks.concurrency).to.eql(1)
			done()

		tasks.addTask (complete) ->
			expect(tasks.remaining.length).to.eql(1)
			expect(tasks.running).to.eql(1)
			err = new Error('deliberate error')
			complete(err)

		tasks.addTask ->
			throw 'unexpected'

		tasks.run()



# Test Runner
joe.describe 'inline', (describe,it) ->
	# Work
	it 'should work', (done) ->
		checks = 0

		tasks = new TaskGroup 'my tests', (addGroup,addTask) ->
			expect(@name).to.eql('my tests')

			addTask 'my task', (complete) ->
				++checks
				expect(@name).to.eql('my task')
				expect(tasks.remaining.length).to.eql(1)
				expect(tasks.running).to.eql(1)
				wait 500, ->
					++checks
					expect(tasks.remaining.length).to.eql(1)
					expect(tasks.running).to.eql(1)
					complete()

			addGroup 'my group', (addGroup,addTask) ->
				++checks
				expect(@name).to.eql('my group')
				expect(tasks.remaining.length).to.eql(0)
				expect(tasks.running).to.eql(1)

				addTask 'my second task', ->
					++checks
					expect(@name).to.eql('my second task')
					expect(tasks.remaining.length).to.eql(0)
					expect(tasks.running).to.eql(1)

		tasks.on 'complete', (err) ->
			expect(err).to.eql(null)
			expect(checks).to.eql(4)
			done()


# Import
{expect} = require('chai')
joe = require('joe')
{Task,TaskGroup,TaskRunner,TestRunner} = require('../../')

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
				expect(task.completed).to.eql(false)
				complete(null,10)

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
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
			expect(task.completed).to.eql(false)
			return 10

		# Check
		task.on 'complete', (err,result) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err).to.eql(null)
			expect(result).to.eql(10)

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
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
				expect(task.completed).to.eql(false)
				err = new Error('deliberate error')
				complete(err)

		# Check
		task.on 'complete', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
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
			expect(task.completed).to.eql(false)
			err = new Error('deliberate error')
			return err

		# Check
		task.on 'complete', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
			expect(checks).to.eql(3)
			done()

		# Run
		task.run()


# Task Group
joe.describe 'taskgroup', (describe,it) ->
	# Parallel
	it 'should work when running in parallel', (done) ->
		tasks = new TaskGroup (err,results) ->
			expect(err).to.eql(null)
			expect(results).to.eql([[null,5],[null,10]])
			expect(tasks.remaining.length).to.eql(0)
			expect(tasks.running).to.eql(0)
			expect(tasks.concurrency).to.eql(null)
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
		tasks = new TaskGroup (err,results) ->
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

		tasks.run(1)

	# Error
	it 'should handle error correctly', (done) ->
		tasks = new TaskGroup (err,results) ->
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

		tasks.run(1)



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
		task = new Task 'my name', (complete) ->
			wait 500, ->
				++checks
				expect(task.completed).to.eql(false)
				complete(null,10)

		# Check
		task.on 'error', ->
			throw new Error('unexpected')
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
		task = new Task 'my name', ->
			++checks
			expect(task.completed).to.eql(false)
			return 10

		# Check
		task.on 'error', ->
			throw new Error('unexpected')
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
		task = new Task 'my name', (complete) ->
			wait 500, ->
				++checks
				expect(task.completed).to.eql(false)
				err = new Error('deliberate error')
				complete(err)

		# Check
		task.on 'error', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')
		task.on 'complete', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
			expect(checks).to.eql(4)
			done()

		# Run
		task.run()


	# Sync
	it 'should detect sync error', (done) ->
		# Prepare
		checks = 0

		# Create
		task = new Task 'my name', ->
			++checks
			expect(task.completed).to.eql(false)
			err = new Error('deliberate error')
			return err

		# Check
		task.on 'error', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')
		task.on 'complete', (err) ->
			++checks
			expect(task.completed).to.eql(true)
			expect(err.message).to.eql('deliberate error')

		# Check
		wait 1000, ->
			++checks
			expect(task.completed).to.eql(true)
			expect(checks).to.eql(4)
			done()

		# Run
		task.run()


# Task Group
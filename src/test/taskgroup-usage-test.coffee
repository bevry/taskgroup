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
throwUnexpected = ->
	throw new Error('this error is unexpected')
returnResult = (number) -> -> number
returnError = (message) -> -> new Error(message)
expectResult = (argsExpected...) -> (argsActual...) ->
	try
		expect(argsActual).to.deep.equal(argsExpected)
	catch err
		inspect 'actual:', argsActual, 'expected:', argsExpected
		throw err
expectError = (message, next) -> (err) ->
	try
		expect(err?.message).to.contain(message)
		next?()
	catch err
		inspect 'actual:', err, 'expected:', message
		if next?
			next(err)
		else
			throw err


# ====================================
# Task

joe.describe 'task', (describe, it) ->
	# failure: done with no run
	it 'Task.create(...).done(...) should time out when run was not called', (complete) ->
		Task.create(returnResult(5)).done(throwUnexpected)
		wait(1000, complete)

	# failure: done with no task method
	it 'Task.create().run().done(...) should fail as there was no task method defined', (complete) ->
		Task.create().run().done(expectError('no method', complete))
	
	# success: run then done
	it 'Task.create(...).run().done(...) should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)
	
	# success: done then run
	it 'Task.create(...).done(...).run() should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)

	# failure: run then run then done
	it 'Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', (complete) ->
		Task.create(returnResult(5))
			.run().run()
			.on('error', expectError('started earlier', complete))

	# failure: done then run then run
	it 'Task.create(...).done(...).run().run() should fail as a task is not allowed to run twice', (complete) ->
		task = Task.create(returnResult(5))
			.on('error', expectError('started earlier', complete))
			.run().run()
			
joe.describe 'taskgroup', (describe, it) ->
	# failure: done with no run
	it 'TaskGroup.create().addTask(...).done(...) should time out when run was not called', (complete) ->
		TaskGroup.create().addTask(returnResult(5)).done(throwUnexpected)
		wait(1000, complete)

	# success: done with no tasks then run
	it 'TaskGroup.create().run().done(...) should complete with no results', (complete) ->
		TaskGroup.create().run().done(expectResult(null, [])).done(complete)

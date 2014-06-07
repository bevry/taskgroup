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

# ====================================
# Task

joe.describe 'task', (describe, it) ->
	# failure: done with no run
	it 'Task.create(...).done(...) should time out when run was not called', (complete) ->
		Task.create(returnResult(5)).done(throwUnexpected)
		wait(1000, complete)
	
	# success: run then done
	it 'Task.create(...).run().done(...) should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)
	
	# success: done then run
	it 'Task.create(...).done(...).run() should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)
	
###
	# failure: run then run then done
	it 'Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', (complete) ->
		Task.create(returnResult(5)).run().run().done (err) ->
			expect(err.message).to.contain('but it has already started earlier')
			complete()
###
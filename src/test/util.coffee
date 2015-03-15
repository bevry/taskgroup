util = require('util')
{expect} = require('chai')

delay = 100

wait = (delay,fn) -> setTimeout(fn,delay)

inspect = (args...) ->
	for arg in args
		console.log util.inspect(arg, {colors:true})

throwUnexpected = ->
	throw new Error('this error is unexpected')

returnResult = (result) -> -> result

returnResultAfterDelay = (result, delay) -> (complete) -> wait delay, -> complete(null, result)

returnError = (message) -> -> new Error(message)

expectDeep = (argsActual, argsExpected) ->
	try
		expect(argsActual).to.deep.equal(argsExpected)
	catch checkError
		inspect 'actual:', argsActual, 'expected:', argsExpected
		throw checkError

expectResult = (argsExpected...) -> (argsActual...) ->
	expectDeep(argsActual, argsExpected)

expectError = (inputError, message, description) ->
	try
		if message
			expect(inputError?.message or inputError, description).to.contain(message)
		else
			expect(inputError, description).to.equal(message)
	catch checkError
		inspect 'actual:', inputError?.stack, 'expected:', message
		throw checkError
	return null

completeWithError = (message, next) -> (inputError) ->
	try
		expectError(inputError, message)
	catch checkError
		if next?
			return next(checkError)
		else
			throw checkError
	return next?()

module.exports = {delay, wait, inspect, throwUnexpected, returnResult, returnError, expectDeep, expectResult, expectError, completeWithError, returnResultAfterDelay}
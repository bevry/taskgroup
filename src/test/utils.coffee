delay = 100

wait = (delay,fn) -> setTimeout(fn,delay)

inspect = (args...) ->
	for arg in args
		console.log util.inspect(arg, {colors:true})

throwUnexpected = ->
	throw new Error('this error is unexpected')

returnResult = (number) -> -> number

returnError = (message) -> -> new Error(message)

expectDeep = (argsActual, argsExpected) ->
	try
		expect(argsActual).to.deep.equal(argsExpected)
	catch err
		inspect 'actual:', argsActual, 'expected:', argsExpected
		throw err

expectResult = (argsExpected...) -> (argsActual...) ->
	expectDeep(argsActual, argsExpected)

expectError = (err, message) ->
	try
		expect(err?.message).to.contain(message)
	catch err
		inspect 'actual:', err, 'expected:', message
		return err
	return null

completeWithError = (message, next) -> (err) ->
	result = expectError(err, message)
	unless result
		next?()
	else
		if next?
			next(err)
		else
			throw err

module.exports = {delay, wait, inspect, throwUnexpected, returnResult, returnError, expectDeep, expectResult, expectError}
# Import
{TaskGroup} = require('./')

# Create our group
tasks = new TaskGroup().once 'complete', (err,results) ->
	console.log(err)  # null
	console.log(JSON.stringify results)
	###
	[
		[null, 'first'],
		[null, 'second'],
		[null, [
			[null, 'sub second'],
			[null, 'sub first']
		]]
	]
	###

# Add an asynchronous task
tasks.addTask (complete) ->
	setTimeout(
		-> complete(null, 'first')
		500
	)

# Add a synchronous task
tasks.addTask ->
	return 'second'

# Add a group
tasks.addGroup (addGroup,addTask) ->
	# Tell this group to execute in parallel
	@setConfig({concurrency:0})

	# Add an asynchronous task
	@addTask (complete) ->
		setTimeout(
			-> complete(null, 'sub first')
			1000
		)

	# Add a synchronous task
	@addTask ->
		return 'sub second'

# Fire the tasks
tasks.run()
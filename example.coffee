# Import
{TaskGroup} = require('./')

# Create our group
group = new TaskGroup().once 'complete', (err,results) ->
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
group.addTask (complete) ->
	setTimeout(
		-> complete(null, 'first')
		500
	)

# Add a synchronous task
group.addTask ->
	return 'second'

# Add a group
group.addGroup (addGroup,addTask) ->
	# Tell this sub group to execute in parallel
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

# Execute the items in the group
group.run()
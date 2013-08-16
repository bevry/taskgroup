# Import
ambi = require('ambi')
EventEmitter = require('eventemitter2').EventEmitter2

# Task
# Events
# - complete
# - run
class Task extends EventEmitter
	type: 'task'  # for duck typing
	result: null
	running: false
	completed: false
	parent: null

	# Config
	name: null
	method: null
	args: null

	# Create a new task
	# - new Task(name, method)
	# - new Task(method)
	constructor: (args...) ->
		# Prepare
		super

		# Prepare configuration
		name = method = null

		# Extract the configuration from the arguments
		if args.length
			# If we have both arguments then set name and method
			if args.length is 2
				[name, method] = args

			# If we just have one argument then just set the method
			else if args.length is 1
				[method] = args

		# Apply configuration
		@setConfig({name, method})

		# Chain
		@

	setConfig: (opts={}) =>
		# Apply the configuration directly to our instance
		for own key,value of opts
			@[key] = value

		# Chain
		@

	run: ->
		# Prepare
		domain = null

		# Define our uncaught error callback to put the task into its completion state
		# as well as emit the error event
		uncaughtErrorCallback = (args...) =>
			# Dispose of our domain
			if domain?
				domain.dispose()
				domain = null

			# Apply our completion flags if we have not yet completed
			unless @completed
				@completed = true
				@running = false
				@result = args

			# Fire our uncaught error handler
			@emit('error', err)

		# Define our completion callback to put the task into its completion state
		# as well as emit the completion event
		# we also check for unexpected double completion
		completionCallback = (args...) =>
			# Dispose of our domain
			if domain?
				domain.dispose()
				domain = null

			# Already completed?
			if @completed is true
				# We have already completed and this is unexpected so emit an error event
				err = new Error("A task's completion callback has fired when the task was already in a completed state, this is unexpected")
				@emit('error', err)

			# Complete for the first (and hopefully only) time
			else
				# Update our flags
				@completed = true
				@running = false
				@result = args

				# Notify our listeners of our completion
				@emit('complete', @result...)

		# Reset our flags
		@completed = false
		@running = true
		@result = null

		# Reset our domain
		if domain?
			domain.dispose()
			domain = null
		#domain = require('domain').create()

		# Notify our intention
		@emit('run')

		# Give time for the listeners to complete before continuing
		# needed for task groups
		process.nextTick =>
			# Add our completion callback to our specified arguments to send over to the method
			args = (@args or []).concat([completionCallback])

			# Fire the method be it asynchronously or synchronously with ambi
			# and wrap it in a domain to ensure that the task executes safely
			#domain.on('error', completionCallback)
			#domain.run =>
			ambi(@method.bind(@), args...)

		# Chain
		@


# Task Group
# Events
# - (task|group|item).(complete|run)
# - complete
# - run
class TaskGroup extends EventEmitter
	type: 'taskgroup'  # for duck typing
	running: 0
	remaining: null
	err: null
	results: null
	parent: null
	paused: true

	# Config
	name: null
	method: null
	concurrency: 1  # use 0 for unlimited
	pauseOnError: true  # needs testing

	constructor: (args...) ->
		# Init
		super
		@err = null
		@results = []
		@remaining = []

		# Apply
		name = method = null
		if args.length
			if args.length is 2
				[name, method] = args
			else if args.length is 1
				[method] = args
		@setConfig({name, method})

		# Give setConfig enough chance to fire
		process.nextTick =>
			# Auto run if we are going the inline style and have no parent
			if @method
				# Add the function as our first unamed task with the extra arguments
				args = [@addGroup, @addTask]
				@addTask(@method.bind(@)).setConfig({args, includeInResults:false})

				# Proceed to run if we are the topmost group
				@run()  if !@parent

		# Handle item completion
		@on 'item.complete', (item,args...) =>
			# Add the result
			@results.push(args)  if item.includeInResults isnt false

			# Update error if it exists
			@err = args[0]  if args[0]

			# Mark that one less item is running
			--@running  if @running > 0

			# Already exited?
			return  if @paused

			# Continue or finish up
			@nextItems()  unless @complete()

		# Chain
		@

	setConfig: (opts={}) =>
		# Configure
		for own key,value of opts
			@[key] = value

		# Chain
		@

	getTotals: ->
		running = @running
		remaining = @remaining.length
		completed = @results.length
		total = running + remaining + completed
		return {running,remaining,completed,total}

	addItem: (item) =>
		# Prepare
		me = @

		# Bubble item events
		# be explicit about error events due to their special nature
		item.onAny (args...) ->
			# return  if @event is 'error'
			me.emit("item.#{@event}", item, args...)
		item.on 'error', (err) ->
			me.emit("item.error", item, args...)
			me.exit(err)

		# Notify our intention
		@emit('add', item)

		# Add the item
		@remaining.push(item)

		# Run the item right away, unless we are paused
		@nextItems()  unless @paused

		# Return the item
		return item

	createTask: (args...) =>
		task = new Task(args...)
		return task

	addTask: (args...) =>
		# Prepare
		me = @

		# Create the task with our arguments
		task = @createTask(args...).setConfig({parent:@})

		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", task, args...)

		# Return the item
		return @addItem(task)

	createGroup: (args...) =>
		group = new TaskGroup(args...)
		return group

	addGroup: (args...) =>
		# Prepare
		me = @

		# Create the group with our arguments
		group = @createGroup(args...).setConfig({concurrency:@concurrency,parent:@})

		# Bubble task events
		group.onAny (args...) ->
			me.emit("group.#{@event}", group, args...)

		# Return the item
		return @addItem(group)

	hasItems: =>
		# Do we have any items left to run
		return @remaining.length isnt 0

	isReady: =>
		# Do we have available slots to run
		return !@concurrency or @running < @concurrency

	nextItems: =>
		items = []

		# Fire the next items
		while true
			item = @nextItem()
			if item
				items.push(item)
			else
				break

		return if items.length then items else false

	nextItem: =>
		# Do we have items to run?
		if @hasItems()
			# Do we have available slots to run?
			if @isReady()
				# Get the next item and remove it from the remaining items
				nextItem = @remaining.shift()
				++@running

				# Run it
				nextItem.run()

				# Return the item
				return nextItem

		# Didn't fire another item
		return false

	complete: =>
		# Determine completion
		pause = @pauseOnError and @err
		empty = @hasItems() is false and @running is 0
		completed = pause or empty

		# Continue with completion
		if completed
			# Pause if desired
			@pause()  if pause

			# Notify we've completed and send the error and results if we have them
			@emit('complete',@err,@results)

			# Reset the error and results to build up again for the next completion
			@err = null
			@results = []

		# Return result
		return completed

	clear: =>
		# Removes all the items from remaining
		@remaining.splice(0)

		# Chain
		@

	stop: =>
		# Stop further execution
		@pause()

		# Clear everything remaining
		@clear()

		# Chain
		@

	exit: (err) =>
		# Apply
		@err = err  if err

		# Clear
		@stop()

		# Stop running
		@running = 0

		# Complete
		@complete()

		# Chain
		@

	pause: =>
		@paused = true
		@

	run: (args...) =>
		# Resume
		@paused = false

		# Notify our intention to run
		@emit('run')

		# Give time for the listeners to complete before continuing
		process.nextTick =>
			# Continue or finish up
			@nextItems()  unless @complete()

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
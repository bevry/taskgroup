# Import
ambi = require('ambi')
events = require('events')
domain =
	try
		require('domain')
	catch err
		null
{EventEmitter} = events

# Task
# Events
# - complete
# - run
class Task extends EventEmitter
	# Variables
	type: 'task'  # for duck typing
	result: null
	running: false
	completed: false
	taskDomain: null

	# Config
	config: null
		###
		name: null
		method: null
		args: null
		parent: null
		###

	# Create a new task
	# - new Task(name, method)
	# - new Task(method)
	constructor: (args...) ->
		# Prepare
		super
		@config ?= {}
		@config.name ?= "Task #{Math.random()}"
		@config.run ?= false

		# Prepare configuration
		opts = {}

		# Extract the configuration from the arguments
		for arg in args
			switch typeof arg
				when 'string'
					opts.name = arg
				when 'function'
					opts.method = arg
				when 'object'
					for own key,value of arg
						opts[key] = value

		# Apply configuration
		@setConfig(opts)

		# Chain
		@

	# Set Configuration
	setConfig: (opts={}) ->
		# Apply the configuration directly to our instance
		for own key,value of opts
			switch key
				when 'next'
					@once('complete', value.bind(@))  if value
				else
					@config[key] = value

		# Chain
		@

	# Get Config
	getConfig: -> @config

	# Reset
	reset: ->
		# Reset our flags
		@completed = false
		@running = false
		@result = null

		# Chain
		@

	# Uncaught Exception
	# Define our uncaught error callback to put the task into its completion state
	# as well as emit the error event
	uncaughtExceptionCallback: (args...) ->
		# Extract the error
		err = args[0]

		# Apply our completion flags if we have not yet completed
		@complete(args)  unless @completed

		# Fire our uncaught error handler
		@emit('error', err)

		# Chain
		@

	# Completion Callback
	completionCallback: (args...) ->
		# Complete for the first (and hopefully only) time
		unless @completed
			# Update our flags
			@complete(args)

			# Notify our listeners of our completion
			@emit('complete', @result...)

		# Error as we have already completed before
		else
			err = new Error("A task's completion callback has fired when the task was already in a completed state, this is unexpected")
			@emit('error', err)

		# Chain
		@

	# Destroy
	destroy: ->
		# Remove all isteners
		@removeAllListeners()

		# Chain
		@

	# Complete
	complete: (result) ->
		# Apply completion flags
		@completed = true
		@running = false
		@result = result

		# Chain
		@

	# Fire
	fire: ->
		# Prepare
		me = @

		# Add our completion callback to our specified arguments to send over to the method
		args = (@config.args or []).concat([@completionCallback.bind(@)])

		# Prepare the task domain if it doesn't already exist
		if @taskDomain? is false and domain?.create?
			@taskDomain = domain.create()
			@taskDomain.on('error', @uncaughtExceptionCallback.bind(@))

		# Listen for uncaught errors
		fire = ->
			try
				ambi(me.config.method.bind(me), args...)
			catch err
				me.uncaughtExceptionCallback(err)

		if @taskDomain?
			@taskDomain.run(fire)
		else
			fire()

		# Chain
		@

	# Run
	run: ->
		# Already completed?
		if @completed
			err = new Error("A task was about to run but it has already completed, this is unexpected")
			@emit('error', err)

		# Not yet completed, so lets run!
		else
			# Reset to a running state
			@reset()
			@running = true

			# Notify our intention
			@emit('run')

			# Give time for the listeners to complete before continuing
			# This delay is needed for task groups
			process.nextTick(@fire.bind(@))

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
	paused: true
	bubbleEvents: null

	# Config
	config: null
		###
		name: null
		method: null
		concurrency: 1  # use 0 for unlimited
		pauseOnError: true
		parent: null
		###

	constructor: (args...) ->
		# Init
		me = @
		super
		@config ?= {}
		@config.name ?= "Task Group #{Math.random()}"
		@config.concurrency ?= 1
		@config.pauseOnError ?= true
		@config.run ?= false
		@results ?= []
		@remaining ?= []
		@bubbleEvents ?= ['complete', 'run', 'error']

		# Prepare configuration
		opts = {}

		# Extract the configuration from the arguments
		for arg in args
			switch typeof arg
				when 'string'
					opts.name = arg
				when 'function'
					opts.method = arg
				when 'object'
					for own key,value of arg
						opts[key] = value

		# Apply configuration
		@setConfig(opts)

		# Give setConfig enough chance to fire
		process.nextTick(@fire.bind(@))

		# Handle errors
		@on('error', (err) -> me.exit(err))

		# Handle item completion
		@on('item.complete', @itemCompletionCallback.bind(@))

		# Handle item error
		@on('item.error', @itemUncaughtExceptionCallback.bind(@))

		# Chain
		@

	setConfig: (opts={}) ->
		# Apply the configuration directly to our instance
		for own key,value of opts
			switch key
				when 'next'
					@once('complete', value.bind(@))  if value
				when 'task', 'tasks'
					@addTasks(value)  if value
				when 'group', 'groups'
					@addGroups(value)  if value
				when 'item', 'items'
					@addItems(value)  if value
				else
					@config[key] = value

		# Chain
		@

	getConfig: -> @config

	fire: ->
		# Auto run if we are going the inline style and have no parent
		if @config.method
			# Add the function as our first unamed task with the extra arguments
			@addTask(@config.method.bind(@), {
				args: [@addGroup.bind(@), @addTask.bind(@)]
				includeInResults:false
			})

			# Proceed to run if we are the topmost group
			@run()  if !@config.parent

		# Auto run if we are ocnfigured to
		@run()  if @config.run is true

		# Chain
		@

	itemCompletionCallback: (item, args...) ->
		# Add the result
		@results.push(args)  if item.config.includeInResults isnt false

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

	itemUncaughtExceptionCallback: (item, err) ->
		# Stop further execution and exit with the error
		@exit(err)

		# Chain
		@

	getTotals: ->
		running = @running
		remaining = @remaining.length
		completed = @results.length
		total = running + remaining + completed
		return {
			running
			remaining
			completed
			total
		}

	# Add an item
	# also run for groups too
	addItem: (item) ->
		# Prepare
		me = @

		# Link our item to ourself
		item.setConfig({parent: @})

		# Bubble task events
		if item.type is 'task'
			@bubbleEvents.forEach (bubbleEvent) ->
				item.on bubbleEvent, (args...) ->
					me.emit("task.#{bubbleEvent}", item, args...)

			# Notify our intention
			@emit('task.add', item)

		# Bubble group events
		if item.type is 'taskgroup'
			# Bubble item events
			@bubbleEvents.forEach (bubbleEvent) ->
				item.on bubbleEvent, (args...) ->
					me.emit("group.#{bubbleEvent}", item, args...)

			# Notify our intention
			@emit('group.add', item)

		# Bubble item events
		@bubbleEvents.forEach (bubbleEvent) ->
			item.on bubbleEvent, (args...) ->
				me.emit("item.#{bubbleEvent}", item, args...)

		# Notify our intention
		@emit('item.add', item)

		# Add the item
		@remaining.push(item)

		# Run the item right away, unless we are paused
		@nextItems()  unless @paused

		# Return the item
		return item

	addItems: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addItem(item, args...)  for item in items)


	createTask: (args...) ->
		return args[0]  if args[0]?.type is 'task'
		return new Task(args...)

	addTask: (args...) ->
		return @addItem @createTask args...

	addTasks: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addTask(item, args...)  for item in items)


	createGroup: (args...) ->
		return args[0]  if args[0]?.type is 'taskgroup'
		return new TaskGroup(args...)

	addGroup: (args...) ->
		return @addItem @createGroup args...

	addGroups: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addGroup(item, args...)  for item in items)


	hasItems: ->
		# Do we have any items left to run
		return @remaining.length isnt 0

	isReady: ->
		# Do we have available slots to run
		return !@config.concurrency or @running < @config.concurrency

	nextItems: ->
		items = []

		# Fire the next items
		while true
			item = @nextItem()
			if item
				items.push(item)
			else
				break

		result = if items.length then items else false
		return result

	nextItem: ->
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

	complete: ->
		# Determine completion
		pause = @config.pauseOnError and @err
		empty = @hasItems() is false and @running is 0
		completed = pause or empty

		# Continue with completion
		if completed
			# Pause if desired
			@pause()  if pause

			# Notify we've completed and send the error and results if we have them
			@emit('complete', @err, @results)

			# Reset the error and results to build up again for the next completion
			@err = null
			@results = []

		# Return result
		return completed

	clear: ->
		# Removes all the items from remaining
		for item in @remaining.splice(0)
			item.destroy()

		# Chain
		@

	destroy: ->
		# Destroy and clear items
		@stop()

		# Remove listeners
		@removeAllListeners()

		# Chain
		@

	stop: ->
		# Stop further execution
		@pause()

		# Clear everything remaining
		@clear()

		# Chain
		@

	exit: (err) ->
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

	pause: ->
		@paused = true
		@

	run: (args...) ->
		# Prepare
		me = @
		# Resume
		@paused = false

		# Notify our intention to run
		@emit('run')

		# Give time for the listeners to complete before continuing
		process.nextTick ->
			# Continue or finish up
			me.nextItems()  unless me.complete()

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
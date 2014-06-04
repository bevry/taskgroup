# Import
setImmediate = global?.setImmediate or process.nextTick  # node 0.8 b/c
queue = process.nextTick
ambi = require('ambi')
events = require('events')
domain = (try require('domain')) ? null
{EventEmitter} = events
{extendOnClass} = require('extendonclass')

# Generic Interface with common methods used by both Task and TaskGroup
class Interface extends EventEmitter
	constructor: ->
		super

		# Bind our default error handler
		# to ensure that errors are caught if the user doesn't catch them
		@on('error', @defaultErrorHandler)
		@on('complete', @defaultErrorHandler)

		# Chain
		@

	# for @internal use only, do not use externally
	# By default throw the error if present if no other completion callback has been
	defaultErrorHandler: (err) ->
		if err
			console.error(err.stack or err)
			throw err
		@

	# Done
	# Listens to the complete event
	# But if we are already completed, then fire the complete event
	done: (handler) ->
		# PRepare
		me = @

		# Check if we have a handler
		# We may not if our parent is a promise and is being used to emit events
		if handler?
			# ensure the passed done handler is ever only fired once and once only regardless of which event fires
			wrappedHandler = (args...) ->
				# remove our wrapped handler instance so we don't ever fire it again
				me
					.removeListener('error', wrappedHandler)
					.removeListener('complete', wrappedHandler)

				# fire the original handler as expected
				handler.apply(me, args)

			# ensure the done handler is ever only fired once and once only regardless of which event fires
			@
				.on('error', wrappedHandler)
				.on('complete', wrappedHandler)

		# Chain
		@

	# Remove our default
	on: (event, listener) ->
		if event in ['complete', 'error']
			EventEmitter::removeListener.call(@, event, @defaultErrorHandler)
		super

	once: (event, listener) ->
		if event in ['complete', 'error']
			EventEmitter::removeListener.call(@, event, @defaultErrorHandler)
		super

	removeListener: (event, listener) ->
		result = super
		if event in ['complete', 'error'] and @listeners(event).length is 0
			EventEmitter::on.call(@, event, @defaultErrorHandler)
		return result

	# Get Names
	getNames: (opts={}) ->
		# Prepare
		opts.format ?= 'string'
		opts.separator ?= ' ➞  '

		# Fetch
		names = @config.parent?.getNames(format: 'array') or []
		names.push(name)  if name = @getName()

		# Format
		if opts.format isnt 'array'
			names = names.join(opts.separator)

		# Return
		return names

	# Get Name
	getName: ->
		return @config.name

# Task
# Events
# - complete
# - run
class Task extends Interface
	@extend: extendOnClass
	@create: (args...) -> return new @(args...)

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
		context: null
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

		# Apply configuration
		@setConfig(args)

		# Chain
		@

	# Set Configuration
	# opts = object|array
	setConfig: (opts={}) ->
		# Handle arguments
		if Array.isArray(opts)
			# Prepare configuration
			args = opts
			opts = {}

			# Extract the configuration from the arguments
			for arg in args
				continue  unless arg
				switch typeof arg
					when 'string'
						opts.name = arg
					when 'function'
						opts.method = arg
					when 'object'
						for own key,value of arg
							opts[key] = value

		# Apply the configuration directly to our instance
		for own key,value of opts
			switch key
				when 'next'
					@done(value)  if value
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

	# Has Exited
	hasExited: ->
		return @completed is true

	# Is Done
	isDone: ->
		return @hasExited() is true

	# Uncaught Exception
	# Define our uncaught error callback to put the task into its completion state
	# as well as emit the error event
	uncaughtExceptionCallback: (args...) ->
		# Extract the error
		err = args[0]

		# Apply our completion flags if we have not yet completed
		@complete(args)  if @hasExited() is false

		# Fire our uncaught error handler
		@emit('error', err)

		# Chain
		@

	# Completion Callback
	completionCallback: (args...) ->
		# Complete for the first (and hopefully only) time
		if @hasExited() is false
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

	# Done
	# Listens to the complete event
	# But if we are already completed, then fire the complete event
	done: (next) ->
		super
		queue =>
			@emit('complete', (@result or [])...)  if @isDone() is true
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
				if me.config.method?.bind
					methodToFire = me.config.method.bind(me.config.context or me)
					ambi(methodToFire, args...)
				else
					throw new Error("The task #{me.config.name} was fired but has no method to fire")
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
		if @hasExited() is true
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
			setImmediate(@fire.bind(@))

		# Chain
		@


# Task Group
# Events
# - (task|group|item).(complete|run)
# - complete
# - run
class TaskGroup extends Interface
	@extend: extendOnClass
	@create: (args...) -> return new @(args...)

	# Variables
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

		# Apply configuration
		@setConfig(args)

		# Give setConfig enough chance to fire
		# Changing this to setImmediate breaks a lot of things
		# As tasks inside nested taskgroups will fire in any order
		process.nextTick(@fire.bind(@))

		# Handle item completion
		@on('item.complete', @itemCompletionCallback.bind(@))

		# Handle item error
		@on('item.error', @itemUncaughtExceptionCallback.bind(@))

		# Chain
		@

	# Set Configuration
	# opts = object|array
	setConfig: (opts={}) ->
		# Handle arguments
		if Array.isArray(opts)
			# Prepare configuration
			args = opts
			opts = {}

			# Extract the configuration from the arguments
			for arg in args
				continue  unless arg
				switch typeof arg
					when 'string'
						opts.name = arg
					when 'function'
						opts.method = arg
					when 'object'
						for own key,value of arg
							opts[key] = value

		# Apply the configuration directly to our instance
		for own key,value of opts
			switch key
				when 'next'
					@done(value)  if value
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

	# add method
	# for @internal use only, do not use externally
	addMethod: (method, config={}) ->
		method ?= @config.method.bind(@)
		method.isTaskGroupMethod = true
		config.args ?= [@addGroup.bind(@), @addTask.bind(@)]
		config.includeInResults ?= false
		return @addTask(method, config)

	fire: ->
		# Auto run if we are going the inline style and have no parent
		if @config.method
			# Add the function as our first unamed task with the extra arguments
			item = @addMethod()

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

		# Only add the item if it exists
		return null  unless item

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
		if args[0]?.type is 'task' # @TODO: should this even be a supported use case?
			task = args[0]
			task.setConfig(args.slice(1))
		else
			task = new Task(args...)
		return task

	addTask: (args...) ->
		return @addItem @createTask args...

	addTasks: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addTask(item, args...)  for item in items)


	createGroup: (args...) ->
		if args[0]?.type is 'taskgroup' # @TODO: should this even be a supported use case?
			taskgroup = args[0]
			taskgroup.setConfig(args.slice(1))
		else
			taskgroup = new TaskGroup(args...)
		return taskgroup

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

	shouldPause: ->
		return @config.pauseOnError and @err?

	isEmpty: ->
		return @hasItems() is false and @running is 0

	isDone: ->
		# Determine completion
		return @shouldPause() or @isEmpty()

	complete: ->
		completed = false

		# Continue with completion
		if @isDone() is true
			# Pause if desired
			@pause()  if @shouldPause() is true

			# Notify we've completed and send the error and results if we have them
			@emit('complete', @err, @results)

			# Reset the error and results to build up again for the next completion
			@err = null
			@results = []

			# Result
			completed = true

		# Return result
		return completed

	# Done
	# Listens to the complete event
	# But if we are already completed, then fire the complete event
	done: (handler) ->
		super
		queue =>
			@emit('complete', @err, @results)  if @isDone() is true
			@err = null
		@

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
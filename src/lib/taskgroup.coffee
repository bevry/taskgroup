###
@TODO

- Get it so if an error occurs, running tasks are waited for, and included in the results and completed tally
- Only report the first error, clear error upon completion
- Check promise-attempt1 for anything else
- Use eventemittergrouped for events

###

# Import
setImmediate = global?.setImmediate or process.nextTick  # node 0.8 b/c
queue = process.nextTick
ambi = require('ambi')
events = require('events')
domain = (try require('domain')) ? null
{EventEmitter} = events
{extendOnClass} = require('extendonclass')


# =====================================
# Interface
# Generic Interface with common methods used by both Task and TaskGroup

# Definition
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


# =====================================
# Task

# Events
# - complete
# - run
# - error
class Task extends Interface
	@extend: extendOnClass
	@create: (args...) -> return new @(args...)

	# Variables
	# for @internal use only, do not use externally
	type: 'task'  # for duck typing
	result: null  # array, [err, ...]
	status: null  # [null, 'started', 'running', 'completed', 'failed', 'destroyed']
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
		super

		# Prepare
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

	# Has Started
	hasStarted: ->
		return @status isnt null

	# Has Exited
	hasExited: ->
		return @status in ['completed', 'failed', 'destroyed']

	# Is Done
	isDone: ->
		return @hasExited() is true

	# Exit
	# The completion callback to use when the function completes normally, when it errors, and when whatever else unexpected happens
	exit: (args...) ->
		# Complete for the first (and hopefully only) time
		if @hasExited() is false
			# Apply the result if it exists
			if args.length isnt 0
				@result = args

			# Did we error?
			if @result?[0]?
				@status = 'failed'
			else
				@status = 'completed'

			# Notify our listeners of our completion
			@done()

		# Error as we have already completed before
		else
			err = new Error """
				The task [#{@getNames()}] just completed, but it had already completed earlier, this is unexpected.
				Completed with the arguments: #{args.toString()}
				"""
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
		# Ensure nothing hit here again
		@status = 'destroyed'

		# Remove all isteners
		# @TODO should we exit or dispose of the domain?
		@removeAllListeners()

		# Chain
		@

	# Fire
	# for @internal use only, do not use externally
	fire: ->
		# Prepare
		me = @

		# Add our completion callback to our specified arguments to send over to the method
		args = (@config.args or []).concat([@exit.bind(@)])

		# Prepare the task domain if it doesn't already exist
		if @taskDomain? is false and domain?.create?
			@taskDomain = domain.create()
			@taskDomain.on('error', @exit.bind(@))

		# Listen for uncaught errors
		fire = ->
			try
				if me.config.method?.bind
					methodToFire = me.config.method.bind(me.config.context or me)
					me.status = 'running'
					ambi(methodToFire, args...)
				else
					err = new Error """
						The task [#{me.getNames()}] was fired but has no method to fire
						"""
					throw err
			catch err
				me.exit(err)

		if @taskDomain?
			@taskDomain.run(fire)
		else
			fire()

		# Chain
		@

	# Run
	run: ->
		# Already completed?
		if @hasStarted() is true
			err = new Error """
				The task [#{@getNames()}] was just about to start, but it has already started earlier, this is unexpected.
				"""
			@exit(err)

		# Not yet completed, so lets run!
		else
			# Reset to a running state
			@status = 'started'

			# Notify our intention
			@emit('run')

			# Give time for the listeners in the above event to complete before continuing
			# This delay is needed for task groups
			# @TODO IS THIS NECESSARY?
			setImmediate(@fire.bind(@))

		# Chain
		@



# =====================================
# Task Group

# Events
# - complete
# - run
# - error
# - item.*
# - task.*
# - group.*
class TaskGroup extends Interface
	@extend: extendOnClass
	@create: (args...) -> return new @(args...)

	# Variables
	type: 'taskgroup'  # for duck typing
	remaining: null
	running: null
	completed: null
	results: null
	err: null
	status: null  # [null, 'started', 'running', 'completed', 'failed', 'destroyed']
	bubbleEvents: null

	# Config
	config: null
		###
		name: null
		method: null
		concurrency: 1  # use 0 for unlimited
		onError: 'exit'
		parent: null
		run: null
		###

	constructor: (args...) ->
		# Init
		me = @
		super
		@config ?= {}
		@config.name ?= "Task Group #{Math.random()}"
		@config.concurrency ?= 1
		@config.onError ?= 'exit'
		@remaining ?= []
		@running ?= []
		@completed ?= []
		@results ?= []
		@bubbleEvents ?= []
		@bubbleEvents.push('complete', 'run', 'error')

		# Apply configuration
		@setConfig(args)

		# Give setConfig enough chance to fire
		# Changing this to setImmediate breaks a lot of things
		# As tasks inside nested taskgroups will fire in any order
		queue(@fireMethod.bind(@))

		# Handle item completion
		@on('item.complete', @itemCompletionCallback.bind(@))

		# Handle item error
		@on('item.error', @itemUncaughtExceptionCallback.bind(@))

		# Chain
		@



	# ---------------------------------
	# Configuration

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


	# ---------------------------------
	# TaskGroup Method

	# add method
	# for @internal use only, do not use externally
	addMethod: (method, config={}) ->
		method ?= @config.method.bind(@)
		method.isTaskGroupMethod = true
		config.name ?= 'taskgroup method for '+@getName()
		config.args ?= [@addGroup.bind(@), @addTask.bind(@)]
		config.includeInResults ?= false
		return @addTask(method, config)

	# for @internal use only, do not use externally
	fireMethod: ->
		# Auto run if we are going the inline style and have no parent
		if @config.method
			# Add the function as our first unamed task with the extra arguments
			item = @addMethod()

			# If we are the topmost group
			if @config.parent? is false
				# then run if possible
				@config.run ?= true

		# Auto run if we are configured to
		@run()  if @config.run is true

		# Chain
		@


	# ---------------------------------
	# Add Item

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

		# We may be running and expecting items, if so, fire
		@fire()

		# Return the item
		return item

	addItems: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addItem(item, args...)  for item in items)


	# ---------------------------------
	# Add Task

	createTask: (args...) ->
		defaultConfig =
			name: 'task '+(@getItemsTotal()+1)+' for '+@getName()
		if args[0]?.type is 'task' # @TODO: should this even be a supported use case?
			task = args[0]
			task.setConfig(defaultConfig, args.slice(1)...)
		else
			task = new Task(defaultConfig, args...)
		return task

	addTask: (args...) ->
		return @addItem @createTask args...

	addTasks: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addTask(item, args...)  for item in items)


	# ---------------------------------
	# Add Group

	createGroup: (args...) ->
		defaultConfig =
			name: 'task group '+(@getItemsTotal()+1)+' for '+@getName()
		if args[0]?.type is 'taskgroup' # @TODO: should this even be a supported use case?
			taskgroup = args[0]
			taskgroup.setConfig(defaultConfig, args.slice(1)...)
		else
			taskgroup = new TaskGroup(defaultConfig, args...)
		return taskgroup

	addGroup: (args...) ->
		return @addItem @createGroup args...

	addGroups: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addGroup(item, args...)  for item in items)


	# ---------------------------------
	# Status Indicators

	getItemNames: ->
		running = @running.map (item) -> item.getName()
		remaining = @remaining.map (item) -> item.getName()
		completed = @completed.map (item) -> item.getName()
		results = @results.length
		total = running.length + remaining.length + completed.length
		return {
			remaining
			running
			completed
			total
			results
		}

	getItemsTotal: ->
		running = @running.length
		remaining = @remaining.length
		completed = @completed.length
		total = running + remaining + completed
		return total

	getItemTotals: ->
		running = @running.length
		remaining = @remaining.length
		completed = @completed.length
		results = @results.length
		total = running + remaining + completed
		return {
			remaining
			running
			completed
			total
			results
		}

	hasRunning: ->
		return @running.length isnt 0

	hasRemaining: ->
		return @remaining.length isnt 0

	hasItems: ->
		return @hasRunning() is true or @hasRemaining() is true

	hasStarted: ->
		return @status isnt null

	hasExited: ->
		return @status in ['completed', 'failed', 'destroyed']

	hasSlots: ->
		return (
			@config.concurrency is 0 or
			@running.length < @config.concurrency
		)

	shouldPause: ->
		return (
			@config.onError is 'exit' and
			@err? is true
		)

	shouldFire: ->
		return (
			@shouldPause() is false and
			@hasRemaining() is true and
			@hasSlots() is true
		)

	isEmpty: ->
		return @hasItems() is false

	isPaused: ->
		return (
			@shouldPause() is true and
			@hasRunning() is false
		)

	isDone: ->
		return (
			@isPaused() is true or
			@isEmpty() is true
		)


	# ---------------------------------
	# Firers

	# Done
	# Listens to the complete event
	# But if we are already completed, then fire the complete event
	done: (handler) ->
		super
		queue =>
			if @isDone() is true
				@emit('complete', @err, @results)
				@err = null
				@results = []  # TODO: should we do this?
		@

	# Fire the next items
	# returns the items that were fired
	# or returns false if no items were fired
	# for @internal use only, do not use externally
	fireNextItems: ->
		items = []

		# Fire the next items
		debugger
		while true
			item = @fireNextItem()
			if item
				items.push(item)
			else
				break

		result =
			if items.length isnt 0
				items
			else
				false

		return result

	# Fire the next item
	# returns the item that was fired
	# or returns false if no item was fired
	# for @internal use only, do not use externally
	fireNextItem: ->
		# Prepare
		result = false
		fire = @shouldFire() is true

		# Can we run the next item?
		if fire
			# Fire the next item
			@status = 'running'

			# Get the next item and remove it from the remaining items
			item = @remaining.shift()
			@running.push(item)

			# Run it
			item.run()

			# Return the item
			result = item

		# Return
		return result

	# What to do when an item completes
	# for @internal use only, do not use externally
	itemCompletionCallback: (item, args...) ->
		# Update error if it exists
		@err ?= args[0]  if args[0]

		# Mark that one less item is running
		index = @running.indexOf(item)
		if index is -1
			@err ?= new Error("Could not find [#{item.getNames()}] in the running queue")
		else
			@running = @running.slice(0, index).concat(@running.slice(index+1))

		# Add to the completed queue
		@completed.push(item)

		# Add the result
		@results.push(args)  if item.config.includeInResults isnt false

		# Fire
		@fire()

		# Chain
		@

	# What to do when an item completes
	# for @internal use only, do not use externally
	itemUncaughtExceptionCallback: (item, err) ->
		# Stop further execution and exit with the error
		@exit(err)

		# Chain
		@

	# Fire
	# for @internal use only, do not use externally
	fire: ->
		# Have we actually started?
		if @hasStarted() is true
			# Check if we are paused due to failure
			if @shouldPause() is true
				# paused true, running false
				# exit if we are the last running item
				if @hasRunning() is false
					@exit()

				# paused true, running false
				# wait for running items to complete

			# We are not paused
			else
				# paused false, empty true
				# exit as we are the last item left that has now finally completed
				if @isEmpty() is true
					@exit()

				# paused false, empty false
				# fire the next items
				else
					@fireNextItems()

		# Chain
		@

	# Clear remaning items
	clear: ->
		# Destroy all the items
		remaining = @remaining
		@remaining = []
		item.destroy()  for item in remaining

		# Chain
		@

	# Destroy all remaining items and remove listeners
	destroy: ->
		# Stop further execution
		@status = 'destroyed'

		# Destroy all the items
		@clear()

		# Remove listeners
		@removeAllListeners()

		# Chain
		@


	exit: (err) ->
		# Update error if set
		@err ?= err  if err? is true

		# Update the status
		@status =
			if @err? is true
				'failed'
			else
				'completed'

		# Fire the completion callback
		@done()

		# Chain
		@

	run: (args...) ->
		# Start
		@status = 'started'

		# Notify our intention to run
		@emit('run')

		# Give time for the listeners to complete before continuing
		queue @fire.bind(@)

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
###
@TODO

- Use eventemittergrouped for events

###

# Import
setImmediate = global?.setImmediate or process.nextTick  # node 0.8 b/c
queue = process.nextTick
ambi = require('ambi')
events = require('events')
domain = (try require('domain')) ? null
util = require('util')
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

	# Complete emitter
	complete: ->
		err = throw Error('interface should provide this')
		@emit('error', err)
		@

	# Completed listener
	completed: (handler) ->
		@on('error', handler.bind(@)).on('complete', handler.bind(@))
		@

	# Done listener
	done: (handler) ->
		# Prepare
		me = @

		# ensure the passed done handler is ever only fired once and once only regardless of which event fires
		wrappedHandler = (args...) ->
			# remove our wrapped handler instance so we don't ever fire it again
			me
				.removeListener('error', wrappedHandler)
				.removeListener('complete', wrappedHandler)

			# fire the original handler as expected
			handler.apply(me, args)

		# ensure the done handler is ever only fired once and once only regardless of which event fires
		@on('error', wrappedHandler).on('complete', wrappedHandler)

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
	err: null
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
	isComplete: ->
		return @hasExited()

	# Exit
	# The completion callback to use when the function completes normally, when it errors, and when whatever else unexpected happens
	exit: (args...) ->
		# Store the first error
		@err ?= args[0]  if args[0]?
		
		# Complete for the first (and hopefully only) time
		if @hasExited() is false
			# Apply the result if it exists
			if args.length isnt 0
				@result = args

			# Did we error?
			if @err?
				@status = 'failed'
			else
				@status = 'completed'

			# Notify our listeners of our completion
			@complete()

		# Error as we have already completed before
		else
			err = new Error """
				The task [#{@getNames()}] just completed, but it had already completed earlier, this is unexpected. Results of earlier execution are:
				#{util.inspect({error:@err, arguments:args})}
				"""
			@emit('error', err)

		# Chain
		@

	# Complete Emitter
	# for @internal use only, do not use externally
	complete: ->
		complete = @isComplete()

		if complete
			@emit.apply(@, ['complete'].concat @result or [])

			# Prevent the error from persisting
			@err = null

			# Should we reset results?
			# @results = []
			# no, it would break the promise nature of done
			# as it would mean that if multiple done handlers are added, they would each get different results
			# if they wish to reset the results, they should do so manually via resetResults

			# Should we reset the status?
			# @status = null
			# no, it would break the promise nature of done
			# as it would mean that once a done is fired, no more can be fired, until run is called again

		return complete

	# Completed Promise
	completed: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.apply(@, @result or [])
		else
			super(handler)
		@

	# Done Promise
	done: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.apply(@, @result or [])
		else
			super(handler)
		@

	# Reset the results
	resetResults: ->
		@result = []
		@

	# Destroy
	destroy: ->
		@done =>
			# Ensure nothing hit here again
			@status = 'destroyed'

			# Clear results
			@resetResults()
			# item arrays should already be wiped due to done completion

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
		
		# Check that we have a method to fire
		if me.config.method? is false
			err = new Error """
				The task [#{me.getNames()}] failed to run as no method was defined for it.
				"""
			me.exit(err)
			return @
		
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
		if @hasStarted()
			err = new Error """
				The task [#{@getNames()}] was just about to start, but it already started earlier, this is unexpected.
				"""
			queue => @exit(err)

		# Not yet completed, so lets run!
		else
			# Reset to a running state
			@status = 'started'

			# Notify our intention
			@emit('run')
			
			# Start
			queue => @fire()

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
	itemsRemaining: null
	itemsRunning: null
	itemsCompleted: null
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
		@itemsRemaining ?= []
		@itemsRunning ?= []
		@itemsCompleted ?= []
		@results ?= []
		@bubbleEvents ?= []
		@bubbleEvents.push('complete', 'run', 'error')

		# Apply configuration
		@setConfig(args)

		# Give setConfig enough chance to fire
		# Changing this to setImmediate breaks a lot of things
		# As tasks inside nested taskgroups will fire in any order
		queue(@fireMethod.bind(@))

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
	# for @internal use only, do not use externally
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

		# Handle item completion and errors once
		item.done (args...) ->
			me.itemCompletionCallback(item, args...)

		# Add the item
		@itemsRemaining.push(item)

		# We may be running and expecting items, if so, fire
		@fire()

		# Return the item
		return item

	# for @internal use only, do not use externally
	addItems: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addItem(item, args...)  for item in items)


	# ---------------------------------
	# Add Task

	createTask: (args...) ->
		defaultConfig =
			name: 'task '+(@getItemsTotal()+1)+' for '+@getName()

		# Support receiving an existing task instance
		if args[0]?.type is 'task'
			task = args[0]
			task.setConfig(defaultConfig, args.slice(1)...)

		# Support receiving arguments to create a task instance
		else
			task = new Task(defaultConfig, args...)

		# Return the new task
		return task

	addTask: (args...) ->
		task = @addItem @createTask args...
		
		# Chain
		@

	addTasks: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		tasks = (@addTask(item, args...)  for item in items)
		
		# Chain
		@


	# ---------------------------------
	# Add Group

	createGroup: (args...) ->
		defaultConfig =
			name: 'task group '+(@getItemsTotal()+1)+' for '+@getName()

		# Support recieving an existing taskgroup instance
		if args[0]?.type is 'taskgroup'
			taskgroup = args[0]
			taskgroup.setConfig(defaultConfig, args.slice(1)...)

		# Support receiving arugments to create a taskgroup intance
		else
			taskgroup = new TaskGroup(defaultConfig, args...)

		# Return the taskgroup instance
		return taskgroup

	addGroup: (args...) ->
		group = @addItem @createGroup args...
		
		# Chain
		@

	addGroups: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		groups = (@addGroup(item, args...)  for item in items)
		
		# Chain
		@


	# ---------------------------------
	# Status Indicators

	getItemNames: ->
		running = @itemsRunning.map (item) -> item.getName()
		remaining = @itemsRemaining.map (item) -> item.getName()
		completed = @itemsCompleted.map (item) -> item.getName()
		results = @results
		total = running.length + remaining.length + completed.length
		return {
			remaining
			running
			completed
			total
			results
		}

	getItemsTotal: ->
		running = @itemsRunning.length
		remaining = @itemsRemaining.length
		completed = @itemsCompleted.length
		total = running + remaining + completed
		return total

	getItemTotals: ->
		running = @itemsRunning.length
		remaining = @itemsRemaining.length
		completed = @itemsCompleted.length
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
		return @itemsRunning.length isnt 0

	hasRemaining: ->
		return @itemsRemaining.length isnt 0

	hasItems: ->
		return @hasRunning() or @hasRemaining()

	hasStarted: ->
		return @status isnt null

	hasExited: ->
		return @status in ['completed', 'failed', 'destroyed']

	hasResult: ->
		return @err? or @results.length isnt 0

	hasSlots: ->
		return (
			@config.concurrency is 0 or
			@itemsRunning.length < @config.concurrency
		)

	shouldPause: ->
		return (
			@config.onError is 'exit' and
			@err?
		)

	shouldFire: ->
		return (
			@shouldPause() is false and
			@hasRemaining() and
			@hasSlots()
		)

	isEmpty: ->
		return @hasItems() is false

	isPaused: ->
		return (
			@shouldPause() and
			@hasRunning() is false
		)

	isComplete: ->
		return (
			@hasStarted() and
			(
				@isPaused() or
				@isEmpty()
			)
		)


	# ---------------------------------
	# Firers

	# Complete
	complete: (handler) ->
		complete = @isComplete()

		if complete
			@emit.call(@, 'complete', @err, @results)
			
			# Prevent the error from persisting
			@err = null

			###
			This should be here, but it currently causes failing tests
			@TODO look into why
			###
			# Cleanup the items that will now go unused
			for item in @itemsCompleted
				item.destroy()
			@itemsCompleted = []

			# Should we reset results?
			# @results = []
			# no, it would break the promise nature of done
			# as it would mean that if multiple done handlers are added, they would each get different results
			# if they wish to reset the results, they should do so manually via resetResults

			# Should we reset the status?
			# @status = null
			# no, it would break the promise nature of done
			# as it would mean that once a done is fired, no more can be fired, until run is called again

		return complete

	# Completed Promise
	completed: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.call(@, @err, @results)
		else
			super(handler)
		@

	# Done Promise
	done: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.call(@, @err, @results)
		else
			super(handler)
		@

	# Reset the results
	resetResults: ->
		@results = []
		@

	# Fire the next items
	# returns the items that were fired
	# or returns false if no items were fired
	# for @internal use only, do not use externally
	fireNextItems: ->
		items = []

		# Fire the next items
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
		fire = @shouldFire()

		# Can we run the next item?
		if fire
			# Fire the next item
			@status = 'running'

			# Get the next item and remove it from the remaining items
			item = @itemsRemaining.shift()
			@itemsRunning.push(item)

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
		index = @itemsRunning.indexOf(item)
		if index is -1
			@err ?= indexError = new Error("Could not find [#{item.getNames()}] in the running queue")
			console.log(indexError.message)
		else
			@itemsRunning = @itemsRunning.slice(0, index).concat(@itemsRunning.slice(index+1))

		# Add to the completed queue
		@itemsCompleted.push(item)

		# Add the result
		@results.push(args)  if item.config.includeInResults isnt false

		# Fire
		@fire()

		# Chain
		@

	# Fire
	# for @internal use only, do not use externally
	fire: ->
		# Have we actually started?
		if @hasStarted()
			# Check if we are complete, if so, exit
			if @isComplete()
				@exit()

			# Otherwise continue firing items if we are wanting to pause
			else if @shouldPause() is false
				@fireNextItems()

		# Chain
		@

	# Clear remaning items
	clear: ->
		# Destroy all the items
		for item in @itemsRemaining
			item.destroy()
		@itemsRemaining = []

		# Chain
		@

	# Destroy all remaining items and remove listeners
	destroy: ->
		# Destroy all the items
		@clear()

		# Once finished, destroy it
		@done =>
			# Stop from executing ever again
			@status = 'destroyed'

			# Clear results
			@resetResults()
			# item arrays should already be wiped due to done completion

			# Remove listeners
			@removeAllListeners()

		# Chain
		@


	# We now want to exit
	exit: (err) ->
		# Update error if set
		@err ?= err  if err?

		# Update the status
		@status =
			if @err?
				'failed'
			else
				'completed'

		# Fire the completion callback
		@complete()

		# Chain
		@

	# We want to run
	run: (args...) ->
		# Start
		@status = 'started'

		# Notify our intention to run
		@emit('run')

		# Give time for the listeners to complete before continuing
		queue(@fire.bind(@))

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
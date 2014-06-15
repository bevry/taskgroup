# Import
setImmediate = global?.setImmediate or process.nextTick  # node 0.8 b/c
queue = process.nextTick
ambi = require('ambi')
events = require('events')
domain = (try require('domain')) ? null
util = require('util')
{EventEmitter} = require('events')
{extendOnClass} = require('extendonclass')


# =====================================
# Interface

# Internal: Base class containing common functionality for {Task} and {TaskGroup}.
class Interface extends EventEmitter

	# Adds support for the done event while
	# ensuring that errors are always handled correctly.
	#
	# It does this by listening to the `error` and `completed` events,
	# and when the emit, we check if there is a `done` listener:
	# - if there is, then emit the done event with the original event arguments
	# - if there isn't, then output the error to stderr and throw it.
	constructor: ->
		super
		me = @

		# Add support for the done event
		# If we do have an error, then throw it if there is no existing or done listeners
		@on 'error', (args...) ->
			err = args[0]
			if me.listeners('done').length isnt 0  # has done listener, forward to that
				@emit('done', args...)
			else if err and me.listeners('error').length is 1  # has error, but no done listener and no event listener, throw err
				# this isn't good enough, throw the error
				console.error(err.stack or err)
				throw err

		@on 'completed', (args...) ->
			err = args[0]
			if me.listeners('done').length isnt 0  # has done listener, forward to that
				@emit('done', args...)
			else if err and me.listeners('completed').length is 1  # has error, but no done listener and no event listener, throw err
				# this isn't good enough, throw the error
				console.error(err.stack or err)
				throw err

		# Chain
		@

	# Internal: Fire our completion event.
	complete: ->
		err = throw Error('interface should provide this')
		@emit('error', err)
		@

	# Public: Attaches the listener to the `done` event to be emitted each time.
	#
	# listener - The {Function} to attach to the `done` event.
	whenDone: (listener) ->
		# check if we have a listener
		if typeof listener is 'function'
			@on('done', listener.bind(@))

		# Chain
		@

	# Public: Attaches the listener to the `done` event to be emitted only once, then removed to not fire again.
	#
	# listener - The {Function} to attach to the `done` event.
	onceDone: (listener) ->
		# check if we have a listener
		if typeof listener is 'function'
			@once('done', listener)

		# Chain
		@

	# Public: Alias for {::onceDone}
	done: (args...) ->
		return @onceDone(args...)

	# Public: Get our name with all of our parent names into a {String} or {Array}.
	#
	# opts - The options
	#        :format - (default: 'string') A {String} that determines the format that we return, when `string` it will output a string of all our names, when `array` it will return the names as an array
	#        :seperator - (default: ' ➞  ') A {String} that is used to join our array when returning a joined {String}
	#
	# Returns either a joined {String} or an {Array} based on the value of the `format` option.
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

	# Public: Get the name of our instance.
	#
	# If the name was never configured, then return the name in the format of
	# `'#{@type} #{Math.random()}'` to output something like `task 0.2123`
	#
	# Returns the configured name {String}.
	getName: ->
		return @config.name ?= "#{@type} #{Math.random()}"

	# Public: Get the configuration of our instance.
	#
	# Returns our configuration {Object} directly.
	getConfig: -> @config


# =====================================

# Public: Our Task Class.
class Task extends Interface
	# Internal: The type of our class for the purpose of duck typing
	# which is needed when working with node virtual machines
	# as instanceof will not work in those environments.
	type: 'task'

	# Public: A helper method to check if the passed argument is an instanceof
	# a {Task}.
	#
	# item - The possible instance of the {Task} that we want to check
	#
	# Returns a {Boolean} of whether or not the item is a {Task} instance.
	@isTask: (item) -> return item?.type is 'task' or item instanceof Task

	# Public: A helper method to create a new subclass with our extensions.
	#
	# extensions - An {Object} of extensions to apply to the new subclass
	#
	# Returns the new sub {Class};
	@subclass: extendOnClass

	# Public: Creates a {Task} instance via our constructor {::constructor}.
	#
	# Returns our new {Task} instance.
	@create: (args...) -> return new @(args...)

	# Internal: The first {Error} that has occured.
	err: null

	# Internal: An {Array} of the result arguments of our method.
	# The first item in the array should be the {Error} if it exists.
	result: null

	# Internal: A {String} containing our current status.
	#
	# Valid values are: null, 'started', 'running', 'failed', 'passed', 'destroyed'
	status: null

	# Internal: An {Array} of the events that we may emit.
	#
	# Our {::constructor} sets this to:
	# ['done', 'error', 'started', 'running', 'failed', 'passed', 'completed', 'destroyed']
	events: null

	# Internal: The {Domain} that we create to capture errors for our method.
	taskDomain: null

	# Internal: The configuration for our {Task} instance. See {::setConfig} for details.
	config: null

	# Public: Creates a new task. Forwards arguments onto {::setConfig}.
	constructor: (args...) ->
		super

		# Prepare
		@config ?= {}
		@config.run ?= false
		@config.onError ?= 'exit'
		@events ?= []
		@events.push('error', 'started', 'running', 'failed', 'passed', 'completed', 'destroyed')

		# Apply configuration
		@setConfig(args)

		# Chain
		@

	# Public: Set the configuration for our instance.
	#
	# Despite accepting an {Object} of configuration, we can also accept an {Array} of configuration.
	# When using an array, a {String} becomes the :name, a {Function} becoes the :method, and an {Object} becomes the :config
	#
	# config - Our configuration {Object} can contain the following fields:
	#   :name - (default: null) A {String} for what we would like our name to be, useful for debugging.
	#   :method - (default: null) The {Function} that we would like to execute within our task.
	#   :args - (default: null) An {Array} of arguments that we would like to forward onto our method when we execute it.
	#   :parent - (default: null) A parent {TaskGroup} that we may be attached to.
	#   :timeout - (default: null) A {Number} of millesconds that we would like to wait before timing out the method.
	#   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` duplicate run errors are not reported, useful when combined with the timeout option.
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

	# Public: Has the task started execution yet?
	#
	# Returns a {Boolean}
	hasStarted: ->
		return @status isnt null

	# Public: Has the task finished its execution yet?
	#
	# Returns a {Boolean}
	hasExited: ->
		return @status in ['completed', 'destroyed']

	# Public: Has the task completed its execution yet?
	#
	# Returns a {Boolean}
	isComplete: ->
		return @status in ['failed', 'passed', 'destroyed']

	# Internal: Handles the completion and error conditions for our task.
	#
	# Should only ever execute once, if it executes more than once, then we error.
	#
	# args... - The arguments array that will be applied to the {::result} variable. First argument is the {Error} if it exists.
	exit: (args...) ->
		# Store the first error
		@err ?= args[0]  if args[0]?

		# Complete for the first (and hopefully only) time
		if @isComplete() is false
			# Apply the result if it exists
			if args.length isnt 0
				@result = args

			# Did we error?
			if @err?
				@status = 'failed'
			else
				@status = 'passed'

			# Notify our listeners of our status
			@emit(@status, @err)

			# Finish up
			@complete()

		# Error as we have already completed before
		else if @config.onError isnt 'ignore'
			err = new Error """
				The task [#{@getNames()}] just completed, but it had already completed earlier, this is unexpected. State information is:
				#{util.inspect({error:@err, previousResult:@result, currentArguments:args})}
				"""
			@emit('error', err)

		# Chain
		@

	# Internal: Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	complete: ->
		complete = @isComplete()

		if complete
			# Notify our listeners we have completed
			@emit 'completed', (@result or [])...

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

	# Public: When Done Promise.
	whenDone: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.apply(@, @result or [])
		else
			super(handler)
		@

	# Public: Once Done Promise.
	onceDone: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.apply(@, @result or [])
		else
			super(handler)
		@

	# Internal: Reset the results.
	resetResults: ->
		@result = []
		@

	# Public: Destroy.
	destroy: ->
		@done =>
			# Ensure nothing hit here again
			@status = 'destroyed'

			# Notify our listeners we are now destroyed
			@emit(@status)

			# Clear results
			@resetResults()
			# item arrays should already be wiped due to done completion

			# Remove all isteners
			# @TODO should we exit or dispose of the domain?
			@removeAllListeners()

		# Chain
		@

	# Internal: Fire.
	fire: ->
		# Prepare
		me = @

		# Check that we have a method to fire
		if me.config.method? is false
			err = new Error """
				The task [#{me.getNames()}] failed to run as no method was defined for it.
				"""
			me.emit('error', err)
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
					methodToFire = me.config.method.bind(me)
					me.status = 'running'
					me.emit(me.status)
					me.timeout = setTimeout(->
						if me.isComplete() is false
							err = new Error """
								The task [#{me.getNames()}] has timed out.
								"""
							me.exit(err)
					, me.config.timeout)  if me.config.timeout
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

	# Public: Run.
	run: ->
		queue =>
			# Already completed?
			if @hasStarted()
				err = new Error """
					The task [#{@getNames()}] was just about to start, but it already started earlier, this is unexpected.
					"""
				@emit('error', err)

			# Not yet completed, so lets run!
			else
				# Reset to a running state
				@status = 'started'

				# Notify our listeners of our updated status
				@emit(@status)

				# Fire the task
				@fire()

		# Chain
		@



# =====================================
# Task Group

class TaskGroup extends Interface
	type: 'taskgroup'  # for duck typing
	@extend: extendOnClass
	@create: (args...) -> return new @(args...)
	@isTaskGroup: (group) -> return group?.type is 'taskgroup' or group instanceof TaskGroup

	# Variables
	itemsRemaining: null
	itemsRunning: null
	itemsCompleted: null
	results: null
	err: null
	status: null  # [null, 'started', 'running', 'passed', 'failed', 'destroyed']
	events: null  # ['done', 'error', 'started', 'running', 'passed', 'failed', 'completed', 'destroyed', 'item.*', 'group.*', 'task.*']

	# Config
	config: null
		###
		name: null
		method: null
		concurrency: 1  # use 0 for unlimited
		onError: 'exit'  # ['exit', 'ignore']
		parent: null
		run: null
		nestedConfig: null  # configuration to add to child items
		###

	constructor: (args...) ->
		# Init
		me = @
		super
		@config ?= {}
		@config.concurrency ?= 1
		@config.onError ?= 'exit'
		@itemsRemaining ?= []
		@itemsRunning ?= []
		@itemsCompleted ?= []
		@results ?= []
		@events ?= []
		@events.push('error', 'started', 'running', 'passed', 'failed', 'completed', 'destroyed')

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

	# Set Nested Task Config
	setNestedTaskConfig: (config={}) ->
		@config.nestedTaskConfig ?= {}
		for own key,value of config
			@config.nestedTaskConfig[key] = value
		@

	# Set Nested Config
	setNestedConfig: (config={}) ->
		@setConfig(config)
		@config.nestedConfig ?= {}
		for own key,value of config
			@config.nestedConfig[key] = value
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
		if @config.run is true
			@run()

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
		item.config.name ?= "#{item.type} #{@getItemsTotal()+1} for #{@getName()}"

		# Bubble task events
		if Task.isTask(item)
			# Nested configuration
			item.setConfig(@config.nestedConfig)  if @config.nestedConfig?
			item.setConfig(@config.nestedTaskConfig)  if @config.nestedTaskConfig?

			item.events.forEach (event) ->
				item.on event, (args...) ->
					me.emit("task.#{event}", item, args...)

			# Notify our intention
			@emit('task.add', item)

		# Bubble group events
		else if TaskGroup.isTaskGroup(item)
			# Nested configuration
			item.setNestedConfig(@config.nestedConfig)  if @config.nestedConfig?
			item.setConfig(nestedTaskConfig: @config.nestedTaskConfig)  if @config.nestedTaskConfig?

			# Bubble item events
			item.events.forEach (event) ->
				item.on event, (args...) ->
					me.emit("group.#{event}", item, args...)

			# Notify our intention
			@emit('group.add', item)

		# Bubble item events
		item.events.forEach (event) ->
			item.on event, (args...) ->
				me.emit("item.#{event}", item, args...)

		###
		# Bubble item error event directly
		item.on 'error', (args...) ->
			me.emit('error', args...)
		###

		# Notify our intention
		@emit('item.add', item)

		# Handle item completion and errors once
		# we can't just do item.done, or item.once('done'), because we need the item to be the argument, rather than `this`
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
		# Support receiving an existing task instance
		if Task.isTask(args[0])
			task = args[0]
			task.setConfig(args.slice(1)...)

		# Support receiving arguments to create a task instance
		else
			task = new Task(args...)

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
		# Support recieving an existing taskgroup instance
		if TaskGroup.isTaskGroup(args[0])
			taskgroup = args[0]
			taskgroup.setConfig(args.slice(1)...)

		# Support receiving arugments to create a taskgroup intance
		else
			taskgroup = new TaskGroup(args...)

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

	hasResult: ->
		return @err? or @results.length isnt 0

	hasExited: ->
		return @status in ['completed', 'destroyed']

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
			# Notity our listners we have completed
			@emit('completed', @err, @results)

			# Prevent the error from persisting
			@err = null

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

	# When Done Promise
	whenDone: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.call(@, @err, @results)
		else
			super(handler)
		@

	# Once Done Promise
	onceDone: (handler) ->
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

			# Update our status
			@status = 'running'

			# and notify our listeners of it
			@emit(@status)

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
		@err ?= args[0]  if @config.onError is 'exit' and args[0]

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

			# And notify our listeners
			@emit(@status)

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
				'passed'

		# Notify our listeners
		@emit(@status, @err)

		# Fire the completion callback
		@complete()

		# Chain
		@

	# We want to run
	run: (args...) ->
		queue =>
			# Start
			@status = 'started'

			# Notify our intention to run
			@emit(@status)

			# Give time for the listeners to complete before continuing
			queue(@fire.bind(@))

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
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
#
# Available configuration is documented in {::setConfig}.
#
# Available events:
# - `started()` - emitted when we start execution
# - `running()` - emitted when the method starts execution
# - `failed(err)` - emitted when execution exited with a failure
# - `passed()` - emitted when execution exited with a success
# - `completed(err, args...)` - emitted when execution exited, `args` are the result arguments from the method
# - `error(err)` - emtited if an unexpected error occurs without ourself
# - `done(err, args...)` - emitted when either execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
#
# Available internal statuses:
# - `null` - execution has not yet started
# - `'started'` - execution has begun
# - `'running'` - execution of our method has begun
# - `'failed'` - execution of our method has failed
# - `'passed'` - execution of our method has succeeded
# - `'destroyed'` - we've been destroyed and can no longer execute
#
# Examples
#
#  task = require('taskgroup').Task.create('my synchronous task', function(){
#    return 5
#  }).done(console.log)  // [null, 5]
#
#  task = require('taskgroup').Task.create('my asynchronous task', function(complete){
#    complete(null, 5)
#  }).done(console.log)  // [null, 5]
#
#  task = require('taskgroup').Task.create('my task that errors', function(){
#    var err = new Error('deliberate error')
#    return err;  // if asynchronous, can also do: complete(err)
#    // thrown and uncaught errors are also caught thanks to domains, but that should be avoided
#    // as it would put your app in an unknown state
#  }).done(console.log)  // [Error('deliberator error')]
class Task extends Interface
	# Internal: The type of our class for the purpose of duck typing
	# which is needed when working with node virtual machines
	# as instanceof will not work in those environments.
	type: 'task'

	# Public: A helper method to check if the passed argument is an instanceof a {Task}.
	#
	# item - The possible instance of the {Task} that we want to check
	#
	# Returns a {Boolean} of whether or not the item is a {Task} instance.
	@isTask: (item) -> return item?.type is 'task' or item instanceof Task

	# Public: A helper method to create a new subclass with our extensions.
	#
	# extensions - An {Object} of extensions to apply to the new subclass
	#
	# Returns the new sub {Class}
	@subclass: extendOnClass

	# Public: Creates a new {Task} instance.
	#
	# args - The {Arguments} to forwarded along to the {::constructor}.
	#
	# Returns the new {Task} instance.
	@create: (args...) -> return new @(args...)

	# Internal: The first {Error} that has occured.
	err: null

	# Internal: An {Array} of the result arguments of our method.
	# The first item in the array should be the {Error} if it exists.
	result: null

	# Internal: A {String} containing our current status. See our {Task} description for available values.
	status: null

	# Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	events: null

	# Internal: The {Domain} that we create to capture errors for our method.
	taskDomain: null

	# Internal: The configuration for our {Task} instance. See {::setConfig} for available configuration.
	config: null

	# Public: Initialize our new {Task} instance. Forwards arguments onto {::setConfig}.
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
	# When using an array, a {String} becomes the :name, a {Function} becomes the :method, and an {Object} becomes the :config
	#
	# config - Our configuration {Object} can contain the following fields:
	#   :name - (default: null) A {String} for what we would like our name to be, useful for debugging.
	#   :next - (defualt: null) A {Function} that we would like bound to the `done` event once.
	#   :method - (default: null) The {Function} that we would like to execute within our task.
	#   :parent - (default: null) A parent {TaskGroup} that we may be attached to.
	#   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` duplicate run errors are not reported, useful when combined with the timeout option.
	#   :args - (default: null) An {Array} of arguments that we would like to forward onto our method when we execute it.
	#   :timeout - (default: null) A {Number} of millesconds that we would like to wait before timing out the method.
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

	# Public: Have we started execution yet?
	#
	# Returns a {Boolean} which is `true` if we have commenced execution
	hasStarted: ->
		return @status isnt null

	# Public: Have we finished its execution yet?
	#
	# Returns a {Boolean} which is `true` if we have finished execution
	hasExited: ->
		return @status in ['completed', 'destroyed']

	# Public: Have we been destroyed?
	#
	# Returns a {Boolean} which is `true` if we have bene destroyed
	isDestroyed: ->
		return @status is 'destroyed'

	# Public: Have we completed its execution yet?
	#
	# Returns a {Boolean} which is `true` if we have completed
	isComplete: ->
		return @status in ['failed', 'passed', 'destroyed']

	# Internal: Handles the completion and error conditions for ourself.
	#
	# Should only ever execute once, if it executes more than once, then we error.
	#
	# args - The arguments {Array} that will be applied to the {::result} variable. First argument is the {Error} if it exists.
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
			# as it would mean that if multiple done listener are added, they would each get different results
			# if they wish to reset the results, they should do so manually via resetResults

			# Should we reset the status?
			# @status = null
			# no, it would break the promise nature of done
			# as it would mean that once a done is fired, no more can be fired, until run is called again

		return complete

	# Public: When Done Promise.
	# Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	#
	# listener - The {Function} to attach or execute.
	whenDone: (listener) ->
		if @isComplete()
			queue =>  # avoid zalgo
				listener.apply(@, @result or [])
		else
			super(listener)
		@

	# Public: Once Done Promise.
	# Fires the listener once, either on the next tick if we are already done, or if not, once the `done` event fires.
	#
	# listener - The {Function} to attach or execute.
	onceDone: (listener) ->
		if @isComplete()
			queue =>  # avoid zalgo
				listener.apply(@, @result or [])
		else
			super(listener)
		@

	# Internal: Reset the results.
	#
	# At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults: ->
		@result = []
		@

	# Public: Destroy the task and prevent it from executing ever again.
	destroy: ->
		@done =>
			# Are we already destroyed?
			return  if @status is 'destroyed'

			# Update our status and notify our listeners
			@emit(@status = 'destroyed')

			# Clear results
			@resetResults()
			# item arrays should already be wiped due to done completion

			# Remove all isteners
			# @TODO should we exit or dispose of the domain?
			@removeAllListeners()

		# Chain
		@

	# Internal: Fire the task method with our config arguments and wrapped in a domain.
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

	# Public: Start the execution of the task.
	#
	# Will emit an `error` event if the task has already started before.
	run: ->
		queue =>
			# Already completed or even destroyed?
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

# Public: Our TaskGroup class.
#
# Available configuration is documented in {::setConfig}.
#
# Available events:
# - `started()` - emitted when we start execution
# - `running()` - emitted when the first item starts execution
# - `failed(err)` - emitted when execution exited with a failure
# - `passed()` - emitted when execution exited with a success
# - `completed(err, results)` - emitted when execution exited, `results` is an {Array} of the result arguments for each item that executed
# - `error(err)` - emtited if an unexpected error occured within ourself
# - `done(err, results)` - emitted when either the execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
# - `item.*(...)` - bubbled events from an added item
# - `task.*(...)` - bubbled events from an added {Task}
# - `group.*(...)` - bubbled events from an added {TaskGroup}
#
# Available internal statuses:
# - `null` - execution has not yet started
# - `'started'` - execution has begun
# - `'running'` - execution of items has begun
# - `'failed'` - execution has exited with failure status
# - `'passed'` - execution has exited with success status
# - `'destroyed'` - we've been destroyed and can no longer execute
class TaskGroup extends Interface
	# Internal: The type of our class for the purpose of duck typing
	# which is needed when working with node virtual machines
	# as instanceof will not work in those environments.
	type: 'taskgroup'

	# Public: A helper method to check if the passed argument is an instanceof a {TaskGroup}.
	#
	# item - The possible instance of the {TaskGroup} that we want to check
	#
	# Returns a {Boolean} of whether or not the item is a {TaskGroup} instance.
	@isTaskGroup: (group) -> return group?.type is 'taskgroup' or group instanceof TaskGroup

	# Public: A helper method to create a new subclass with our extensions.
	#
	# extensions - An {Object} of extensions to apply to the new subclass
	#
	# Returns the new sub {Class}
	@subclass: extendOnClass


	# Public: Creates a new {TaskGroup} instance.
	#
	# args - The {Arguments} to be forwarded along to the {::constructor}.
	#
	# Returns the new {TaskGroup} instance.
	@create: (args...) -> return new @(args...)

	# Internal: An {Array} of the items that are still yet to execute
	itemsRemaining: null

	# Internal: An {Array} of the items that are currently running
	itemsRunning: null

	# Internal: An {Array} of the items that have completed
	itemsCompleted: null

	# Internal: An {Array} of the result {Arguments} for each completed item when their :includeInResults configuration option is not `false`
	results: null

	# Internal: An {Error} object if execution has failed at some point
	err: null

	# Internal: A {String} containing our current status. See our {Task} description for available values.
	status: null

	# Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	events: null

	# Internal: The configuration for our {Task} instance. See {::setConfig} for available configuration.
	config: null

	# Public: Initialize our new {TaskGroup} instance. Forwards arguments onto {::setConfig}.
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
		queue(@autoRun.bind(@))

		# Chain
		@



	# ---------------------------------
	# Configuration

	# Public: Set Nested Task Config
	setNestedTaskConfig: (config={}) ->
		@config.nestedTaskConfig ?= {}
		for own key,value of config
			@config.nestedTaskConfig[key] = value
		@

	# Public: Set Nested Config
	setNestedConfig: (config={}) ->
		@setConfig(config)
		@config.nestedConfig ?= {}
		for own key,value of config
			@config.nestedConfig[key] = value
		@

	# Public: Set the configuration for our instance.
	#
	# Despite accepting an {Object} of configuration, we can also accept an {Array} of configuration.
	# When using an array, a {String} becomes the :name, a {Function} becomes the :method, and an {Object} becomes the :config
	#
	# config - Our configuration {Object} can contain the following fields:
	#   :name - (default: null) A {String} for what we would like our name to be, useful for debugging.
	#   :next - (defualt: null) A {Function} that we would like bound to the `done` event once.
	#   :method - (default: null) A {Function} that we would like to use to created nested groups and tasks using an inline style.
	#   :parent - (default: null) A parent {TaskGroup} that we may be attached to.
	#   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` errors that occur within items will not halt execution and will not be reported in the completion callbacks `err` argument (but will still be in the `results` argument).
	#   :concurrency - (default: 1) The {Number} of items that we would like to execute at the same time. Use `0` for unlimited. `1` accomplishes serial execution, everything else accomplishes parallel execution.
	#   :run - (default: true) A {Boolean} for whether or not to the :method (if specified) automatically.
	#   :nestedConfig - (default: null) An {Object} of nested configuration to be applied to all items of this group.
	#   :nestedTaskConfig - (default: null) An {Object} of nested configuration to be applied to all {Task}s of this group.
	#   :tasks - (default: null) An {Array} of tasks to be added as children.
	#   :groups - (default: null) An {Array} of groups to be added as children.
	#   :items - (default: null) An {Array} of {Task} and/or {TaskGroup} instances to be added to this group.
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

	# Internal: Prepare the method and it's configuration, and add it as a task to be executed.
	#
	# method - The {Function} of our method
	# config - An optional {Object} of configuration for the task to be created for our method
	addMethod: (method, config={}) ->
		method ?= @config.method.bind(@)
		method.isTaskGroupMethod = true
		config.name ?= 'taskgroup method for '+@getName()
		config.args ?= [@addGroup.bind(@), @addTask.bind(@)]
		config.includeInResults ?= false
		return @addTask(method, config)

	# Internal: Autorun ourself under certain conditions.
	#
	# Those conditions being:
	# - if we the :method configuration is defined, and we have no :parent
	# - if we the :run configuration is `true`
	#
	# Used primarily to cause the :method to fire at the appropriate time when using inline style.
	autoRun: ->
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

	# Internal: Add an item to ourself and configure it accordingly
	#
	# item - A {Task} or {TaskGroup} instance that we would like added to ourself
	# args - Additional configuration {Arguments} to apply to each item
	addItem: (item, args...) ->
		# Prepare
		me = @

		# Only add the item if it exists
		return null  unless item

		# Link our item to ourself
		item.setConfig({parent: @})
		item.setConfig(args...)  if args.length isnt 0
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

	# Internal: Add items to ourself and configure them accordingly
	#
	# items - An {Array} of {Task} and/or {TaskGroup} instances to add to ourself
	# args - Optional {Arguments} to configure each added item
	addItems: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		return (@addItem(item, args...)  for item in items)


	# ---------------------------------
	# Add Task

	# Public: Create a {Task} instance from some configuration.
	#
	# If the first argument is already a {Task} instance, then just update it's configuration with the remaning arguments.
	#
	# args - {Arguments} to use to configure the {Task} instance
	#
	# Returns the new {Task} instance
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

	# Public: Add a {Task} with some configuration to ourself, create it if needed.
	#
	# args - {Arguments} to configure (and if needed, create) the task
	addTask: (args...) ->
		task = @addItem @createTask args...

		# Chain
		@

	# Public: Add {Task}s with some configuration to ourself, create it if needed.
	#
	# items - An {Array} of {Task} items to add to ourself
	# args - Optional {Arguments} to configure each added {Task}
	addTasks: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		tasks = (@addTask(item, args...)  for item in items)

		# Chain
		@


	# ---------------------------------
	# Add Group

	# Public: Create a {TaskGroup} instance from some configuration.
	#
	# If the first argument is already a {TaskGroup} instance, then just update it's configuration with the remaning arguments.
	#
	# args - {Arguments} to use to configure the {TaskGroup} instance
	#
	# Returns the new {TaskGroup} instance
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

	# Public: Add a {TaskGroup} with some configuration to ourself, create it if needed.
	#
	# args - {Arguments} to configure (and if needed, create) the {TaskGroup}
	addGroup: (args...) ->
		group = @addItem @createGroup args...

		# Chain
		@

	# Public: Add {TaskGroup}s with some configuration to ourself, create it if needed.
	#
	# items - An {Array} of {TaskGroup} items to add to ourself
	# args - Optional {Arguments} to configure each added {TaskGroup}
	addGroups: (items, args...) ->
		items = [items]  unless Array.isArray(items)
		groups = (@addGroup(item, args...)  for item in items)

		# Chain
		@


	# ---------------------------------
	# Status Indicators

	# Public: Gets the total number of items
	#
	# Returns a {Number} of the total items we have
	getItemsTotal: ->
		running = @itemsRunning.length
		remaining = @itemsRemaining.length
		completed = @itemsCompleted.length
		total = running + remaining + completed
		return total

	# Public: Gets the names of the items, the total number of items, and their results for the purpose of debugging.
	#
	# Returns an {Object} containg the hashes:
	#   :remaining - An {Array} of the names of the remaining items
	#   :running - An {Array} of the names of the running items
	#   :completed - An {Array} of the names of the completed items
	#   :total - A {Number} of the total items we have
	#   :results - An {Array} of the results of the compelted items
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

	# Public: Gets the total number count of each of our item lists.
	#
	# Returns an {Object} containg the hashes:
	#   :remaining - A {Number} of the total remaining items
	#   :running - A {Number} of the total running items
	#   :completed - A {Number} of the total completed items
	#   :total - A {Number} of the total items we have
	#   :results - A {Number} of the total results we have
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

	# Public: Whether or not we have any running items
	#
	# Returns a {Boolean} which is `true` if we have any items that are currently running
	hasRunning: ->
		return @itemsRunning.length isnt 0

	# Public: Whether or not we have any items that are yet to execute
	#
	# Returns a {Boolean} which is `true` if we have any items that are still yet to be executed
	hasRemaining: ->
		return @itemsRemaining.length isnt 0

	# Public: Whether or not we have any items
	#
	# Returns a {Boolean} which is `true` if we have any running or remaining items
	hasItems: ->
		return @hasRunning() or @hasRemaining()

	# Public: Have we started execution yet?
	#
	# Returns a {Boolean} which is `true` if we have commenced execution
	hasStarted: ->
		return @status isnt null

	# Public
	hasResult: ->
		return @err? or @results.length isnt 0

	# Public: Have we finished its execution yet?
	#
	# Returns a {Boolean} which is `true` if we have finished execution
	hasExited: ->
		return @status in ['completed', 'destroyed']

	# Internal: Whether or not we have any available slots to execute more items.
	#
	# Returns a {Boolean} which is `true` if we have available slots.
	hasSlots: ->
		return (
			@config.concurrency is 0 or
			@itemsRunning.length < @config.concurrency
		)

	# Internal: Whether or not we have errord and want to pause when we have an error.
	#
	# Returns a {Boolean} which is `true` if we are paused.
	shouldPause: ->
		return (
			@config.onError is 'exit' and
			@err?
		)

	# Internal: Whether or not we are capable of firing more items.
	#
	# This is determined whether or not we are not paused, and we have remaning items, and we have slots able to execute those remaning items.
	#
	# Returns a {Boolean} which is `true` if we can fire more items.
	shouldFire: ->
		return (
			@shouldPause() is false and
			@hasRemaining() and
			@hasSlots()
		)

	# Public: Whether or not we have no items left
	#
	# Returns a {Boolean} which is `true` if we have no more running or remaining items
	isEmpty: ->
		return @hasItems() is false

	# Public
	isPaused: ->
		return (
			@shouldPause() and
			@hasRunning() is false
		)

	# Public: Have we completed its execution yet?
	#
	# Completion of executed is determined of whether or not we have started, and whether or not we are currently paused or have no remaining and running items left
	#
	# Returns a {Boolean} which is `true` if we have completed execution
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

	# Internal: Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	complete: ->
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

	# Public: When Done Promise.
	# Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	#
	# listener - The {Function} to attach or execute.
	whenDone: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.call(@, @err, @results)
		else
			super(handler)
		@

	# Public: Once Done Promise.
	# Fires the listener once, either on the next tick if we are already done, or if not, once the `done` event fires.
	#
	# listener - The {Function} to attach or execute.
	onceDone: (handler) ->
		if @isComplete()
			queue =>  # avoid zalgo
				handler.call(@, @err, @results)
		else
			super(handler)
		@

	# Internal: Reset the results.
	#
	# At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults: ->
		@results = []
		@

	# Internal: Fire the next items.
	#
	# Returns either an {Array} items that was fired, or `false` if no items were fired.
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

	# Internal: Fire the next item.
	#
	# Returns either the item that was fired, or `false` if no item was fired.
	fireNextItem: ->
		# Prepare
		result = false
		fire = @shouldFire()

		# Can we run the next item?
		if fire
			# Fire the next item

			# Update our status and notify our listeners
			@emit(@status = 'running')  if @status isnt 'running'

			# Get the next item and remove it from the remaining items
			item = @itemsRemaining.shift()
			@itemsRunning.push(item)

			# Run it
			item.run()

			# Return the item
			result = item

		# Return
		return result

	# Internal: What to do when an item completes
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

	# Internal: Either execute the reamining items we are not paused, or complete execution by exiting.
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

	# Public: Clear remaning items.
	clear: ->
		# Destroy all the items
		for item in @itemsRemaining
			item.destroy()
		@itemsRemaining = []

		# Chain
		@

	# Public: Destroy all remaining items and remove listeners.
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


	# Internal: We now want to exit.
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

	# Public: Start the execution.
	run: (args...) ->
		queue =>
			# Start
			@status = 'started'

			# Notify our intention to run
			@emit(@status)

			# Give time for the listeners to complete before continuing
			@fire()

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
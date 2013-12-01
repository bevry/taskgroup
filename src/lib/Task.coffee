# Import
ambi = require('ambi')
{EventEmitter} = require('events')
domain = (try require('domain')) ? null
setImmediate = global?.setImmediate or process.nextTick  # node 0.8 b/c

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
			setImmediate(@fire.bind(@))

		# Chain
		@

module.exports = Task

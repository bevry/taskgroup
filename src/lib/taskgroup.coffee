# Import
typeChecker = require('typechecker')
ambi = require('ambi')

# Define
TaskGroup = class
	# How many tasks do we have
	total: 0

	# How many tasks have completed?
	completed: 0

	# How many tasks are currently running?
	running: 0

	# Have we already exited?
	exited: false

	# Should we break on errors?
	breakOnError: true

	# Should we auto clear?
	autoClear: false

	# Queue
	queue: []

	# Mode
	mode: 'parallel'

	# Results
	lastResult: null
	results: []
	errors: []

	# What to do next?
	next: ->
		throw new Error('Groups require a completion callback')

	# Construct our group
	constructor: (args...) ->
		@clear()
		for arg in args
			if typeChecker.isString(arg)
				@mode = 'serial'  if arg in ['serial','sync']
			else if typeChecker.isFunction(arg)
				@next = arg
			else if typeChecker.isObject(arg)
				{next,mode,breakOnError,autoClear} = arg
				@next = next  if next
				@mode = mode  if mode
				@breakOnError = breakOnError  if breakOnError
				@autoClear = autoClear  if autoClear
			else
				throw new Error('Unknown argument sent to Groups constructor')

	# Clear the queue
	clear: ->
		# Clear all our properties
		@total = 0
		@completed = 0
		@running = 0
		@exited = false
		@queue = []
		@results = []
		@errors = []
		@lastResult = null

		# Chain
		@

	# Check if we have tasks
	hasTasks: ->
		return @queue.length isnt 0

	# Check if we have completed
	hasCompleted: ->
		return @total isnt 0  and  @total is @completed

	# Check if we are currently running
	isRunning: ->
		return @running isnt 0

	# Check if we have exited
	hasExited: (value) ->
		@exited = value  if value?
		return @exited is true

	# Log an error
	logError: (err) ->
		# Only push the error if we haven't already added it
		if @errors[@errors.length-1] isnt err
			@errors.push(err)
		# Chain
		@

	# A task has completed
	complete: (args...) ->
		# Push the result
		err = args[0] or undefined
		@lastResult = args
		@logError(err)  if err
		@results.push(args)

		# We are one less running task
		if @running isnt 0
			--@running

		# Check if we have already completed
		if @hasExited()
			# do nothing

		# Otherwise
		else
			# If we have an error, and we are told to break on an error, then we should
			if err and @breakOnError
				@exit()

			# Otherwise complete the task successfully
			# and run the next task if we have one
			# otherwise, exit
			else
				++@completed
				if @hasTasks()
					@nextTask()
				else if @isRunning() is false and @hasCompleted()
					@exit()

		# Chain
		@

	# Alias for complete
	completer: ->
		return (args...) => @complete(args...)

	# The group has finished
	exit: (err=null) ->
		# Push the error if we were passed one
		@logError(err)  if err

		# Check if we have already exited, if so, ignore
		if @hasExited()
			# do nothing

		# Otherwise
		else
			# Fetch the results
			lastResult = @lastResult
			results = @results

			# If have multiple errors, return an array
			# If we have one error, return that error
			# If we have no errors, retur null
			if @errors.length is 0
				errors = null
			else if @errors.length is 1
				errors = @errors[0]
			else
				errors = @errors

			# Clear, and exit with the results
			if @autoClear
				@clear()
			else
				@hasExited(true)
			@next(errors,lastResult,results)

		# Chain
		@

	# Push a set of tasks to the group
	tasks: (tasks) ->
		# Push the tasks
		@push(task)  for task in tasks

		# Chain
		@

	# Push a new task to the group
	push: (args...) ->
		# Add the task and increment the count
		++@total

		# Queue
		@queue.push(args)

		# Chain
		@

	# Push and run
	pushAndRun: (args...) ->
		# Check if we are currently running in sync mode
		if @mode is 'serial' and @isRunning()
			# push the task for later
			@push(args...)
		else
			# run the task now
			++@total
			@runTask(args)

		# Chain
		@

	# Next task
	nextTask: ->
		# Only run the next task if we have one
		if @hasTasks()
			task = @queue.shift()
			@runTask(task)

		# Chain
		@

	# Run a task
	runTask: (task) ->
		# Prepare
		me = @

		# Run it, and catch errors
		try
			run = ->
				# Prepare
				++me.running
				complete = me.completer()

				# Extract
				if typeChecker.isArray(task)
					if task.length is 2
						_task = task[1].bind(task[0])
					else if task.length is 1
						_task = task[0]
					else
						throw new Error('an invalid task was pushed')
				else
					_task = task

				# Execute
				ambi(_task,complete)

			# Fire with an immediate timeout for async loads, and every hundredth sync task, except for the first
			# otherwise if we are under a stressful load node will crash with
			# a segemantion fault / maximum call stack exceeded / range error
			if @completed isnt 0 and (@mode is 'parallel' or (@completed % 100) is 0)
				setTimeout(run,0)
			# Otherwise run the task right away
			else
				run()
		catch err
			@complete(err)

		# Chain
		@

	# Run the tasks
	run: (mode) ->
		if @isRunning() is false
			@mode = mode  if mode
			@hasExited(false)
			if @hasTasks()
				if @mode in ['serial','sync']
					@nextTask()
				else
					@nextTask()  for task in @queue
			else
				@exit()
		@

	# Parallel
	async: -> @parallel()
	parallel: -> @run('parallel'); @

	# Serial
	sync: -> @serial()
	serial: -> @run('serial'); @

# Export
module.exports = TaskGroup
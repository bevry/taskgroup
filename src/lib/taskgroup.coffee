# Import
typeChecker = require('typechecker')
ambi = require('ambi')
EventEmitter = require('eventemitter2').EventEmitter2

# Task
# Events
# - complete
# - run
class Task extends EventEmitter
	fn: null
	completed: false

	constructor: (args...) ->
		# Prepare
		super

		# Fetch args
		opts = fn = null
		if args.length is 2
			[opts,fn] = args
		else if args.length is 1
			if typeChecker.isFunction(args[0])
				fn = args[0]
			else
				opts = args[0]

		# Apply args
		@setConfig(opts)  if opts
		@fn = fn  if fn

		# Chain
		@

	setConfig: (opts={}) =>
		# Configure
		for own key,value of opts
			@[key] = value

		# Chain
		@

	run: ->
		# What happens once the task is complete
		complete = (args...) =>
			# Update our status
			@completed = true

			# Notify listeners we are now complete
			@emit('complete', args...)
		
		# Notify our intention
		@emit('run')
		
		# Queue
		process.nextTick =>
			# Run it
			ambi(@fn.bind(@),complete)
			
		# Chain
		@

# Task Group
# Events
# - (task|group|item).(complete|run)
# - complete
# - run
class TaskGroup extends EventEmitter
	running: 0
	remaining: null
	err: null
	results: null

	# Config
	concurrency: 0
	paused: true
	pauseOnError: true  # needs testing
	pauseOnExit: true   # needs testing
	
	constructor: (args...) ->
		# Init
		super
		@err = null
		@results = []
		@remaining = []

		# Fetch args
		opts = next = null
		if args.length is 2
			[opts,next] = args
		else if args.length is 1
			if typeChecker.isFunction(args[0])
				next = args[0]
			else
				opts = args[0]

		# Apply args
		@setConfig(opts)  if opts
		@on('complete',next)  if next

		# Handle item completion
		@on 'item.complete', (args...) =>
			# Add the result
			@results.push(args)

			# Update error if it exists
			@err = args[0]  if args[0]

			# Mark that one less item is running
			--@running

			# Already exited?
			return  if @paused

			# If we have no more items or if we have an error
			if (@pauseOnError and @err) or (@hasItems() is false and @running is 0)
				# Complete
				@complete()
			else
				# Otherwise continue with the next item
				@nextItems()	
		
		# Chain
		@

	complete: =>
		@paused = true  if @pauseOnExit
		@emit('complete',@err,@results)
		@err = null
		@results = []
		@

	setConfig: (opts={}) =>
		# Configure
		for own key,value of opts
			@[key] = value

		# Chain
		@

	addItem: (item) =>
		# Prepare
		me = @

		# Bubble item events
		item.onAny (args...) ->
			me.emit("item.#{@event}", args...)

		# Notify our intention
		@emit('add',item)

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
		task = @createTask(args...)
		
		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", args...)

		# Return the item
		return @addItem(task)

	createGroup: (args...) =>
		group = new TaskGroup(args...)
		return group

	addGroup: (args...) =>
		# Prepare
		me = @

		# Create the group with our arugments
		group = @createGroup(args...)

		# Bubble task events
		group.onAny (args...) ->
			me.emit("group.#{@event}", args...)

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

	clear: =>
		# Clear the remaining items
		@remaining.splice(0)
		
		# Chain
		@

	run: =>
		# Start again
		@paused = false

		# Notify that we are about to run it
		@emit('run')
		
		# Queue
		if @hasItems() is false
			@complete()  # needs testing
		else
			@nextItems()

		# Chain
		@


# Task Runner
class TaskRunner extends TaskGroup
	parent: null
	concurrency: 1
	pauseOnExit: false

	constructor: (name,fn,parent) ->
		super({name,fn,parent})
		@on 'run', =>
			@fn.call(@, @addGroup, @addTask)
			@fn = null  # no need for it anymore
		unless @parent
			process.nextTick => @run()
	
	createTask: (name,fn) =>
		parent = @
		task = new Task({name,parent},fn)
		return task

	createGroup: (name,fn) =>
		parent = @
		group = new TaskRunner(name,fn,parent)
		return group

# Test Runner
class TestRunner extends TaskRunner
	createGroup: (name,fn) =>
		parent = @
		group = new TestRunner(name,fn,parent)
		return group

	describe: (args...) => @addGroup(args...)
	suite: (args...) => @addGroup(args...)
	it: (args...) => @addTask(args...)
	test: (args...) => @addTask(args...)

# Export
module.exports = {Task,TaskGroup,TaskRunner,TestRunner}
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

	constructor: (fn) ->
		# Prepare
		super

		# Apply
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
		
		# Give time for the listeners to complete before continuing
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
	
	constructor: ->
		# Init
		super
		@err = null
		@results = []
		@remaining = []

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

	complete: =>
		# Pause under error condition
		@pause()  if @pauseOnError and @err

		# Notify we've completed and send the error and results if we have them
		@emit('complete',@err,@results)

		# Reset the error and results to build up again for the next completion
		@err = null
		@results = []

		# Chain
		@

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
			# Run it
			if @hasItems() is false
				# Complete if we have no tasks
				# needs testing
				@complete()
			else
				# We have tasks, so fire them
				@nextItems()

		# Chain
		@
		

# Task Runner
class TaskRunner extends TaskGroup
	parent: null
	concurrency: 1

	constructor: (args...) ->
		# Prepare
		super()

		# Configure if we are going the constructor configuration route
		if args.length
			[name,fn] = args
			@setConfig({name,fn})

		# Fire our function that adds our tasks before we run our tasks
		@on 'run', =>
			@fn.call(@, @addGroup, @addTask)
			@fn = null  # no need for it anymore
		
		# Give setConfig enough chance to fire
		process.nextTick =>
			@run()  unless @parent
	
	createTask: (name,fn) =>
		parent = @
		task = new Task().setConfig({name,parent,fn})
		return task

	createGroup: (name,fn) =>
		parent = @
		group = new TaskRunner().setConfig({name,parent,fn})
		return group

# Test Runner
class TestRunner extends TaskRunner
	createGroup: (name,fn) =>
		parent = @
		group = new TestRunner().setConfig({name,parent,fn})
		return group

	describe: (args...) => @addGroup(args...)
	suite: (args...) => @addGroup(args...)
	it: (args...) => @addTask(args...)
	test: (args...) => @addTask(args...)

# Export
module.exports = {Task,TaskGroup,TaskRunner,TestRunner}
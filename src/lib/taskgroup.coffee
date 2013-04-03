# Import
ambi = require('ambi')
EventEmitter = require('eventemitter2').EventEmitter2

# Task
# Events
# - complete
# - run
class Task extends EventEmitter
	fn: null
	completed: false

	constructor: (@fn) ->
		super
		@

	setConfig: (opts={}) ->
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
# - (task|group).(complete|run)
# - complete
# - run
class TaskGroup extends EventEmitter
	running: 0
	remaining: null
	concurrency: null

	paused: true
	pauseOnError: true  # needs testing
	pauseOnExit: true   # needs testing
	
	constructor: (next) ->
		# Init
		super
		@remaining = []
		@on('complete',next)  if next

		# Prepare
		err = results = null
		reset = ->
			err = null
			results = []
		reset()

		# What to do once an item completes
		complete = (args...) =>
			# Add the result
			results.push(args)

			# Update error if it exists
			err = args[0]  if args[0]

			# Mark that one less item is running
			--@running

			# Already exited?
			return  if @paused

			# If we have no more items or if we have an error
			if (@pauseOnError and err) or (@hasItems() is false and @running is 0)
				# Complete
				@paused = true  if @pauseOnExit
				@emit('complete',err,results)
				reset()
			else
				# Otherwise continue with the next item
				@nextItems()	

		# Listen for completion
		@on('task.complete', complete)
		@on('group.complete', complete)	
		
		# Chain
		@

	setConfig: (opts={}) ->
		# Configure
		for own key,value of opts
			@[key] = value

		# Chain
		@

	addItem: (item) =>
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

	run: (concurrency) =>
		# Set the concurency if we have it
		@concurrency = concurrency  if concurrency?
		@paused = false

		# Notify that we are about to run it
		@emit('run')
		
		# Queue
		@nextItems()

		# Chain
		@


# Task Runner
class TaskRunner extends TaskGroup
	parent: null
	concurrency: 1
	pauseOnExit: false

	constructor: (@name,fn,@parent) ->
		super()
		@on 'run', =>
			fn.call(@, @addGroup, @addTask)
		unless @parent
			process.nextTick => @run()
	
	createTask: (name,fn) =>
		task = new Task(fn).setConfig({
			name: name
			parent: @
		})
		return task

	createGroup: (name,fn) =>
		group = new TaskRunner(name,fn,@)
		return group

# Test Runner
class TestRunner extends TaskRunner
	createGroup: (name,fn) =>
		group = new TestRunner(name,fn,@)
		return group
	describe: (args...) => @addGroup(args...)
	suite: (args...) => @addGroup(args...)
	it: (args...) => @addTask(args...)
	test: (args...) => @addTask(args...)

# Export
module.exports = {Task,TaskGroup,TaskRunner,TestRunner}
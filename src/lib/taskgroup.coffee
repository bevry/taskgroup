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
	exited: false
	
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

			# Mark that one less item is running
			--@running

			# Already exited?
			return  if @exited

			# Update error if it exists
			err = args[0]  if args[0]

			# If we have no more items or if we have an error
			if err or (@hasItems() is false and @running is 0)
				# Complete
				@exited = true
				@emit('complete',err,results)
				reset()
			else
				# Otherwise continue with the next item
				@nextItem()	

		# Listen for completion
		@on('task.complete', complete)
		@on('group.complete', complete)	
		
		# Chain
		@

	addItem: (item) ->
		# Notify our intention
		@emit('add',item)

		# Add the item
		@remaining.push(item)

		# Return the item
		return item

	addTask: (args...) ->
		# Prepare
		me = @

		# Create the task with our arguments
		task = new Task(args...)
		
		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", args...)

		# Return the item
		return @addItem(task)

	addGroup: (args...) ->
		# Prepare
		me = @

		# Create the group with our arugments
		group = new TaskGroup(args...)

		# Bubble task events
		group.onAny (args...) ->
			me.emit("group.#{@event}", args...)

		# Return the item
		return @addItem(group)

	hasItems: ->
		# Do we have any items left to run
		return @remaining.length isnt 0

	isReady: ->
		# Do we have available slots to run
		return !@concurrency or @running < @concurrency

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

	clear: ->
		# Clear the remaining items
		@remaining.splice(0)
		
		# Chain
		@

	run: (concurrency) ->
		# Set the concurency if we have it
		@concurrency = concurrency  if concurrency?
		@exited = false

		# Notify that we are about to run it
		@emit('run')
		
		# Queue
		process.nextTick =>
			# Fire the next item
			while true
				break  unless @nextItem()

		# Chain
		@


# Test Group Runner
class TestGroupRunner extends TaskGroup
	parent: null
	concurrency: 1

	constructor: (@name,fn,@parent) ->
		super()
		@on 'run', =>
			fn.call(@, @addGroup, @addTask)
		unless @parent
			process.nextTick => @run()
	
	addTask: (name,fn) =>
		# Prepare
		me = @

		# Create the task with our arguments
		task = new Task(fn)
		task.name = name
		task.parent = @
		
		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", args...)

		# Return the item
		return @addItem(task)

	addGroup: (name,fn) =>
		# Prepare
		me = @

		# Create the group with our arugments
		group = new TestGroupRunner(name,fn,@)

		# Bubble task events
		group.onAny (args...) ->
			me.emit("group.#{@event}", args...)

		# Return the item
		return @addItem(group)

	describe: (args...) -> @addGroup(args...)
	suite: (args...) -> @addGroup(args...)
	it: (args...) -> @addTask(args...)
	test: (args...) -> @addTask(args...)

# Export
module.exports = {Task,TaskGroup,TestGroupRunner}
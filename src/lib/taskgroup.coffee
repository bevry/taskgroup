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
		@emit('run', @)

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
	TaskClass: Task
	TaskGroupClass: TaskGroup

	running: 0
	remaining: null
	concurrency: null
	exited: false
	
	constructor: (next) ->
		# Init
		super
		@remaining = []
		@on('complete',next)

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
		task = new @TaskClass(args...)
		
		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", args...)

		# Return the item
		return @addItem(task)

	addGroup: (args...) ->
		# Prepare
		me = @

		# Create the group with our arugments
		group = new @TaskGroupClass(args...)

		# Bubble task events
		task.onAny (args...) ->
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
				
				# Notify that we are about to run it
				@emit('run', nextItem)
				
				# Run it
				process.nextTick -> nextItem.run()

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
		
		# Fire the next item
		while true
			break  unless @nextItem()

		# Chain
		@

# Task Runner
class TaskRunner extends Task
	constructor: (@name,fn) ->

class TaskGroupRunner extends TaskGroup
	TaskClass: TaskRunner
	TaskGroupClass: TaskGroupRunner
	constructor: (@name,fn) ->
		super
		fn.call(@)
		@run(1)

# Test Group Runner
class TestGroupRunner extends TaskRunner
	describe: @addGroup
	suite: @addGroup
	it: @addTask
	test: @addTask

# Export
module.exports = {Task,TaskGroup,TaskRunner,TaskGroupRunner,TestGroupRunner}
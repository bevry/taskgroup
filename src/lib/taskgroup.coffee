# Import
ambi = require('ambi')
EventEmitter = require('eventemitter2').EventEmitter2

# Task
# Events
# - complete
# - run
class Task extends EventEmitter
	type: 'task'  # for duck typing
	completed: false
	parent: null

	# Config
	name: null
	fn: null
	args: null

	constructor: (args...) ->
		# Prepare
		super

		# Apply
		name = fn = null
		if args.length
			if args.length is 2
				[name,fn] = args
			else if args.length is 1
				[fn] = args
		@setConfig({name,fn})

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
			args = (@args or []).concat([complete])
			ambi(@fn.bind(@), args...)

		# Chain
		@

# Task Group
# Events
# - (task|group|item).(complete|run)
# - complete
# - run
class TaskGroup extends EventEmitter
	type: 'taskgroup'  # for duck typing
	running: 0
	remaining: null
	err: null
	results: null
	parent: null
	paused: true

	# Config
	name: null
	fn: null
	concurrency: 1  # use 0 for unlimited
	pauseOnError: true  # needs testing

	constructor: (args...) ->
		# Init
		super
		@err = null
		@results = []
		@remaining = []

		# Apply
		name = fn = null
		if args.length
			if args.length is 2
				[name,fn] = args
			else if args.length is 1
				[fn] = args
		@setConfig({name,fn})

		# Give setConfig enough chance to fire
		process.nextTick =>
			# Auto run if we are going the inline style and have no parent
			if @fn
				# Add the function as our first unamed task with the extra arguments
				args = [@addGroup, @addTask]
				@addTask(@fn.bind(@)).setConfig({args,includeInResults:false})

				# Proceed to run if we are the topmost group
				@run()  if !@parent

		# Handle item completion
		@on 'item.complete', (item,args...) =>
			# Add the result
			@results.push(args)  if item.includeInResults isnt false

			# Update error if it exists
			@err = args[0]  if args[0]

			# Mark that one less item is running
			--@running  if @running > 0

			# Already exited?
			return  if @paused

			# Continue or finish up
			@nextItems()  unless @complete()

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
			me.emit("item.#{@event}", item, args...)

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
		task = @createTask(args...).setConfig({parent:@})

		# Bubble task events
		task.onAny (args...) ->
			me.emit("task.#{@event}", task, args...)

		# Return the item
		return @addItem(task)

	createGroup: (args...) =>
		group = new TaskGroup(args...)
		return group

	addGroup: (args...) =>
		# Prepare
		me = @

		# Create the group with our arguments
		group = @createGroup(args...).setConfig({concurrency:@concurrency,parent:@})

		# Bubble task events
		group.onAny (args...) ->
			me.emit("group.#{@event}", group, args...)

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
		pause = @pauseOnError and @err
		empty = @hasItems() is false and @running is 0
		completed = pause or empty

		if completed
			# Pause if desired
			@pause()  if pause

			# Notify we've completed and send the error and results if we have them
			@emit('complete',@err,@results)

			# Reset the error and results to build up again for the next completion
			@err = null
			@results = []

		# Return result
		return completed

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

	exit: (err) =>
		# Apply
		@err = err  if err

		# Clear
		@stop()

		# Stop running
		@running = 0

		# Complete
		@complete()

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
			# Continue or finish up
			@nextItems()  unless @complete()

		# Chain
		@

# Export
module.exports = {Task,TaskGroup}
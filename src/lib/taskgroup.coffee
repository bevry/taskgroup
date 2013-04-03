# Import
ambi = require('ambi')
EventEmitter = require('eventemitter2').EventEmitter2

# Task
class Task extends EventEmitter
	name: null
	fn: null
	completed: false

	constructor: (@name,@fn) ->
		super
		@

	run: ->
		complete = (args...) =>
			@completed = true
			@emit('error', args...)  if args[0]
			@emit('complete', args...)

		process.nextTick =>
			ambi(@fn.bind(@),complete)
		
		@

# Task Group
class TaskGroup extends EventEmitter
	name: null
	running: 0
	remaining: null
	concurrency: null
	
	constructor: (@name,next) ->
		super
		@remaining = []

		err = null
		results = []

		@on 'task.complete group.end', (args...) =>
			err = args[0]  if args[0]
			results.push(args)

			--@running
			if @hasTasks()
				@nextTask()
			else
				@emit('end',err,results)
		
		@on('end',next)

	addItem: (item) ->
		@remaining.push(item)
		@emit('add',item)
		@

	addTask: (args...) ->
		task = new Task(args...)
		
		task.on 'error', (err) =>
			@emit('error', err)
		task.on '*', (eventName, args...) =>
			@emit("task.#{eventName}", args...)

		@addItem(task)
		
		@

	addGroup: (args...) ->
		group = new TaskGroup(args...)

		group.on 'error', (err) =>
			@emit('error', err)
		group.on '*', (eventName, args...) =>
			@emit("group.#{eventName}", args...)

		@remaining.push(group)
		@emit('add',group)

		return group

	hasItems: ->
		return @remaining.length isnt 0

	isReady: ->
		return !@concurrency or @running < @concurrency

	nextItem: ->
		if @hasItems()
			if @isReady()
				nextItem = @remaining.unshift()
				@emit('run',nextItem)
				nextItem.run()
		@

	clear: ->
		@remaining.splice(0)
		@

	run: (concurrency) ->
		@concurrency = concurrency  if concurrency?
		@nextItem()
		@

# Task Runner
class TaskRunner extends TaskGroup
	constructor: ->
		super
		@on 'add', (item) ->
			item.run()

# Test Runner
class TestRunner extends TaskRunner
	describe: @addGroup
	suite: @addGroup
	it: @addTask
	test: @addTask

# Export
module.exports = {Task,TaskGroup,TaskRunner,TestRunner}


###
Questions
1. Should it stop on error?
2. Should complete fire when there is an error? Yes.

###
# Import
util = require('util')
joe = require('joe')
{Task,TaskGroup} = require('../../')

# Prepare
delay = 100
{wait, throwUnexpected, returnViaCallback, completeViaCallback, expectViaCallback, expectErrorViaCallback} = require('assert-helpers')


# ====================================
# Task

joe.describe 'task', (describe, it) ->
	# failure: done with no run
	it 'Task.create(...).done(...) should time out when run was not called', (complete) ->
		Task.create(returnViaCallback(5)).done(throwUnexpected)
		wait(delay, complete)

	# failure: done with no task method
	it 'Task.create().run().done(...) should fail as there was no task method defined', (complete) ->
		Task.create().run().done(expectErrorViaCallback('no method', complete))

	# success: run then done
	it 'Task.create(...).run().done(...) should fire the completion callback with the expected result', (complete) ->
		Task.create(returnViaCallback(5)).run().done(expectViaCallback(null, 5)).done(complete)

	# success: done then run
	it 'Task.create(...).done(...).run() should fire the completion callback with the expected result', (complete) ->
		Task.create(returnViaCallback(5)).run().done(expectViaCallback(null, 5)).done(complete)

	# failure: run then run then done
	it 'Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', (complete) ->
		Task.create(returnViaCallback(5))
			.run().run()
			.on('error', expectErrorViaCallback('started earlier', complete))

	# failure: done then run then run
	it 'Task.create(...).done(...).run().run() should fail as a task is not allowed to run twice', (complete) ->
		task = Task.create(returnViaCallback(5))
			.on('error', expectErrorViaCallback('started earlier', complete))
			.run().run()

joe.describe 'taskgroup', (describe, it) ->
	# failure: done with no run
	it 'TaskGroup.create().addTask(...).done(...) should time out when run was not called', (complete) ->
		tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.done(throwUnexpected)
		wait(delay, complete)

	# success: done with no tasks then run
	it 'TaskGroup.create().run().done(...) should complete with no results', (complete) ->
		tasks = TaskGroup.create()
			.run()
			.done(expectViaCallback(null, []))
			.done(complete)

	# success: run then done then add
	it 'TaskGroup.create().run().done(...).addTask(...) should complete with the tasks results', (complete) ->
		tasks = TaskGroup.create()
			.run()
			.done(expectViaCallback(null, [[null,5]]))
			.done(complete)
			.addTask(returnViaCallback(5))

	# success: done then task then run then done
	it 'TaskGroup.create().run().done(...) should complete correctly', (complete) ->
		tasks = TaskGroup.create()
			.done(expectViaCallback(null, [[null,5], [null,10]]))
			.addTask(returnViaCallback(5))
			.run()
			.addTask(returnViaCallback(10))
			.done(complete)

	# success: done then task then run then done
	it 'TaskGroup.create().run().run().done(...) should complete only once', (complete) ->
		tasks = TaskGroup.create()
			.done(expectViaCallback(null, [[null,5],[null,10]]))
			.addTask(returnViaCallback(5))
			.run().run()
			.addTask(returnViaCallback(10))
			.done(complete)

	# success: multiple runs
	it 'Taskgroup should be able to complete multiple times', (complete) ->
		tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.run()
			.done(expectViaCallback(null, [[null,5]]))
		wait delay, ->
			tasks
				.addTask(returnViaCallback(10))
				.done(expectViaCallback(null, [[null,5],[null,10]]))
				.done(complete)

	# success: pause after error
	it 'Taskgroup should pause when encountering an error', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null,5], [err]]))
			.done(-> complete())

	# success: resume after error
	it 'Taskgroup should be able to resume after an error', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create()
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(err, [[null,5], [err]]))
		wait delay, ->
			tasks
				.addTask(returnViaCallback(15))
				.done(expectViaCallback(null, [[null,5], [err], [null,10], [null,15]]))
				.done(complete)

	# success: ignore after error
	it 'Taskgroup should ignore when encountering an error with different config', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create({onError: 'ignore'})
			.addTask(returnViaCallback(5))
			.addTask(returnViaCallback(err))
			.addTask(returnViaCallback(10))
			.run()
			.done(expectViaCallback(null, [
				[null,5], [err], [null,10]
			]))
			.done(-> complete())

	# failure: nested timeouts
	it 'Taskgroup should apply nested configuration to tasks', (complete) ->
		tasks = TaskGroup.create()
			.setNestedTaskConfig(
				timeout: delay
				onError: 'ignore'
			)
			.addTask(returnViaCallback(5))
			.addTask(completeViaCallback(10, delay*2))
			.addTask(returnViaCallback(15))
			.run()
			.done(expectErrorViaCallback('timed out', complete))

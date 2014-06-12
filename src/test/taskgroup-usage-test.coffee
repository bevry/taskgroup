# Import
util = require('util')
{expect} = require('chai')
joe = require('joe')
{Task,TaskGroup} = require('../../')

# Prepare
{wait, delay, inspect, throwUnexpected, returnResult, returnResultAfterDelay, returnError, expectError, expectDeep, expectResult, completeWithError} = require('./util')


# ====================================
# Task

joe.describe 'task', (describe, it) ->
	# failure: done with no run
	it 'Task.create(...).done(...) should time out when run was not called', (complete) ->
		Task.create(returnResult(5)).done(throwUnexpected)
		wait(delay, complete)

	# failure: done with no task method
	it 'Task.create().run().done(...) should fail as there was no task method defined', (complete) ->
		Task.create().run().done(completeWithError('no method', complete))

	# success: run then done
	it 'Task.create(...).run().done(...) should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)

	# success: done then run
	it 'Task.create(...).done(...).run() should fire the completion callback with the expected result', (complete) ->
		Task.create(returnResult(5)).run().done(expectResult(null, 5)).done(complete)

	# failure: run then run then done
	it 'Task.create(...).run().run().done(...) should fail as a task is not allowed to run twice', (complete) ->
		Task.create(returnResult(5))
			.run().run()
			.on('error', completeWithError('started earlier', complete))

	# failure: done then run then run
	it 'Task.create(...).done(...).run().run() should fail as a task is not allowed to run twice', (complete) ->
		task = Task.create(returnResult(5))
			.on('error', completeWithError('started earlier', complete))
			.run().run()

joe.describe 'taskgroup', (describe, it) ->
	# failure: done with no run
	it 'TaskGroup.create().addTask(...).done(...) should time out when run was not called', (complete) ->
		tasks = TaskGroup.create()
			.addTask(returnResult(5))
			.done(throwUnexpected)
		wait(delay, complete)

	# success: done with no tasks then run
	it 'TaskGroup.create().run().done(...) should complete with no results', (complete) ->
		tasks = TaskGroup.create()
			.run()
			.done(expectResult(null, []))
			.done(complete)

	# success: run then done then add
	it 'TaskGroup.create().run().done(...).addTask(...) should complete with the tasks results', (complete) ->
		tasks = TaskGroup.create()
			.run()
			.done(expectResult(null, [[null,5]]))
			.done(complete)
			.addTask(returnResult(5))

	# success: done then task then run then done
	it 'TaskGroup.create().run().done(...) should complete correctly', (complete) ->
		tasks = TaskGroup.create()
			.done(expectResult(null, [[null,5], [null,10]]))
			.addTask(returnResult(5))
			.run()
			.addTask(returnResult(10))
			.done(complete)

	# success: done then task then run then done
	it 'TaskGroup.create().run().run().done(...) should complete only once', (complete) ->
		tasks = TaskGroup.create()
			.done(expectResult(null, [[null,5],[null,10]]))
			.addTask(returnResult(5))
			.run().run()
			.addTask(returnResult(10))
			.done(complete)

	# success: multiple runs
	it 'Taskgroup should be able to complete multiple times', (complete) ->
		tasks = TaskGroup.create()
			.addTask(returnResult(5))
			.run()
			.done(expectResult(null, [[null,5]]))
		wait delay, ->
			tasks
				.addTask(returnResult(10))
				.done(expectResult(null, [[null,5],[null,10]]))
				.done(complete)

	# success: pause after error
	it 'Taskgroup should pause when encountering an error', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create()
			.addTask(returnResult(5))
			.addTask(returnResult(err))
			.addTask(returnResult(10))
			.run()
			.done(expectResult(err, [[null,5], [err]]))
			.done(-> complete())

	# success: resume after error
	it 'Taskgroup should be able to resume after an error', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create()
			.addTask(returnResult(5))
			.addTask(returnResult(err))
			.addTask(returnResult(10))
			.run()
			.done(expectResult(err, [[null,5], [err]]))
		wait delay, ->
			tasks
				.addTask(returnResult(15))
				.done(expectResult(null, [[null,5], [err], [null,10], [null,15]]))
				.done(complete)

	# success: ignore after error
	it 'Taskgroup should ignore when encountering an error with different config', (complete) ->
		err = new Error('fail after 5')
		tasks = TaskGroup.create({onError: 'ignore'})
			.addTask(returnResult(5))
			.addTask(returnResult(err))
			.addTask(returnResult(10))
			.run()
			.done(expectResult(null, [
				[null,5], [err], [null,10]
			]))
			.done(-> complete())

	# failure: nested timeouts
	it 'Taskgroup should apply nested configuration to tasks', (complete) ->
		tasks = TaskGroup.create(nestedConfig: timeout: delay)
			.addTask(returnResult(5))
			.addTask(returnResultAfterDelay(10, delay*2))
			.addTask(returnResult(15))
			.run()
			.done(completeWithError('timed out', complete))
			.on 'error', (err) ->
				expectError(err, 'already completed')

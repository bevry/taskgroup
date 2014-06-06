"use strict";

var TaskGroup = require('taskgroup')
var Task = TaskGroup.Task
var log = console.log
var result = function(number){
	return function(){
		return number
	}
}
var error = function(message){
	return function(){
		return new Error(message)
	}
}

// ====================================
// Task

// failure: done with no run
Task.create(result(5)).done(log) // should done fire here? what results should it contain
// perhaps: no, it should be queued, and wait for run
// we should add a way to detect that it never run

// success: run then done
Task.create(result(5)).run().done(log) // should done fire here? what results should it contain
// perhaps: yes, the run should complete, and done should fire right away
// expected result would be: [null, [[null, 5]]]

// success: done then run
Task.create(result(5)).done(log).run() // should done fire here? what results should it contain
// perhaps: yes, the run should complete, an fire the done listener
// expected result would be: [null, [[null, 5]]]

// failure: run then run then done
Task.create(result(5)).run().run().done(log)
// expected result would be: ['task was run twice, this is unexpected', [[null, 5]]]

// failure: run then done with no task method
Task.create().run().done(log) // should throw an exception
// expected result would be: ['no method was added', []]


// ====================================
// TaskGroup

// failure: done with no run with no tasks
TaskGroup.create().done(log) // should done fire here? what results should it contain?
// perhaps: no, it should be queued, and wait for run
// we should add a way to detect that it never run

// success: done then run with no tasks
TaskGroup.create().done(log).run()  // should done fire here? what results should it contain?
// perhaps: yes, the run should complete with no items, and put the taskgroup in a completed state, executing the done listener
// expected result would be: [null, []]

// success: run then done with no tasks
TaskGroup.create().run().done(log)  // should done fire here? what results should it contain?
// perhaps: yes, the run should complete with no items, and put the taskgroup in a completed state, which done then sees and executes log right away
// expected result would be: [null, []]

// success: done then task, repeat, run, done
TaskGroup.create()
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: no, it should be queued under nextTick, giving adds a chance
	// expected result would be: [null, [[null, 5], [null, 10], [null, 15]]]
	.addTask(result(5))
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: no, it should be queued under nextTick, giving adds a chance
	// expected result would be: [null, [[null, 5], [null, 10], [null, 15]]]
	.addTask(result(10))
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: no, it should be queued under nextTick, giving adds a chance
	// expected result would be: [null, [[null, 5], [null, 10], [null, 15]]]
	.addTask(result(15))
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: no, it should be queued under nextTick, giving adds a chance
	// expected result would be: [null, [[null, 5], [null, 10], [null, 15]]]
	.run()  // this should be under process.nextTick to ensure all tasks have been added in our current tick
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: yes, but it should be queued under nextTick, giving adds a chance
	// expected result would be: [null, [[null, 5], [null, 10], [null, 15]]]

// success: multile runs
var tasks = TaskGroup.create()
	.run()
	.addTask(result(5))
	.done(log)  // should done fire here? what results should it contain?
	// perhaps: yes
	// expected result would be: [null, [[null, 5]]]
setTimeout(function(){
	tasks
		.addTask(result(10))
		.done(log)  // should done fire here? what results should it contain?
		// perhaps: yes, task group should keep executing?
		// expected result would be: [null, [[null, 10]]]
}, 1000)

// success: resume after error
TaskGroup.create()
	.run()
	.addTask(result(5))
	.addTask(error('fail after 5'))
	.addTask(result(10))
	.done(log)
	// expected result would be: ['fail after 5', [[null, 5], ['fail after 5']]]

	.run()
	.done(log)
	// expected result would be: [null, [[null, 10]]]


// ====================================
// FAQ

// Should task and taskgroups destroy once completed?
// No. It would destroy the ability to resume a taskgroup, add more things to it, etc

// Should taskgroups pause on error?
// Yes.

// How should pausing work?
// We should log the first error that occurs, stop executing remaning tasks, wait for running tasks to complete, and fire done with the results

// Should taskgroups continue after initial completion if more things are added? And should run have to be called again?
// Yes. No, they should keep running. Run should only have to be called again if the taskgroup paused due to an error.
// Is this a good idea? It's useful in some cases such as runners, but in others I can see it being an issue that is difficult to debug.
// Perhaps TaskGroup should fail if completed or run multiple times, and a new taskrunner subclass will keep running?
// At this point in time, the perceived downside of this if theoretical, and could be accomplished in a later version if needed
// Plus if they desire this, they could always wrap the taskgroup in a task

// Should tasks be able to run multiple times?
// No.

// Should taskgroups be able to run multiple times?
// If run is called when it is already running, it should be discarded.

// What does done mean for tasks?
// It means execution completed (success or failure) on the task

// What does done mean for taskgroups?
// It means execution has started, and there is no more remaning or executing tasks
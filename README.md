
<!-- TITLE/ -->

# TaskGroup

<!-- /TITLE -->


<!-- BADGES/ -->

[![Build Status](http://img.shields.io/travis-ci/bevry/taskgroup.png?branch=master)](http://travis-ci.org/bevry/taskgroup "Check this project's build status on TravisCI")
[![NPM version](http://badge.fury.io/js/taskgroup.png)](https://npmjs.org/package/taskgroup "View this project on NPM")
[![Gittip donate button](http://img.shields.io/gittip/bevry.png)](https://www.gittip.com/bevry/ "Donate weekly to this project using Gittip")
[![Flattr donate button](http://img.shields.io/flattr/donate.png?color=yellow)](http://flattr.com/thing/344188/balupton-on-Flattr "Donate monthly to this project using Flattr")
[![PayPayl donate button](http://img.shields.io/paypal/donate.png?color=yellow)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QB8GQPZAH84N6 "Donate once-off to this project using Paypal")

<!-- /BADGES -->


<!-- DESCRIPTION/ -->

Group together synchronous and asynchronous tasks and execute them with support for concurrency, naming, and nesting.

<!-- /DESCRIPTION -->


<!-- INSTALL/ -->

## Install

### [Node](http://nodejs.org/), [Browserify](http://browserify.org/)
- Use: `require('taskgroup')`
- Install: `npm install --save taskgroup`

### [Ender](http://ender.jit.su/)
- Use: `require('taskgroup')`
- Install: `ender add taskgroup`

<!-- /INSTALL -->


## Usage

`taskgroup` provides two classes, `Task` and `TaskGroup`. A single task can be
created like that:

``` javascript
var Task = require('taskgroup').Task

var task = new Task(function () {
  // Do something ...
  console.log('Done');
});

// execute the task
task.run();
```

Task groups bundle several tasks:

``` javascript
var TaskGroup = require('taskgroup').TaskGroup

var group = new TaskGroup();

group.addTask(function () {
  // Do something
  console.log('First Task');
});

group.addTask(function () {
  // Do something
  console.log('Second Task');
});

group.run();
```

It's also possible to nest task groups.

``` javascript
var group = new TaskGroup();

group.addTask(function () {
  // Do something
  console.log('First Task');
});

group.addGroup(function () {
  // `this` is bound to the sub task group
  this.addTask(function () {
    // do some work
    console.log('Nested task')
  });
});

group.run();
```

Tasks can be either synchronous or asynchronous. To make a task asynchronous,
you have to hand it a callback function as an argument and call it at some
point in your task function. Please note that its important to call the `next`
callback in asynchronous tasks. If you forget to call it, then task group will
not proceed to any other following tasks.

``` javascript
var group = new TaskGroup();

group.addTask(function (next) {
  // Do something
  setTimeout(function () {
    console.log('First Task');
    next(null, 'some', 'data');
  }, 500);
});

group.addTask(function (next) {
  // Do something
  setTimeout(function () {
    console.log('Second Task');
    next(null, 'some', 'other', 'data');
  }, 1000)
});

group.run();
```

Both, `Task` and `TaskGroup` will fire a `complete` event when they finished.
You can use that event to collect the results from your different tasks.
Synchronous tasks can simply return their result, asynchronous tasks hand them
to the next callback handler. There are more events, which you can find in the
API documentation below.

``` javascript
// Create our new group
var group = new TaskGroup();

// Add a synchronous task that returns the result
group.addTask(function(){
  return 'first task';
});

group.addGroup(function(addGroup, addTask){
  // Add an asynchronous task that gives its result to the completion callback
  addTask(function (next){
    setTimeout(function(){
      next(null, 'sub first', 'task');
    },500);
  });
});

// Define what should happen once the group has completed
group.once('complete', function(err, results){
  console.log(JSON.stringify(results));
  // [[null, 'first task'],
  //  [null, [
  //    [null, 'sub first', 'task']
  //  ]]]
});

// Execute our group
group.run();
```

Tasks can be run either as a series, in parallel or in parallel but only with a
certain amount of tasks at once. The concurrency behaviour of a task is set
using `group.setConfig`.

- `group.setConfig({concurrency: 0})` - Run tasks in parallel.
- `group.setConfig({concurrency: 1})` - Run one task at a time (series).
- `group.setConfig({concurrency: X})` - Run in parallel, but at most X tasks in
  parallel.

The following example executes all tasks in series. The nested task group
itself is executed in parallel.

``` javascript
var group = new TaskGroup();

// Execute this group in series. Tasks are executed in order they have been
// declared.
group.setConfig({concurrency: 1});

group.addTask(function () {
  console.log('Running first task outside of group.');
});

group.addGroup(function (){
  // Tell this sub-group to execute in parallel.
  this.setConfig({concurrency: 0});

  this.addTask(function (next){
    setTimeout(function(){
      console.log('Running asynchronous task in group.')
      next(null);
    },500);
  });

  this.addTask(function (){
    console.log("Running synchronous task in group.")
  });
});

group.addTask(function () {
  console.log('Running second task outside of group.');
});

group.run()
```

### TaskGroup API

``` javascript
new (require('taskgroup')).TaskGroup()
```

- Available methods:
	- `constructor(name?,fn?)` - create our new group, arguments can be a String for `name`, an Object for `config`, and a Function for `next`
	- `setConfig(config)` - set the configuration for the group, returns chain
	- `getconfig()` - return the set configuration
	- `addTask(args...)`, `addTasks(tasks, args..)`  - create a new task item with the arguments and adds it to the group, returns the new task item(s)
	- `addGroup(args...)`, `addGroups(groups, args..)` - create a new group item with the arguments and adds it to the group, returns the new group item(s)
	- `addItem(item)`, `addItem(items)`  - adds the items to the group, returns the item(s)
	- `getTotals()` - returns counts for the following `{running,remaining,completed,total}`
	- `clear()` - remove the remaining items to be executed
	- `pause()` - pause the execution of the items
	- `stop()` - clear and pause
	- `exit(err)` - stop and complete, `err` if specified is sent to the completion event when fired
	- `complete()` - will fire the completion event if we are already complete, useful if you're binding your listeners after run
	- `run()` - start/resume executing the items, returns chain
	- All those of [EventEmitter2](https://github.com/hij1nx/EventEmitter2)
- Available configuration:
	- `name`, no default - allows us to assign a name to the group, useful for debugging
	- `method(addGroup, addTask, complete?)`, no default - allows us to use an inline and self-executing style for defining groups, useful for nesting
	- `concurrency`, defaults to `1` - how many items shall we allow to be run at the same time, set to `0` to allow unlimited
	- `pauseOnError`, defaults to `true` - if an error occurs in one of our items, should we stop executing any remaining items?
		- setting to `false` will continue with execution with the other items even if an item experiences an error
	- `items` - alias for  `.addTasks(items)`
	- `groups` - alias for  `.addGroups(groups)`
	- `tasks` - alias for  `.addTasks(tasks)`
	- `next` - alias for  `.once('complete', next)`
- Available events:
	- `run()` - fired just before we execute the items
	- `complete(err, results)` - fired when all our items have completed
	- `task.run(task)` - fired just before a task item executes
	- `task.complete(task, err, args...)` - fired when a task item has completed
	- `group.run(group)` - fired just before a group item executes
	- `group.complete(group, err, results)` - fired when a group item has completed
	- `item.run(item)` - fired just before an item executes (fired for both sub-tasks and sub-groups)
	- `item.complete(item, err, args...)` - fired when an item has completed (fired for both sub-task and sub-groups)


### Task API

``` javascript
new (require('taskgroup')).Task()
```

- Available methods:
	- `constructor(args...)` - create our new task, arguments can be a String for `name`, an Object for `config`, and a Function for `next`
	- `setConfig(config)` - set the configuration for the group, returns chain
	- `getconfig()` - return the set configuration
	- `complete()` - will fire the completion event if we are already complete, useful if you're binding your listeners after run
	- `run()` - execute the task
- Available configuration:
	- `name`, no default - allows us to assign a name to the group, useful for debugging
	- `method(complete?)`, no default - must be set at some point, it is the function to execute for the task, if it is asynchronous it should use the completion callback provided
	- `args`, no default - an array of arguments that you would like to precede the completion callback when executing `fn`
	- `next` - alias for  `.once('complete', next)`
- Available events:
	- `run()` - fired just before we execute the task
	- `complete(err, args...)` - fired when the task has completed


## Comparison with [Async.js](https://github.com/caolan/async)

The biggest advantage and difference of TaskGroup over async.js is that TaskGroup has one uniform API to rule them all, whereas with async.js I found that I was always having to keep referring to the async manual to try and figure out which is the right call for my use case then somehow wrap my head around the async.js way of doing things (which more often than not I couldn't), whereas with TaskGroup I never have that problem as it is one consistent API for all the different use cases.

Let's take a look at what the most common async.js methods would look like in TaskGroup:

``` javascript
// ====================================
// Series

// Async
async.series([
	function(){},
	function(callback){callback();}
], next);

// TaskGroup
new TaskGroup({
	tasks: [
		function(){},
		function(callback){callback();}
	],
	next: next
}).run();


// ====================================
// Parallel

// Async
async.parallel([
	function(){},
	function(callback){callback();}
], next);

// TaskGroup
new TaskGroup({
	concurrency: 0,
	tasks: [
		function(){},
		function(callback){callback();}
	],
	next: next
}).run();

// ====================================
// Map

// Async
async.map(['file1','file2','file3'], fs.stat, next);

// TaskGroup
new TaskGroup({
	concurrency: 0,
	tasks: ['file1', 'file2', 'file3'].map(function(file){
		return function(complete){
			fs.stat(file, complete);
		}
	}),
	next: next
}).run();
```

Another big advantage of TaskGroup over async.js is TaskGroup's ability to add tasks to the group once execution has already started - this is a common use case when creating an application that must perform it's actions serially, so using TaskGroup you can create a serial TaskGroup for the application, run it right away, then add the actions to the group as tasks.

A final big advantage of TaskGroup over async.js is TaskGroup's ability to do nested groups, this allowed us to created the [Joe Testing Framework & Runner](https://github.com/bevry/joe) incredibly easily, and because of this functionality Joe will always know which test (task) is associated to which suite (task group), whereas test runners like mocha have to guess (they add the task to the last group, which may not always be the case! especially with dynamically created tests!).


<!-- HISTORY/ -->

## History
[Discover the change history by heading on over to the `History.md` file.](https://github.com/bevry/taskgroup/blob/master/History.md#files)

<!-- /HISTORY -->


<!-- CONTRIBUTE/ -->

## Contribute

[Discover how you can contribute by heading on over to the `Contributing.md` file.](https://github.com/bevry/taskgroup/blob/master/Contributing.md#files)

<!-- /CONTRIBUTE -->


<!-- BACKERS/ -->

## Backers

### Maintainers

These amazing people are maintaining this project:

- Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)

### Sponsors

No sponsors yet! Will you be the first?

[![Gittip donate button](http://img.shields.io/gittip/bevry.png)](https://www.gittip.com/bevry/ "Donate weekly to this project using Gittip")
[![Flattr donate button](http://img.shields.io/flattr/donate.png?color=yellow)](http://flattr.com/thing/344188/balupton-on-Flattr "Donate monthly to this project using Flattr")
[![PayPayl donate button](http://img.shields.io/paypal/donate.png?color=yellow)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QB8GQPZAH84N6 "Donate once-off to this project using Paypal")

### Contributors

These amazing people have contributed code to this project:

- Benjamin Lupton <b@lupton.cc> (https://github.com/balupton) - [view contributions](https://github.com/bevry/taskgroup/commits?author=balupton)
- sfrdmn (https://github.com/sfrdmn) - [view contributions](https://github.com/bevry/taskgroup/commits?author=sfrdmn)

[Become a contributor!](https://github.com/bevry/taskgroup/blob/master/Contributing.md#files)

<!-- /BACKERS -->


<!-- LICENSE/ -->

## License

Licensed under the incredibly [permissive](http://en.wikipedia.org/wiki/Permissive_free_software_licence) [MIT license](http://creativecommons.org/licenses/MIT/)

Copyright &copy; 2013+ Bevry Pty Ltd <us@bevry.me> (http://bevry.me)
<br/>Copyright &copy; 2011-2012 Benjamin Lupton <b@lupton.cc> (http://balupton.com)

<!-- /LICENSE -->



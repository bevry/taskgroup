# Task Group [![Build Status](https://secure.travis-ci.org/bevry/taskgroup.png?branch=master)](http://travis-ci.org/bevry/taskgroup)
Group together synchronous and asynchronous tasks and execute them, supports nested groups, naming, and concurrency



## Install

### Backend

1. [Install Node.js](http://bevry.me/node/install)
2. `npm install --save taskgroup`

### Frontend

1. [See Browserify](http://browserify.org/)



## Usage

### TaskGroup

#### Example

``` coffeescript
# Import
{TaskGroup} = require('taskgroup')

# Create our group
group = new TaskGroup().once 'complete', (err,results) ->
	console.log(err)  # null
	console.log(JSON.stringify results)
	###
	[
		[null, 'first'],
		[null, 'second'],
		[null, [
			[null, 'sub second'],
			[null, 'sub first']
		]]
	]
	###

# Add an asynchronous task
group.addTask (complete) ->
	setTimeout(
		-> complete(null, 'first')
		500
	)

# Add a synchronous task
group.addTask ->
	return 'second'

# Add a group
group.addGroup (addGroup,addTask) ->
	# Tell this sub group to execute in parallel
	@setConfig({concurrency:0})

	# Add an asynchronous task
	@addTask (complete) ->
		setTimeout(
			-> complete(null, 'sub first')
			1000
		)

	# Add a synchronous task
	@addTask ->
		return 'sub second'

# Execute the items in the group
group.run()
```

#### Notes

- Available methods:
	- `constructor(name?,fn?)` - create our new group
		- `name` is optional, allows us to assign a name to the group, useful for debugging
		- `fn(addGroup,addTask)` is optional, allows us to use an inline and self-executing style for defining groups, useful for nesting
	- `setConfig(config)` - set the configuration for the group, returns chain
	- `addTask(args...)` - create a new task item with the arguments and adds it to the group, returns the new task item
	- `addGroup(args...)` - create a new group item with the arguments and adds it to the group, returns the new group item
	- `clear()` - remove the remaining items to be executed
	- `stop()` - clear and pause
	- `pause()` - pause the execution of the items
	- `run()` - start/resume executing of the items, returns chain
	- All those of [EventEmitter2](https://github.com/hij1nx/EventEmitter2)
- Available configuration:
	- `concurrency`, defaults to `1` - how many items shall we allow to be run at the same time, set to `0` to allow unlimited
	- `pauseOnError`, defaults to `true` - if an error occurs in one of our items, should we stop executing any remaining items?
		- setting to `false` will continue with execution with the other items even if an item experiences an error
- Available events:
	- `run()` - fired just before we are about to execute the items
	- `complete(err, results)` - fired when all our items have completed
	- `task.run()` - fired just before a task item is about to execute
	- `task.complete(err, args...)` - fired when a task item has completed
	- `group.run()` - fired just before a group item is about to execute
	- `group.complete(err, results)` - fired when a group item has completed
	- `item.run()` - fired just before an item is about to execute (fired for both sub-tasks and sub-groups)
	- `item.complete(err, args...)` - fired when an item has completed (fired for both sub-task and sub-groups)

## History
You can discover the history inside the [History.md](https://github.com/bevry/taskgroup/blob/master/History.md#files) file



## License
Licensed under the incredibly [permissive](http://en.wikipedia.org/wiki/Permissive_free_software_licence) [MIT License](http://creativecommons.org/licenses/MIT/)
<br/>Copyright © 2013+ [Bevry Pty Ltd](http://bevry.me)
<br/>Copyright © 2011-2012 [Benjamin Arthur Lupton](http://balupton.com)

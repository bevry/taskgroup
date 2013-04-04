# Task Group [![Build Status](https://secure.travis-ci.org/bevry/taskgroup.png?branch=master)](http://travis-ci.org/bevry/taskgroup)
Group together synchronous and asynchronous tasks and execute them in either serial or parallel



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
tasks = new TaskGroup().once 'complete', (err,results) ->
	console.log(err)  # null
	console.log(results)  # [[null,10],[null,5]]

# Add an asynchronous task
tasks.addTask (complete) ->
	setTimeout(
		-> complete(null,5)
		500
	)

# Add a synchronous task
tasks.addTask ->
	return 10

# Fire the tasks
tasks.run()
```

#### Notes

- Available methods are:
	- `setConfig(config)` - sets the configuration for the group
	- `clear()` - clears remaining items
	- `run()` - starts executing of the tasks
	- All those of [EventEmitter2](https://github.com/hij1nx/EventEmitter2)
- Available configuration is:
	- `concurrency`, defaults to `0` - how many items to run at the same time
	- `pauseOnError`, defaults to `true` - if an error occurs in one of our items, should we stop executing any remaining items?
		- setting to `false` will continue with execution with the other items even if an item experiences an error
	- `pauseOnExit`, defaults to `true` - if we have completed, should we stop executing any future items?
		- setting to `false` allows you to add more items that will execute right away, even after the first batch have completed
- Available events are:
	- `run()` - fired just before we are about to execute
	- `complete(err, results)` - fired when all our items have completed
	- `task.run()` - fired just before a sub-task is about to execute
	- `task.complete(err, args...)` - fired when a sub-task have completed
	- `group.run()` - fired just before a sub-group is about to execute
	- `group.complete(err, results)` - fired when all a sub-groups items have completed
	- `item.run()` - fired just before an item is about to execute (fired for both sub-tasks and sub-groups)
	- `item.complete(err, args...)` - fired when an item has completed (fired for both sub-task and sub-groups)

## History
You can discover the history inside the [History.md](https://github.com/bevry/taskgroup/blob/master/History.md#files) file



## License
Licensed under the incredibly [permissive](http://en.wikipedia.org/wiki/Permissive_free_software_licence) [MIT License](http://creativecommons.org/licenses/MIT/)
<br/>Copyright © 2013+ [Bevry Pty Ltd](http://bevry.me)
<br/>Copyright © 2011-2012 [Benjamin Arthur Lupton](http://balupton.com)

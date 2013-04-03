# Task Group [![Build Status](https://secure.travis-ci.org/bevry/taskgroup.png?branch=master)](http://travis-ci.org/bevry/taskgroup)
Group together synchronous and asynchronous tasks and execute them in either serial or parallel



## Install

### Backend

1. [Install Node.js](http://bevry.me/node/install)
2. `npm install --save taskgroup`

### Frontend

1. [See Browserify](http://browserify.org/)



## Usage

### Example

``` coffeescript
# Import
{TaskGroup} = require('taskgroup')

# Create our group
tasks = new TaskGroup().setConfig(
	concurrency: 0  # unlimited at once
	pauseOnExit: true
	pauseOnError: true
).on 'complete', (err,results) ->
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


## History
You can discover the history inside the [History.md](https://github.com/bevry/taskgroup/blob/master/History.md#files) file



## License
Licensed under the incredibly [permissive](http://en.wikipedia.org/wiki/Permissive_free_software_licence) [MIT License](http://creativecommons.org/licenses/MIT/)
<br/>Copyright © 2013+ [Bevry Pty Ltd](http://bevry.me)
<br/>Copyright © 2011-2012 [Benjamin Arthur Lupton](http://balupton.com)

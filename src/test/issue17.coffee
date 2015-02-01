{Task,TaskGroup} = require('../../')
{wait} = require('./util')

myTask = new Task (complete) ->
	complete()

myTask.done (err) ->
	throw new Error('goodbye world')

myTask.run()

backup = wait 1000, ->
	throw new Error("world still exists! this shouldn't have happend")
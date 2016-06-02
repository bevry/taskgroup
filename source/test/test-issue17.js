const {Task} = require('../../')

const myTask = new Task(function (complete) {
	complete()
})

myTask.done(function () {
	throw new Error('goodbye world')
})

myTask.run()

setTimeout(function () {
	throw new Error("world still exists! this shouldn't have happend")
}, 1000)

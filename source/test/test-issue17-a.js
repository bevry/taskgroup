const {Task} = require('../')

Task
	.create({domain: true}, function (complete) {
		complete()
	})
	.done(function () {
		throw new Error('goodbye world')
	})
	.run()

setTimeout(function () {
	throw new Error("world still exists! this shouldn't have happend")
}, 1000)

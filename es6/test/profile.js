'use strict'

let TaskGroup = require('../../')
let util = require('./util')
let mode = 'profile'
let testname = 'taskgroup-profile-test'

// PRepare tests
let testArray = Array(1000).join().split(',')
if ( mode === 'profile' ) util.startProfile(testname)

// Let's do it
let tasks = TaskGroup.create()

testArray.forEach(function(value, index) {
	let name = 'Task '+index
	tasks.addTask(name, function() {
		return 'Value '+index
	})
})

tasks.done(function(){
	if ( mode === 'heap ') {
		util.saveSnapshot(testname)
	} else {
		setTimeout(function(){
			util.stopProfile(testname)
		}, 2000)
	}
})

tasks.run()

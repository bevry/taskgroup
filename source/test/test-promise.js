'use strict'

const joe = require('joe')
const { delay, bump, bumped } = require('./test-util')
const { Task, TaskGroup } = require('../')

joe.suite('promises', function (suite, test) {
	test('task can return promise', function (done) {
		const checks = {}
		const b1 = bump(checks), b2 = bump(checks)
		new Task(function () {
			return new Promise(function (resolve) {
				setTimeout(function () {
					b1()
					resolve()
				}, delay)
			})
		}).done(b2).run()
		bumped(checks, done)
	})

	test('taskgroup can add promise', function (done) {
		new TaskGroup().addPromise(new Promise(function (resolve) {
			setTimeout(function () {
				resolve('resolved after 5 seconds')
			}, 5000)
		})).done(done)
	})

	test('taskgroup can return promise', function (done) {
		new TaskGroup(function (addGroup, addTask) {
			/* eslint no-new:0 */
			new Promise(function (resolve) {
				setTimeout(function () {
					addTask(() => 'added task after 5 seconds')
					resolve('resolved after 5 seconds')
				}, 5000)
			})
		}).done(done)
	})
})

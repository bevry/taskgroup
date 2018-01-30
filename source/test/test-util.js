'use strict'

// Import
const { equal, errorEqual } = require('assert-helpers')

// Prepare
const delay = 100

// Make setTimeout a lot nicer
function wait (delay, fn) {
	return setTimeout(fn, delay)
}


function bump (checks, next) {
	if (checks.i == null) checks.i = 0
	if (checks.n == null) checks.n = 0
	++checks.n
	return (err) => {
		++checks.i
		if (err) {
			checks.error = err
		}
		if (next) {
			next(err)
		}
	}
}

function bumped (checks, next) {
	if (checks.i == null) checks.i = 0
	if (checks.n == null) checks.n = 0
	if (checks.e == null) checks.e = null
	if (checks.t == null) checks.t = null
	if (checks.d == null) checks.d = delay
	wait(checks.d, () => {
		errorEqual(checks.error || null, null, 'checks ran without error')
		if (checks.e != null) {
			equal(checks.i, checks.e, 'ran checks equals expected checks')
		}
		else {
			equal(checks.i, checks.n, 'ran checks equals created checks')
		}
		if (checks.t != null) {
			equal(checks.n, checks.t, 'created checks equals total checks')
		}
		if (next) next()
	})
}


// Exports
module.exports = {wait, delay, bump, bumped}

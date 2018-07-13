'use strict'

// Make setTimeout a lot nicer
function wait (delay, fn) {
	return setTimeout(fn, delay)
}

// Exports
module.exports = { wait }

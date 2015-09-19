// Prepare
const hasMap = typeof Map !== 'undefined'

// Domains are crippled in the browser and on node 0.8, so don't use domains in those environments
export const domain = (process.browser || process.versions.node.substr(0, 3) === '0.8') ? null : require('domain')

// Make setTimeout a lot nicer
export function wait (delay, fn) {
	setTimeout(fn, delay)
}

// Cross-platform (node 0.10+, node 0.8+, browser) compatible setImmediate
export const queue = (global || window).setImmediate || (process && process.nextTick) || function (fn) {
	setTimeout(fn, 0)
}

// Convert an error to a string
export function errorToString (error) {
	if ( !error ) {
		return null
	}
	else if ( error.stack ) {
		return error.stack.toString()
	}
	else if ( error.message ) {
		return error.message.toString()
	}
	else {
		return error.toString()
	}
}

// Iterate an object or a map fast
export function iterateObject (obj, iterator) {
	if ( obj ) {
		if ( hasMap && obj instanceof Map ) {  // performance of this is neglible
			obj.forEach(iterator)
		}
		else {
			let key
			for ( key in obj ) {
				if ( obj.hasOwnProperty(key) ) {
					iterator(obj[key], key)
				}
			}
		}
	}
}

// Copy all items from an object into another object
export function copyObject (obj1, obj2) {
	if ( obj2 ) {
		iterateObject(obj2, function (value, key) {
			obj1[key] = value
		})
	}
}

// Ensure that the passed array is actually an array
export function ensureArray (arr) {
	if ( !Array.isArray(arr) ) arr = [arr]
	return arr
}

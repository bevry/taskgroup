// Import
const ambi = require('ambi')
const csextends = require('csextends')
const EventEmitter = require('events').EventEmitter /* .EventEmitter for Node 0.8 compatability */
// Domains are crippled in the browser and on node 0.8, so don't use domains in those environments
const domain = (process.browser || process.versions.node.substr(0, 3) === '0.8') ? null : require('domain')
const hasMap = typeof Map !== 'undefined'

// ====================================
// Helpers

// Make setTimeout a lot nicer
const wait = (delay, fn) => setTimeout(fn, delay)

// Cross-platform (node 0.10+, node 0.8+, browser) compatible setImmediate
const queue = (global || window).setImmediate || (process && process.nextTick) || function (fn) {
	setTimeout(fn, 0)
}

// Convert an error to a string
const errorToString = function (error) {
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

// Copy all items from an object into another object
const copyObject = function (obj1, obj2) {
	if ( obj2 ) {
		iterateObject(obj2, function (value, key) {
			obj1[key] = value
		})
	}
}

// Iterate an object or a map fast
const iterateObject = function (obj, iterator) {
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

// Ensure that the passed array is actually an array
const ensureArray = function (arr) {
	if ( !Array.isArray(arr) ) arr = [arr]
	return arr
}


// =====================================
// BaseEventEmitter

// Internal: Base class containing common functionality for {Task} and {TaskGroup}.
class BaseEventEmitter extends EventEmitter {
	// Public: A helper method to create a new subclass with our extensions.
	//
	// extensions - An {Object} of extensions to apply to the new subclass
	//
	// Returns the new sub {Class}
	static subclass (...args) {
		return csextends.apply(this, args)
	}

	// Public: Creates a new {SubClass} instance.
	//
	// args - The Arguments to be forwarded along to the {::constructor}.
	//
	// Returns the new {SubClass} instance.
	static create (...args) {
		return new this(...args)
	}

	// Adds support for the done event while
	// ensuring that errors are always handled correctly.
	//
	// It does this by listening to the `error` and `completed` events,
	// and when the emit, we check if there is a `done` listener:
	// - if there is, then emit the done event with the original event arguments
	// - if there isn't, then output the error to stderr and throw it.
	constructor () {
		super()

		// Add support for the done event
		// If we do have an error, then throw it if there is no existing or done listeners
		this.on('error', (error) => {
			// has done listener, forward to that
			if ( this.listeners('done').length !== 0 ) {
				this.emit('done', error)
			}

			// has error, but no done listener and no event listener, throw error
			else if ( error && this.listeners('error').length === 1 ) {
				// this isn't good enough, throw the error
				console.error(errorToString(error))
				throw error
			}
		})

		this.on('completed', (...args) => {
			// Prepare
			const error = args[0]

			// has done listener, forward to that
			if ( this.listeners('done').length !== 0 ) {
				this.emit('done', ...args)
			}

			// has error, but no done listener and no event listener, throw error
			else if ( error && this.listeners('completed').length === 1 ) {
				// this isn't good enough, emit the error
				this.emit('error', error)
			}
		})

	}

	// Internal: Fire our completion event.
	complete () {
		const error = new Error('interface should provide this')
		this.emit('error', error)
		return this
	}

	// Public: Attaches the listener to the `done` event to be emitted each time.
	//
	// listener - The {Function} to attach to the `done` event.
	whenDone (listener) {
		// check if we have a listener
		if ( typeof listener === 'function' ) {
			this.on('done', listener.bind(this))
		}

		// Chain
		return this
	}

	// Public: Attaches the listener to the `done` event to be emitted only once, then removed to not fire again.
	//
	// listener - The {Function} to attach to the `done` event.
	onceDone (listener) {
		// check if we have a listener
		if ( typeof listener === 'function' ) {
			this.once('done', listener)
		}

		// Chain
		return this
	}

	// Public: Alias for {::onceDone}
	done (listener) {
		return this.onceDone(listener)
	}

	// Public: Get our name with all of our parent names into a {String} or {Array}.
	//
	// opts - The options
	//        :format - (default: 'string') A {String} that determines the format that we return, when `string` it will output a string of all our names, when `array` it will return the names as an array
	//        :seperator - (default: ' ➞  ') A {String} that is used to join our array when returning a joined {String}
	//
	// Returns either a joined {String} or an {Array} based on the value of the `format` option.
	get namesArray () {
		// Fetch
		const names = [], name = this.name, parent = this.config.parent
		if ( parent )  names.push(...parent.namesArray)
		if ( name )  names.push(name)

		// Return
		return names
	}

	get names () {
		return this.namesArray.join(' ➞  ')
	}

	// Public: Get the name of our instance.
	//
	// If the name was never configured, then return the name in the format of
	// `'#{this.type} #{Math.random()}'` to output something like `task 0.2123`
	//
	// Returns the configured name {String}.
	get name () {
		return this.config.name || `${this.type} ${Math.random()}`
	}

	// Queue
	queue (fn) {
		// If synchronous, execute immediately
		if ( this.config.sync ) fn()
		// Otherwise, execute at the next tick
		else queue(fn)

		// Chain
		return this
	}

}

// =====================================

// Public: Our Task Class.
//
// Available configuration is documented in {::setConfig}.
//
// Available events:
//
//  - `started()` - emitted when we start execution
//  - `running()` - emitted when the method starts execution
//  - `failed(error)` - emitted when execution exited with a failure
//  - `passed()` - emitted when execution exited with a success
//  - `completed(error, ...resultArguments)` - emitted when execution exited, `resultArguments` are the result arguments from the method
//  - `error(error)` - emtited if an unexpected error occurs without ourself
//  - `done(error, ...resultArguments)` - emitted when either execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
//
// Available internal statuses:
//
//  - `null` - execution has not yet started
//  - `'started'` - execution has begun
//  - `'running'` - execution of our method has begun
//  - `'failed'` - execution of our method has failed
//   - `'passed'` - execution of our method has succeeded
//  - `'destroyed'` - we've been destroyed and can no longer execute
//
// Examples
//
//  task = require('taskgroup').Task.create('my synchronous task', ->
//    return 5
//  ).done(console.info) // null, 5]
//
//  task = require('taskgroup').Task.create('my asynchronous task', (complete) ->
//    complete(null, 5)
//  ).done(console.info) // [null, 5]
//
//  task = require('taskgroup').Task.create('my task that errors', ->
//    error = new Error('deliberate error')
//    return error  // if asynchronous, can also do: complete(error)
//    // thrown and uncaught errors are also caught thanks to domains, but that should be avoided
//    // as it would put your app in an unknown state
//  ).done(console.info) // [Error('deliberator error')]
class Task extends BaseEventEmitter {
	// Internal: The type of our class for the purpose of duck typing
	// which is needed when working with node virtual machines
	// as instanceof will not work in those environments.
	get type () { return 'task' }

	// Public: A helper method to check if the passed argument is an instanceof a {Task}.
	//
	// item - The possible instance of the {Task} that we want to check
	//
	// Returns a {Boolean} of whether or not the item is a {Task} instance.
	static isTask (item) {
		return (item && item.type === 'task') || (item instanceof Task)
	}

	// Public: Have we started execution yet?
	//
	// Returns a {Boolean} which is `true` if we have commenced execution
	get started () {
		return this.state.status != null
	}

	// Public: Have we finished its execution yet?
	//
	// Returns a {Boolean} which is `true` if we have finished execution
	get exited () {
		switch ( this.state.status ) {
			case 'completed':
			case 'destroyed':
				return true

			default:
				return false
		}
	}

	// Public: Have we been destroyed?
	//
	// Returns a {Boolean} which is `true` if we have bene destroyed
	get destroyed () {
		return this.state.status === 'destroyed'
	}

	// Public: Have we completed its execution yet?
	//
	// Returns a {Boolean} which is `true` if we have completed
	get completed () {
		switch ( this.state.status ) {
			case 'failed':
			case 'passed':
			case 'destroyed':
				return true

			default:
				return false
		}
	}

	// -----------------------------------
	// @TODO Decide if the following is still needed

	// Internal: The first {Error} that has occured.
	get error () { return this.state.error }

	// Internal: A {String} containing our current status. See our {Task} description for available values.
	get status () { return this.state.status }

	// Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	get events () { return this.state.events }

	// Internal: An {Array} of the result arguments of our method.
	// The first item in the array should be the {Error} if it exists.
	get result () { return this.state.result }

	// Internal: The {Domain} that we create to capture errors for our method.
	get taskDomain () { return this.state.taskDomain }

	// Public: Initialize our new {Task} instance. Forwards arguments onto {::setConfig}.
	constructor (...args) {
		// Initialise BaseEventEmitter
		super()

		// Data
		this.state = {
			error: null,
			status: null,
			events: ['events', 'error', 'started', 'running', 'failed', 'passed', 'completed', 'done', 'destroyed']
		}

		// Configuration
		this.config = {
			run: false,
			onError: 'exit',
			ambi: true,
			domain: true,
			sync: false,
			args: null
		}

		// Apply configuration
		this.setConfig(...args)
	}

	// Public: Set the configuration for our instance.
	//
	// Despite accepting an {Object} of configuration, we can also accept an {Array} of configuration.
	// When using an array, a {String} becomes the :name, a {Function} becomes the :method, and an {Object} becomes the :config
	//
	// config - Our configuration {Object} can contain the following fields:
	//   :name - (default: null) A {String} for what we would like our name to be, useful for debugging.
	//   :done - (default: null) A {Function} that we would like passed to {::onceDone} (aliases are :onceDone, and :next)
	//   :whenDone - (default: null) A {Function} that we would like passed to {::whenDone}
	//   :on - (default: null) An {Object} of (eventName => listener) that we would like bound via EventEmitter.on.
	//   :once - (default: null) An {Object} of (eventName => listener) that we would like bound via EventEmitter.once.
	//   :method - (default: null) The {Function} that we would like to execute within our task.
	//   :parent - (default: null) A parent {TaskGroup} that we may be attached to.
	//   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` duplicate run errors are not reported, useful when combined with the timeout option.
	//   :args - (default: null) An {Array} of arguments that we would like to forward onto our method when we execute it.
	//   :timeout - (default: null) A {Number} of millesconds that we would like to wait before timing out the method.
	//   :ambi - (default: true) A {Boolean} for whether or not to use bevry/ambi to determine if the method is asynchronous or synchronous and execute it appropriately
	//   :domain - (default: true) A {Boolean} for whether or not to wrap the task execution in a domain to attempt to catch background errors (aka errors that are occuring in other ticks than the initial execution)
	//   :sync - (default: false) A {Boolean} for whether or not we should execute certain calls asynchronously (`false`) or synchronously (`true`)
	setConfig (...args) {
		const opts = {}

		// Extract the configuration from the arguments
		args.forEach(function (arg) {
			if ( arg == null )  return
			const type = typeof arg
			switch ( type ) {
				case 'string':
					opts.name = arg
					break
				case 'function':
					opts.method = arg
					break
				case 'object':
					copyObject(opts, arg)
					break
				default:
					const error = new Error(`Unknown argument type of [${type}] given to Task::setConfig()`)
					throw error
			}
		})

		// Apply the configuration directly to our instance
		iterateObject(opts, (value, key) => {
			if ( value == null )  return
			switch ( key ) {
				case 'on':
					iterateObject(value, (value, key) => {
						if ( value ) this.on(key, value)
					})
					break

				case 'once':
					iterateObject(value, (value, key) => {
						if ( value ) this.once(key, value)
					})
					break

				case 'whenDone':
					this.whenDone(value)
					break

				case 'onceDone':
				case 'done':
				case 'next':
					this.onceDone(value)
					break

				default:
					this.config[key] = value
					break
			}
		})

		// Chain
		return this
	}

	// Internal: Handles the completion and error conditions for ourself.
	//
	// Should only ever execute once, if it executes more than once, then we error.
	//
	// args - The arguments {Array} that will be applied to the {::result} variable. First argument is the {Error} if it exists.
	exit (...args) {
		// Store the first error
		let error = this.state.error
		if ( args[0] && !error ) {
			this.state.error = error = args[0]
		}

		// Complete for the first (and hopefully only) time
		if ( this.completed === false ) {
			// Apply the result if it exists
			if ( args.length !== 0 ) this.state.result = args

			// Set the status and emit depending on success or failure status
			const status = (error ? 'failed' : 'passed')
			this.state.status = status
			this.emit(status, error)

			// Fire the completion callback
			this.complete()
		}

		// Error as we have already completed before
		else if ( this.config.onError !== 'ignore' ) {
			const result = this.state.result
			const stateInformation = require('util').inspect({
				error: errorToString(error),
				previousResult: result,
				currentArguments: args
			})
			const completedError = new Error(
				`The task [${this.names}] just completed, but it had already completed earlier, this is unexpected. State information:
				${stateInformation}`)
			this.emit('error', completedError)
		}

		// Chain
		return this
	}

	// Internal: Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	complete () {
		const completed = this.completed
		if ( completed ) {
			// Notify our listeners we have completed
			const args = this.state.result || []
			this.emit('completed', ...args)

			// Prevent the error from persisting
			this.state.error = null

			// Should we reset results?
			// this.results = []
			// no, it would break the promise nature of done
			// as it would mean that if multiple done listener are added, they would each get different results
			// if they wish to reset the results, they should do so manually via resetResults

			// Should we reset the status?
			// this.status = null
			// no, it would break the promise nature of done
			// as it would mean that once a done is fired, no more can be fired, until run is called again
		}
		return completed
	}

	// Public: When Done Promise.
	// Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	//
	// listener - The {Function} to attach or execute.
	whenDone (listener) {
		if ( this.completed ) {
			// avoid zalgo
			this.queue(() => {
				const result = this.state.result || []
				listener.apply(this, result)
			})
		}
		else {
			super.whenDone(listener)
		}

		// Chain
		return this
	}

	// Public: Once Done Promise.
	// Fires the listener once, either on the next tick if we are already done, or if not, once the `done` event fires.
	//
	// listener - The {Function} to attach or execute.
	onceDone (listener) {
		if ( this.completed ) {
			// avoid zalgo
			this.queue(() => {
				const result = this.state.result || []
				listener.apply(this, result)
			})
		}
		else {
			super.onceDone(listener)
		}

		// Chain
		return this
	}

	// Internal: Reset the results.
	//
	// At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults () {
		this.state.result = []
		return this
	}

	// Internal: Clear the domain
	clearDomain () {
		const taskDomain = this.state.taskDomain
		if ( taskDomain ) {
			taskDomain.exit()
			taskDomain.removeAllListeners()
			this.state.taskDomain = null
		}
		return this
	}

	// Public: Destroy the task and prevent it from executing ever again.
	destroy () {
		this.done(() => {
			// Prepare
			let status = this.state.status

			// Are we already destroyed?
			if ( status === 'destroyed' )  return

			// Update our status and notify our listeners
			this.state.status = status = 'destroyed'
			this.emit(status)

			// Clear results
			this.resetResults()
			// item arrays should already be wiped due to done completion

			// Remove all isteners
			// thisTODO should we exit or dispose of the domain?
			this.removeAllListeners()

			// Clear the domain
			this.clearDomain()
		})

		// Chain
		return this
	}

	// Internal: Fire the task method with our config arguments and wrapped in a domain.
	fire () {
		// Prepare
		const args = (this.config.args || []).slice()
		let taskDomain = this.state.taskDomain
		const useDomains = this.config.domain !== false
		const exitMethod = this.exit.bind(this)
		let method = this.config.method

		// Check that we have a method to fire
		if ( !method ) {
			const error = new Error(`The task [${this.names}] failed to run as no method was defined for it.`)
			this.emit('error', error)
			return this
		}

		// Bind method
		method = method.bind(this)

		// Prepare the task domain if it doesn't already exist
		if ( useDomains && domain && !taskDomain ) {
			// Setup the domain
			this.state.taskDomain = taskDomain = domain.create()
			taskDomain.on('error', exitMethod)
		}

		// Domains, as well as process.nextTick, make it so we can't just use exitMethod directly
		// Instead we cover it up like so, to ensure the domain exits, as well to ensure the arguments are passed
		const completeMethod = (...args) => {
			if ( this.config.sync || taskDomain ) {
				this.clearDomain()
				taskDomain = null
				exitMethod(...args)
			}
			else {
				// Use the next tick workaround to escape the try...catch scope
				// Which would otherwise catch errors inside our code when it shouldn't therefore suppressing errors
				// @TODO add test for this, originally used process.nextTick, changed to queue, hopefully it still does the same
				queue(function () {
					exitMethod(...args)
				})
			}
		}

		// Our fire function that will be wrapped in a domain or executed directly
		const fireMethod = () => {
			// Execute with ambi if appropriate
			if ( this.config.ambi !== false ) {
				ambi(method, ...args)
			}

			// Otherwise execute directly if appropriate
			else {
				method(...args)
			}
		}

		// Add the competion callback to the arguments our method will receive
		args.push(completeMethod)

		// Setup timeout if appropriate
		const timeoutDuration = this.config.timeout
		if ( timeoutDuration ) {
			this.state.timeout = wait(timeoutDuration, () => {
				if ( !this.completed ) {
					const error = new Error(`The task [${this.names}] has timed out.`)
					exitMethod(error)
				}
			})
		}

		// Notify that we are now running
		const status = 'running'
		this.state.status = status
		this.emit(status)

		// Fire the method within the domain if desired, otherwise execute directly
		if ( taskDomain ) {
			taskDomain.run(fireMethod)
		}
		else {
			try {
				fireMethod()
			}
			catch (error) {
				exitMethod(error)
			}
		}

		// Chain
		return this
	}

	// Public: Start the execution of the task.
	//
	// Will emit an `error` event if the task has already started before.
	run () {
		this.queue(() => {
			// Already completed or even destroyed?
			if ( this.started ) {
				const error = new Error(`The task [${this.names}] was just about to start, but it already started earlier, this is unexpected.`)
				this.emit('error', error)
			}

			// Not yet completed, so lets run!
			else {
				// Apply our new status and notify our listeners
				const status = 'started'
				this.state.status = status
				this.emit(status)

				// Fire the task
				this.fire()
			}
		})

		// Chain
		return this
	}
}


// =====================================
// Task Group

// Public: Our TaskGroup class.
//
// Available configuration is documented in {::setConfig}.
//
// Available events:
// - `started()` - emitted when we start execution
// - `running()` - emitted when the first item starts execution
// - `failed(error)` - emitted when execution exited with a failure
// - `passed()` - emitted when execution exited with a success
// - `completed(error, results)` - emitted when execution exited, `results` is an {Array} of the result arguments for each item that executed
// - `error(error)` - emtited if an unexpected error occured within ourself
// - `done(error, results)` - emitted when either the execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
// - `item.*(...)` - bubbled events from an added item
// - `task.*(...)` - bubbled events from an added {Task}
// - `group.*(...)` - bubbled events from an added {TaskGroup}
//
// Available internal statuses:
// - `null` - execution has not yet started
// - `'started'` - execution has begun
// - `'running'` - execution of items has begun
// - `'failed'` - execution has exited with failure status
// - `'passed'` - execution has exited with success status
// - `'destroyed'` - we've been destroyed and can no longer execute
class TaskGroup extends BaseEventEmitter {
	// Internal: The type of our class for the purpose of duck typing
	// which is needed when working with node virtual machines
	// as instanceof will not work in those environments.
	get type () { return 'taskgroup' }

	// Public: A helper method to check if the passed argument is an instanceof a {TaskGroup}.
	//
	// item - The possible instance of the {TaskGroup} that we want to check
	//
	// Returns a {Boolean} of whether or not the item is a {TaskGroup} instance.
	static isTaskGroup (group) {
		return (group && group.type === 'taskgroup') || group instanceof TaskGroup
	}

	// Internal: A reference to the {Task} class for use in {::createTask} if we want to override it
	get Task () { return Task }

	// Internal: A reference to the {TaskGroup} class for use in {::createGroup} if we want to override it
	get TaskGroup () { return TaskGroup }

	// Export API
	static get Task () { return Task }
	static get TaskGroup () { return TaskGroup }


	// -----------------------------------
	// @TODO Decide if the following is still needed

	// Internal: The config.concurrency property
	get concurrency () { return this.config.concurrency }

	// Internal: The first {Error} that has occured.
	get error () { return this.state.error }

	// Internal: A {String} containing our current status. See our {TaskGroup} description for available values.
	get status () { return this.state.status }

	// Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	get events () { return this.state.events }

	// Internal: An {Array} of the result Arguments for each completed item when their :includeInResults configuration option is not `false`
	get results () { return this.state.results }

	// Internal: An {Array} of the items that are still yet to execute
	get itemsRemaining () { return this.state.itemsRemaining }

	// Internal: An {Array} of the items that are currently running
	get itemsRunning () { return this.state.itemsRunning }

	// Internal: An {Array} of the items that have completed
	get itemsCompleted () { return this.state.itemsCompleted }

	// Public: Initialize our new {Task} instance. Forwards arguments onto {::setConfig}.
	constructor (...args) {
		super(...args)

		// State
		this.state = {
			error: null,
			status: null,
			events: ['error', 'started', 'running', 'passed', 'failed', 'completed', 'done', 'destroyed'],
			results: [],
			itemsRemaining: [],
			itemsRunning: [],
			itemsCompleted: []
		}

		// Internal: The configuration for our {TaskGroup} instance. See {::setConfig} for available configuration.
		this.config = {
			nestedEvents: false,
			nestedTaskConfig: {},
			nestedConfig: {},
			concurrency: 1,
			onError: 'exit',
			sync: false
		}

		// Apply configuration
		this.setConfig(...args)

		// Give setConfig enough chance to fire
		// Changing this to setImmediate breaks a lot of things
		// As tasks inside nested taskgroups will fire in any order
		this.queue(this.autoRun.bind(this))
	}


	// ---------------------------------
	// Configuration

	// Public: Set Nested Task Config
	set nestedTaskConfig (opts) {
		// Fetch and copy options to the state's nested task configuration
		copyObject(this.state.nestedTaskConfig, opts)

		// Chain
		return this
	}

	// Public: Set Nested Config
	set nestedConfig (opts) {
		// Fetch and copy options to the state's nested configuration
		copyObject(this.state.nestedConfig, opts)

		// Chain
		return this
	}

	// Public: Set the configuration for our instance.
	//
	// Despite accepting an {Object} of configuration, we can also accept an {Array} of configuration.
	// When using an array, a {String} becomes the :name, a {Function} becomes the :method, and an {Object} becomes the :config
	//
	// config - Our configuration {Object} can contain the following fields:
	//   :name - (default: null) A {String} for what we would like our name to be, useful for debugging.
	//   :done - (default: null) A {Function} that we would like passed to {::onceDone} (aliases are :onceDone, and :next)
	//   :whenDone - (default: null) A {Function} that we would like passed to {::whenDone}
	//   :on - (default: null) An {Object} of (eventName => listener) that we would like bound via EventEmitter.on.
	//   :once - (default: null) An {Object} of (eventName => listener) that we would like bound via EventEmitter.once.	//   :method - (default: null) A {Function} that we would like to use to created nested groups and tasks using an inline style.
	//   :parent - (default: null) A parent {TaskGroup} that we may be attached to.
	//   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` errors that occur within items will not halt execution and will not be reported in the completion callbacks `error` argument (but will still be in the `results` argument).
	//   :concurrency - (default: 1) The {Number} of items that we would like to execute at the same time. Use `0` for unlimited. `1` accomplishes serial execution, everything else accomplishes parallel execution.
	//   :run - (default: true) A {Boolean} for whether or not to the :method (if specified) automatically.
	//   :nestedConfig - (default: null) An {Object} of nested configuration to be applied to all items of this group.
	//   :nestedTaskConfig - (default: null) An {Object} of nested configuration to be applied to all {Task}s of this group.
	//   :tasks - (default: null) An {Array} of tasks to be added as children.
	//   :groups - (default: null) An {Array} of groups to be added as children.
	//   :items - (default: null) An {Array} of {Task} and/or {TaskGroup} instances to be added to this group.
	//   :sync - (default: false) A {Boolean} for whether or not we should execute certain calls asynchronously (`false`) or synchronously (`true`)
	setConfig (...args) {
		const opts = {}

		// Extract the configuration from the arguments
		args.forEach(function (arg) {
			if ( arg == null )  return
			const type = typeof arg
			switch ( type ) {
				case 'string':
					opts.name = arg
					break
				case 'function':
					opts.method = arg
					break
				case 'object':
					copyObject(opts, arg)
					break
				default:
					const error = new Error(`Unknown argument type of [${type}] given to TaskGroup::setConfig()`)
					throw error
			}
		})

		// Apply the configuration directly to our instance
		iterateObject(opts, (value, key) => {
			if ( value == null )  return
			switch ( key ) {
				case 'on':
					iterateObject(value, (value, key) => {
						if ( value )  this.on(key, value)
					})
					break

				case 'once':
					iterateObject(value, (value, key) => {
						if ( value )  this.once(key, value)
					})
					break

				case 'whenDone':
					this.whenDone(value)
					break

				case 'onceDone':
				case 'done':
				case 'next':
					this.done(value)
					break

				case 'task':
				case 'tasks':
					this.addTasks(value)
					break

				case 'group':
				case 'groups':
					this.addGroups(value)
					break

				case 'item':
				case 'items':
					this.addItems(value)
					break

				default:
					this.config[key] = value
					break
			}
		})

		// Chain
		return this
	}


	// ---------------------------------
	// TaskGroup Method

	// Internal: Prepare the method and it's configuration, and add it as a task to be executed.
	//
	// method - The {Function} of our method
	// config - An optional {Object} of configuration for the task to be created for our method
	addMethod (method, opts={}) {
		method = method.bind(this) // run the taskgroup method on the group, rather than itself
		method.isTaskGroupMethod = true
		if ( !opts.name )  opts.name = 'taskgroup method for '+this.name
		if ( !opts.args )  opts.args = [this.addGroup.bind(this), this.addTask.bind(this)]
		if ( opts.includeInResults == null )  opts.includeInResults = false
		return this.addTask(method, opts)
	}

	// Internal: Autorun ourself under certain conditions.
	//
	// Those conditions being:
	// - if we the :method configuration is defined, and we have no :parent
	// - if we the :run configuration is `true`
	//
	// Used primarily to cause the :method to fire at the appropriate time when using inline style.
	autoRun () {
		// Prepare
		const method = this.config.method
		let run = this.config.run

		// Auto run if we are going the inline style and have no parent
		if ( method ) {
			// Add the function as our first unamed task with the extra arguments
			this.addMethod(method)

			// If we are the topmost group default run to true
			if ( !this.config.parent && run == null ) {
				this.state.run = run = true
			}
		}

		// Auto run if we are configured to
		if ( run ) {
			this.run()
		}

		// Chain
		return this
	}


	// ---------------------------------
	// Add Item

	// Internal: Add an item to ourself and configure it accordingly
	//
	// item - A {Task} or {TaskGroup} instance that we would like added to ourself
	// args - Additional configuration Arguments to apply to each item
	addItem (item, ...args) {
		// Prepare
		const me = this

		// Only add the item if it exists
		if ( !item ) return null

		// Link our item to ourself
		const itemConfig = {
			parent: this,
			sync: this.config.sync
		}

		// Extract
		const nestedConfig = this.config.nestedConfig
		const nestedTaskConfig = this.config.nestedTaskConfig
		const nestedEvents = this.config.nestedEvents

		// Bubble task events
		if ( Task.isTask(item) ) {
			// Nested configuration
			item.setConfig(itemConfig, nestedConfig, nestedTaskConfig, ...args)

			// Bubble the nested events if desired
			if ( nestedEvents ) {
				item.state.events.forEach(function (event) {
					item.on(event, function (...args) {
						me.emit(`task.${event}`, item, ...args)
					})
				})
			}

			// Notify our intention
			this.emit('task.add', item)
		}

		// Bubble group events
		else if ( TaskGroup.isTaskGroup(item) ) {
			// Nested configuration
			item.setConfig(itemConfig, nestedConfig, {nestedConfig, nestedTaskConfig}, ...args)

			// Bubble the nested events if desired
			if ( nestedEvents ) {
				item.state.events.forEach(function (event) {
					item.on(event, function (...args) {
						me.emit(`group.${event}`, item, ...args)
					})
				})
			}

			// Notify our intention
			this.emit('group.add', item)
		}

		// Unknown type
		else {
			// error
		}

		// Name default
		if ( !item.config.name ) {
			item.config.name = `${item.type} ${this.totalItems+1} for [${this.name}]`
		}

		// Bubble the nested events if desired
		if ( nestedEvents ) {
			item.state.events.forEach(function (event) {
				item.on(event, function (...args) {
					me.emit(`item.${event}`, item, ...args)
				})
			})
			this.emit('item.add', item)
		}

		// Handle item completion and errors once
		// we can't just do item.done, or item.once('done'), because we need the item to be the argument, rather than `this`
		item.done(function (...args) {
			me.itemCompletionCallback(item, ...args)
		})

		// Add the item
		this.state.itemsRemaining.push(item)

		// We may be running and expecting items, if so, fire
		this.fire()

		// Return the item
		return item
	}
	addItemChain (...args) {
		this.addItem(...args)
		return this
	}

	// Internal: Add items to ourself and configure them accordingly
	//
	// items - An {Array} of {Task} and/or {TaskGroup} instances to add to ourself
	// args - Optional Arguments to configure each added item
	addItems (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addItem(item, ...args))
		return items
	}
	addItemsChain (...args) {
		this.addItems(...args)
		return this
	}


	// ---------------------------------
	// Add Task

	// Public: Create a {Task} instance from some configuration.
	//
	// If the first argument is already a {Task} instance, then just update it's configuration with the remaning arguments.
	//
	// args - Arguments to use to configure the {Task} instance
	//
	// Returns the new {Task} instance
	createTask (...args) {
		// Prepare
		let task

		// Support receiving an existing task instance
		if ( Task.isTask(args[0]) ) {
			task = args[0]
			task.setConfig(...args.slice(1))
		}

		// Support receiving arguments to create a task instance
		else {
			task = new this.Task(...args)
		}

		// Return the new task
		return task
	}

	// Public: Add a {Task} with some configuration to ourself, create it if needed.
	//
	// args - Arguments to configure (and if needed, create) the task
	addTask (...args) {
		const task = this.createTask(...args)
		return this.addItem(task)
	}
	addTaskChain (...args) {
		this.addTask(...args)
		return this
	}

	// Public: Add {Task}s with some configuration to ourself, create it if needed.
	//
	// items - An {Array} of {Task} items to add to ourself
	// args - Optional Arguments to configure each added {Task}
	addTasks (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addTask(item, ...args))
		return items
	}
	addTasksChain (...args) {
		this.addTasks(...args)
		return this
	}


	// ---------------------------------
	// Add Group

	// Public: Create a {TaskGroup} instance from some configuration.
	//
	// If the first argument is already a {TaskGroup} instance, then just update it's configuration with the remaning arguments.
	//
	// args - Arguments to use to configure the {TaskGroup} instance
	//
	// Returns the new {TaskGroup} instance
	createGroup (...args) {
		// Prepare
		let group

		// Support receiving an existing group instance
		if ( TaskGroup.isTaskGroup(args[0]) ) {
			group = args[0]
			group.setConfig(...args.slice(1))
		}

		// Support receiving arguments to create a group instance
		else {
			group = new this.TaskGroup(...args)
		}

		// Return the new group
		return group
	}

	// Public: Add a {TaskGroup} with some configuration to ourself, create it if needed.
	//
	// args - Arguments to configure (and if needed, create) the {TaskGroup}
	addGroup (...args) {
		const group = this.createGroup(...args)
		return this.addItem(group)
	}
	addGroupChain (...args) {
		this.addGroup(...args)
		return this
	}

	// Public: Add {TaskGroup}s with some configuration to ourself, create it if needed.
	//
	// items - An {Array} of {TaskGroup} items to add to ourself
	// args - Optional Arguments to configure each added {TaskGroup}
	addGroups (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addGroup(item, ...args))
		return items
	}
	addGroupsChain (...args) {
		this.addGroups(...args)
		return this
	}


	// ---------------------------------
	// Status Indicators

	// Public: Gets the total number of items
	//
	// Returns a {Number} of the total items we have
	get totalItems () {
		const running = this.state.itemsRunning.length
		const remaining = this.state.itemsRemaining.length
		const completed = this.state.itemsCompleted.length
		const total = running + remaining + completed
		return total
	}

	// Public: Gets the names of the items, the total number of items, and their results for the purpose of debugging.
	//
	// Returns an {Object} containg the hashes:
	//   :remaining - An {Array} of the names of the remaining items
	//   :running - An {Array} of the names of the running items
	//   :completed - An {Array} of the names of the completed items
	//   :total - A {Number} of the total items we have
	//   :results - An {Array} of the results of the compelted items
	get itemNames () {
		const running = this.state.itemsRunning.map((item) => item.name)
		const remaining = this.state.itemsRemaining.map((item) => item.name)
		const completed = this.state.itemsCompleted.map((item) => item.name)
		const results = this.state.results
		const total = running.length + remaining.length + completed.length
		return {
			remaining,
			running,
			completed,
			total,
			results
		}
	}

	// Public: Gets the total number count of each of our item lists.
	//
	// Returns an {Object} containg the hashes:
	//   :remaining - A {Number} of the total remaining items
	//   :running - A {Number} of the total running items
	//   :completed - A {Number} of the total completed items
	//   :total - A {Number} of the total items we have
	//   :results - A {Number} of the total results we have
	get itemTotals () {
		const running = this.state.itemsRunning.length
		const remaining = this.state.itemsRemaining.length
		const completed = this.state.itemsCompleted.length
		const results = this.state.results.length
		const total = running + remaining + completed
		return {
			remaining,
			running,
			completed,
			total,
			results
		}
	}

	// Public: Whether or not we have any running items
	//
	// Returns a {Boolean} which is `true` if we have any items that are currently running
	get hasRunning () {
		return this.state.itemsRunning.length !== 0
	}

	// Public: Whether or not we have any items that are yet to execute
	//
	// Returns a {Boolean} which is `true` if we have any items that are still yet to be executed
	get hasRemaining () {
		return this.state.itemsRemaining.length !== 0
	}

	// Public: Whether or not we have any items
	//
	// Returns a {Boolean} which is `true` if we have any running or remaining items
	get hasItems () {
		return this.hasRunning || this.hasRemaining
	}

	// Public
	get hasError () {
		return this.state.error != null
	}

	// Public
	get hasResult () {
		return this.hasError || this.state.results.length !== 0
	}

	// Internal: Whether or not we have any available slots to execute more items.
	//
	// Returns a {Boolean} which is `true` if we have available slots.
	get hasSlots () {
		const concurrency = this.config.concurrency
		return (
			concurrency === 0 || this.state.itemsRunning.length < concurrency
		)
	}

	// Internal: Whether or not we have errord and want to pause when we have an error.
	//
	// Returns a {Boolean} which is `true` if we are paused.
	get shouldPause () {
		return (
			this.config.onError === 'exit' && this.hasError
		)
	}

	// Internal: Whether or not we are capable of firing more items.
	//
	// This is determined whether or not we are not paused, and we have remaning items, and we have slots able to execute those remaning items.
	//
	// Returns a {Boolean} which is `true` if we can fire more items.
	get shouldFire () {
		return (
			!this.shouldPause &&
			this.hasRemaining &&
			this.hasSlots
		)
	}

	// Public: Whether or not we have no items left
	//
	// Returns a {Boolean} which is `true` if we have no more running or remaining items
	get empty () {
		return !this.hasItems
	}

	// Public: Have we finished its execution yet?
	//
	// Returns a {Boolean} which is `true` if we have finished execution
	get exited () {
		switch ( this.state.status ) {
			case 'completed':
			case 'destroyed':
				return true

			default:
				return false
		}
	}

	// Public: Have we started execution yet?
	//
	// Returns a {Boolean} which is `true` if we have commenced execution
	get started () {
		return this.state.status != null
	}

	// Public
	get paused () {
		return (
			this.shouldPause &&
			!this.hasRunning
		)
	}

	// Public: Have we completed its execution yet?
	//
	// Completion of executed is determined of whether or not we have started, and whether or not we are currently paused or have no remaining and running items left
	//
	// Returns a {Boolean} which is `true` if we have completed execution
	get completed () {
		return (
			this.started &&
			(
				this.paused ||
				this.empty
			)
		)
	}


	// ---------------------------------
	// Firers

	// Internal: Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	complete () {
		const completed = this.completed

		if ( completed ) {
			// Notity our listners we have completed
			this.emit('completed', this.state.error, this.state.results)

			// Prevent the error from persisting
			this.state.error = null

			// Cleanup the items that will now go unused
			this.state.itemsCompleted.forEach(function (item) {
				item.destroy()
			})
			this.state.itemsCompleted = []

			// Should we reset results?
			// this.state.results = []
			// no, it would break the promise nature of done
			// as it would mean that if multiple done handlers are added, they would each get different results
			// if they wish to reset the results, they should do so manually via resetResults

			// Should we reset the status?
			// this.state.status = null
			// no, it would break the promise nature of done
			// as it would mean that once a done is fired, no more can be fired, until run is called again
		}

		return completed
	}

	// Public: When Done Promise.
	// Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	//
	// listener - The {Function} to attach or execute.
	whenDone (handler) {
		if ( this.completed ) {
			// avoid zalgo
			this.queue( () => handler.call(this, this.state.error, this.state.results) )
		}
		else {
			super.whenDone(handler)
		}

		// Chain
		return this
	}

	// Public: Once Done Promise.
	// Fires the listener once, either on the next tick if we are already done, or if not, once the `done` event fires.
	//
	// listener - The {Function} to attach or execute.
	onceDone (handler) {
		if ( this.completed ) {
			// avoid zalgo
			this.queue( () => handler.call(this, this.state.error, this.state.results) )
		}
		else {
			super.onceDone(handler)
		}

		// Chain
		return this
	}

	// Internal: Reset the results.
	//
	// At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults () {
		this.state.results = []

		// Chain
		return this
	}

	// Internal: Fire the next items.
	//
	// Returns either an {Array} items that was fired, or `false` if no items were fired.
	fireNextItems () {
		// Prepare
		const items = []

		// Fire the next items
		while ( true ) {
			const item = this.fireNextItem()
			if ( item ) {
				items.push(item)
			}
			else {
				break
			}
		}

		// Return the items or false if no items
		const result = items.length !== 0 ? items : false
		return result
	}

	// Internal: Fire the next item.
	//
	// Returns either the item that was fired, or `false` if no item was fired.
	fireNextItem () {
		// Prepare
		let result = false

		// Can we run the next item?
		if ( this.shouldFire ) {
			// Fire the next item

			// Update our status and notify our listeners
			let status = this.state.status
			if ( status !== 'running' ) {
				this.state.status = status = 'running'
				this.emit(status)
			}

			// Get the next item
			const item = this.state.itemsRemaining.shift()

			// Add it to the remaining items
			this.state.itemsRunning.push(item)

			// Run it
			item.run()

			// Return the item
			result = item
		}

		// Return
		return result
	}

	// Internal: What to do when an item completes
	itemCompletionCallback (item, ...args) {
		// Prepare
		let error = this.state.error
		const itemsRunning = this.state.itemsRunning
		const itemsCompleted = this.state.itemsCompleted
		const results = this.state.results

		// Update error if it exists
		if ( this.config.onError === 'exit' && args[0] ) {
			if ( !error ) {
				this.state.error = error = args[0]
			}
		}

		// Mark that one less item is running
		const index = itemsRunning.indexOf(item)
		if ( index === -1 ) {
			// this should never happen, but maybe it could, in which case we definitely want to know about it
			const indexError = new Error(`Could not find [${item.names}] in the running queue`)
			console.error(errorToString(indexError))
			if ( !error ) {
				this.state.error = error = indexError
			}
		}
		else {
			itemsRunning.splice(index, 1)
		}

		// Add to the completed queue
		itemsCompleted.push(item)

		// Add the result
		if ( item.config.includeInResults !== false ) {
			results.push(args)
		}

		// Fire
		this.fire()

		// Chain
		return this
	}

	// Internal: Either execute the reamining items we are not paused, or complete execution by exiting.
	fire () {
		// Have we actually started?
		if ( this.started ) {
			// Check if we are complete, if so, exit
			if ( this.completed ) {
				this.exit()
			}

			// Otherwise continue firing items if we are wanting to pause
			else if ( !this.shouldPause ) {
				this.fireNextItems()
			}
		}

		// Chain
		return this
	}

	// Public: Clear remaning items.
	clear () {
		// Destroy all the items
		const itemsRemaining = this.state.itemsRemaining
		while ( itemsRemaining.length !== 0 ) {
			itemsRemaining.pop()
		}

		// Chain
		return this
	}

	// Public: Destroy all remaining items and remove listeners.
	destroy () {
		// Destroy all the items
		this.clear()

		// Once finished, destroy it
		this.done(() => {
			// Prepare
			let status = this.state.status

			// Are we already destroyed?
			if ( status === 'destroyed' ) return

			// Update our status and notify our listeners
			this.state.status = status = 'destroyed'
			this.emit(status)

			// Clear results
			this.resetResults()
			// item arrays should already be wiped due to done completion

			// Remove listeners
			this.removeAllListeners()
		})

		// Chain
		return this
	}


	// Internal: We now want to exit.
	exit (...args) {
		// Store the first error
		let error = this.state.error
		if ( args[0] && !error ) {
			this.state.error = error = args[0]
		}

		// Set and emmit the appropriate status for our error or non-error
		const status = (error ? 'failed' : 'passed')
		this.state.status = status
		this.emit(status, error)

		// Fire the completion callback
		this.complete()

		// Chain
		return this
	}

	// Public: Start the execution.
	run () {
		this.queue(() => {
			// Apply our new status and notify our intention to run
			const status = 'started'
			this.state.status = status
			this.emit(status)

			// Give time for the listeners to complete before continuing
			this.fire()
		})

		// Chain
		return this
	}
}

// Export
module.exports = TaskGroup

// Import
let queue = setImmediate || process.nextTick  // node 0.8 b/c
let {EventEmitter} = require('events')
let ambi = require('ambi')
let csextends = require('csextends')

// Domains
let domain = null
if ( process.browser || process.versions.node.substr(0, 3) === '0.8' ) {
	// domains are crippled in this environment, don't use them
} else {
	try {
		domain = require('domain')
	} catch (e){}
}

// Helpers
let util = {}
util.wait = (delay, fn) => setTimeout(fn, delay)
util.errorToString = function(error){
	if ( !error ) {
		return null
	} else if ( error.stack ) {
		return error.stack.toString()
	} else if ( error.message ) {
		return error.message.toString()
	} else {
		return error.toString()
	}
}
util.mapCopyIterator = function(value, key){
	this.set(key, value)
}
util.copyToMap = function(map, object){
	let objectMap = util.ensureMap(object)
	let copyToMap = util.mapCopyIterator.bind(map)
	objectMap.forEach(copyToMap)
	return map
}
util.ensureMap = function(obj, Klass=Map){
	if ( obj instanceof Klass ) {
		return obj
	} else {
		let result = new Klass()
		if ( obj ) {
			Object.keys(obj).forEach(function(key){
				let value = obj[key]
				result.set(key, value)
			})
		}
		return result
	}
}
util.ensureArray = function(arr) {
	if ( !Array.isArray(arr) ) arr = [arr]
	return arr
}


// =====================================
// Interface

// Internal: Base class containing common functionality for {Task} and {TaskGroup}.
class Interface extends EventEmitter {
	// Public: A helper method to create a new subclass with our extensions.
	//
	// extensions - An {Object} of extensions to apply to the new subclass
	//
	// Returns the new sub {Class}
	static subclass (...args) {
		csextends.apply(this, args)
	}

	// Public: Creates a new {TaskGroup} instance.
	//
	// args - The Arguments to be forwarded along to the {::constructor}.
	//
	// Returns the new {TaskGroup} instance.
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
	constructor (...args) {
		super(...args)

		// Add support for the done event
		// If we do have an error, then throw it if there is no existing or done listeners
		this.on('error', (...args) => {
			let error = args[0]

			// has done listener, forward to that
			if ( this.listeners('done').length !== 0 ) {
				this.emit('done', ...args)
			}

			// has error, but no done listener and no event listener, throw error
			else if ( error && this.listeners('error').length === 1 ) {
				// this isn't good enough, throw the error
				console.error(util.errorToString(error))
				throw error
			}
		})

		this.on('completed', (...args) => {
			let error = args[0]

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
		let err = new Error('interface should provide this')
		this.emit('error', err)
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
	done (...args) {
		return this.onceDone(...args)
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
		let names = [], name = this.name, parent = this.config.get('parent')
		if ( parent ) names.push(...parent.namesArray)
		if ( name ) names.push(name)

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
		return this.config.get('name') || `${this.type} ${Math.random()}`
	}

	// Queue
	queue (fn) {
		// If synchronouse, execute immediately
		if ( this.config.get('sync') ) fn()
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
//  - `failed(err)` - emitted when execution exited with a failure
//  - `passed()` - emitted when execution exited with a success
//  - `completed(err, ...args)` - emitted when execution exited, `args` are the result arguments from the method
//  - `error(err)` - emtited if an unexpected error occurs without ourself
//  - `done(err, ...args)` - emitted when either execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
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
//    err = new Error('deliberate error')
//    return err  // if asynchronous, can also do: complete(err)
//    // thrown and uncaught errors are also caught thanks to domains, but that should be avoided
//    // as it would put your app in an unknown state
//  ).done(console.info) // [Error('deliberator error')]
class Task extends Interface {
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
		return this.state.get('status') != null
	}

	// Public: Have we finished its execution yet?
	//
	// Returns a {Boolean} which is `true` if we have finished execution
	get exited () {
		switch ( this.state.get('status') ) {
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
		return this.state.get('status') === 'destroyed'
	}

	// Public: Have we completed its execution yet?
	//
	// Returns a {Boolean} which is `true` if we have completed
	get completed () {
		switch ( this.state.get('status') ) {
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
	get error () { return this.state.get('error') }

	// Internal: A {String} containing our current status. See our {Task} description for available values.
	get status () { return this.state.get('status') }

	// Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	get events () { return this.state.get('events') }

	// Internal: An {Array} of the result arguments of our method.
	// The first item in the array should be the {Error} if it exists.
	get result () { return this.state.get('result') }

	// Internal: The {Domain} that we create to capture errors for our method.
	get taskDomain () { return this.state.get('taskDomain') }

	// Public: Initialize our new {Task} instance. Forwards arguments onto {::setConfig}.
	constructor (...args) {
		super(...args)

		// Data
		this.state = new Map()
			.set('events', new Set())

		// Configuration
		this.config = new Map()
			.set('run', false)
			.set('onError', 'exit')
			.set('ambi', true)
			.set('domain', true)
			.set('sync', false)

		// Events
		this.state.get('events')
			.add('error')
			.add('started')
			.add('running')
			.add('failed')
			.add('passed')
			.add('completed')
			.add('done')
			.add('destroyed')

		// Apply configuration
		this.setConfig(...args)

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
		let opts = new Map()

		// Extract the configuration from the arguments
		args.forEach(function(arg){
			let type = typeof arg
			switch ( type ) {
				case 'string':
					opts.set('name', arg)
					break
				case 'function':
					opts.set('method', arg)
					break
				case 'object':
					util.copyToMap(opts, arg)
					break
			}
		})

		// Apply the configuration directly to our instance
		opts.forEach((value, key) => {
			if ( value == null ) return
			switch ( key ) {
				case 'on':
					value = util.ensureMap(value)
					value.forEach((value, key) => {
						if ( value ) this.on(key, value)
					})
					break

				case 'once':
					value = util.ensureMap(value)
					value.forEach((value, key) => {
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
					this.config.set(key, value)
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
		let error = this.state.get('error')
		if ( args[0] && !error ) {
			error = args[0]
			this.state.set('error', error)
		}

		// Complete for the first (and hopefully only) time
		if ( this.completed === false ) {
			// Apply the result if it exists
			if ( args.length !== 0 ) this.state.set('result', args)

			// Did we error?
			let status = (error ? 'failed' : 'passed')
			this.state.set('status', status)

			// Notify our listeners of our status
			this.emit(status, error)

			// Fire the completion callback
			this.complete()
		}

		// Error as we have already completed before
		else if ( this.config.get('onError') !== 'ignore' ) {
			let result = this.state.get('result')
			let stateInformation = require('util').inspect({
				error: util.errorToString(error),
				previousResult: result,
				currentArguments: args
			})
			let completedError = new Error(
				`The task [${this.names}] just completed, but it had already completed earlier, this is unexpected. State information:
				${stateInformation}`)
			this.emit('error', completedError)
		}

		// Chain
		return this
	}

	// Internal: Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	complete () {
		let completed = this.completed
		if ( completed ) {
			// Notify our listeners we have completed
			let args = this.state.get('result') || []
			this.emit('completed', ...args)

			// Prevent the error from persisting
			this.state.delete('error')

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
				let result = this.state.get('result') || []
				listener.apply(this, result)
			})
		} else {
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
				let result = this.state.get('result') || []
				listener.apply(this, result)
			})
		} else {
			super.onceDone(listener)
		}

		// Chain
		return this
	}

	// Internal: Reset the results.
	//
	// At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults () {
		this.state.set('result', [])
		return this
	}

	// Public: Destroy the task and prevent it from executing ever again.
	destroy () {
		this.done(() => {
			// Prepare
			let status = this.state.get('status')

			// Are we already destroyed?
			if ( status === 'destroyed' ) return

			// Update our status and notify our listeners
			status = 'destroyed'
			this.state.set('status', status)
			this.emit(status)

			// Clear results
			this.resetResults()
			// item arrays should already be wiped due to done completion

			// Remove all isteners
			// thisTODO should we exit or dispose of the domain?
			this.removeAllListeners()
		})

		// Chain
		return this
	}

	// Internal: Fire the task method with our config arguments and wrapped in a domain.
	fire () {
		// Prepare
		let args = (this.config.get('args') || []).slice()
		let taskDomain = this.state.get('taskDomain')
		let useDomains = this.config.get('domain') !== false
		let exitMethod = this.exit.bind(this)
		let completeMethod, fireMethod
		let method = this.config.get('method')

		// Check that we have a method to fire
		if ( !method ) {
			let error = new Error(`The task [${this.names}] failed to run as no method was defined for it.`)
			this.emit('error', error)
			return this
		}

		// Bind method
		method = method.bind(this)

		// Prepare the task domain if it doesn't already exist
		if ( useDomains && domain && !taskDomain ) {
			// Setup the domain
			taskDomain = domain.create()
			this.state.set('taskDomain', taskDomain)
			taskDomain.on('error', exitMethod)
		}

		// Domains, as well as process.nextTick, make it so we can't just use exitMethod directly
		// Instead we cover it up like so, to ensure the domain exits, as well to ensure the arguments are passed
		completeMethod = (...args) => {
			if ( this.config.get('sync') || taskDomain ) {
				if ( taskDomain ) taskDomain.exit()
				exitMethod(...args)
			} else {
				// Use the next tick workaround to escape the try...catch scope
				// Which would otherwise catch errors inside our code when it shouldn't therefore suppressing errors
				process.nextTick(function(){
					exitMethod(...args)
				})
			}
		}

		// Our fire function that will be wrapped in a domain or executed directly
		fireMethod = () => {
			// Execute with ambi if appropriate
			if ( this.config.get('ambi') !== false ) {
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
		let timeout = this.config.get('timeout')
		if ( timeout ) {
			timeout = util.wait(timeout, () => {
				if ( !this.completed ) {
					let error = new Error(`The task [${this.names}] has timed out.`)
					exitMethod(error)
				}
			})
			this.state.set('timeout', timeout)
		}

		// Notify that we are now running
		let status = 'running'
		this.state.set('status', status)
		this.emit(status)

		// Fire the method within the domain if desired, otherwise execute directly
		if ( taskDomain ) {
			taskDomain.run(fireMethod)
		} else {
			try {
				fireMethod()
			} catch (error) {
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
				let error = new Error(`The task [${this.names}] was just about to start, but it already started earlier, this is unexpected.`)
				this.emit('error', error)
			}

			// Not yet completed, so lets run!
			else {
				// Apply our new status and notify our listeners
				let status = 'started'
				this.state.set('status', status)
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
// - `failed(err)` - emitted when execution exited with a failure
// - `passed()` - emitted when execution exited with a success
// - `completed(err, results)` - emitted when execution exited, `results` is an {Array} of the result arguments for each item that executed
// - `error(err)` - emtited if an unexpected error occured within ourself
// - `done(err, results)` - emitted when either the execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
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
class TaskGroup extends Interface {
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
	get concurrency () { return this.config.get('concurrency') }

	// Internal: The first {Error} that has occured.
	get error () { return this.state.get('error') }

	// Internal: A {String} containing our current status. See our {TaskGroup} description for available values.
	get status () { return this.state.get('status') }

	// Internal: An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	get events () { return this.state.get('events') }

	// Internal: An {Array} of the result Arguments for each completed item when their :includeInResults configuration option is not `false`
	get results () { return this.state.get('results') }

	// Internal: An {Array} of the items that are still yet to execute
	get itemsRemaining () { return this.state.get('itemsRemaining') }

	// Internal: An {Array} of the items that are currently running
	get itemsRunning () { return this.state.get('itemsRunning') }

	// Internal: An {Array} of the items that have completed
	get itemsCompleted () { return this.state.get('itemsCompleted') }

	// Public: Initialize our new {Task} instance. Forwards arguments onto {::setConfig}.
	constructor (...args) {
		super(...args)

		// State
		this.state = new Map()
			.set('events', new Set())
			.set('results', [])
			.set('itemsRemaining', [])
			.set('itemsRunning', [])
			.set('itemsCompleted', [])

		// Internal: The configuration for our {TaskGroup} instance. See {::setConfig} for available configuration.
		this.config = new Map()
			.set('nestedTaskConfig', new Map())
			.set('nestedConfig', new Map())
			.set('concurrency', 1)
			.set('onError', 'exit')
			.set('sync', false)

		// Add events
		this.state.get('events')
			.add('error')
			.add('started')
			.add('running')
			.add('passed')
			.add('failed')
			.add('completed')
			.add('done')
			.add('destroyed')

		// Apply configuration
		this.setConfig(...args)

		// Give setConfig enough chance to fire
		// Changing this to setImmediate breaks a lot of things
		// As tasks inside nested taskgroups will fire in any order
		this.queue(this.autoRun.bind(this))

		// Chain
		return this
	}


	// ---------------------------------
	// Configuration

	// Public: Set Nested Task Config
	set nestedTaskConfig (opts) {
		// Fetch and copy options to the state's nested task configuration
		let nestedTaskConfig = this.state.get('nestedTaskConfig')
		util.copyToMap(nestedTaskConfig, opts)

		// Chain
		return this
	}

	// Public: Set Nested Config
	set nestedConfig (opts) {
		// Fetch and copy options to the state's nested configuration
		let nestedConfig = this.state.get('nestedConfig')
		util.copyToMap(nestedConfig, opts)

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
	//   :onError - (default: 'exit') A {String} that is either `'exit'` or `'ignore'`, when `'ignore'` errors that occur within items will not halt execution and will not be reported in the completion callbacks `err` argument (but will still be in the `results` argument).
	//   :concurrency - (default: 1) The {Number} of items that we would like to execute at the same time. Use `0` for unlimited. `1` accomplishes serial execution, everything else accomplishes parallel execution.
	//   :run - (default: true) A {Boolean} for whether or not to the :method (if specified) automatically.
	//   :nestedConfig - (default: null) An {Object} of nested configuration to be applied to all items of this group.
	//   :nestedTaskConfig - (default: null) An {Object} of nested configuration to be applied to all {Task}s of this group.
	//   :tasks - (default: null) An {Array} of tasks to be added as children.
	//   :groups - (default: null) An {Array} of groups to be added as children.
	//   :items - (default: null) An {Array} of {Task} and/or {TaskGroup} instances to be added to this group.
	//   :sync - (default: false) A {Boolean} for whether or not we should execute certain calls asynchronously (`false`) or synchronously (`true`)
	setConfig (...args) {
			let opts = new Map()

			// Extract the configuration from the arguments
			args.forEach(function(arg){
				let type = typeof arg
				switch ( type ) {
					case 'string':
						opts.set('name', arg)
						break
					case 'function':
						opts.set('method', arg)
						break
					case 'object':
						util.copyToMap(opts, arg)
						break
				}
			})

			// Apply the configuration directly to our instance
			opts.forEach((value, key) => {
				if ( value == null ) return
				switch ( key ) {
					case 'on':
						value = util.ensureMap(value)
						value.forEach((value, key) => {
							if ( value ) this.on(key, value)
						})
						break

					case 'once':
						value = util.ensureMap(value)
						value.forEach((value, key) => {
							if ( value ) this.once(key, value)
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
						this.config.set(key, value)
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
	addMethod (method, opts) {
		opts = util.ensureMap(opts)
		method = method.bind(this) // run the taskgroup method on the group, rather than itself
		method.isTaskGroupMethod = true
		if ( !opts.get('name') ) opts.set('name', 'taskgroup method for '+this.name)
		if ( !opts.get('args') ) opts.set('args', [this.addGroup.bind(this), this.addTask.bind(this)])
		if ( !opts.has('includeInResults') ) opts.set('includeInResults', false)
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
		let method = this.config.get('method')
		let run = this.config.get('run')

		// Auto run if we are going the inline style and have no parent
		if ( method ) {
			// Add the function as our first unamed task with the extra arguments
			this.addMethod(method)

			// If we are the topmost group default run to true
			if ( !this.config.get('parent') && run == null ) {
				run = true
				this.config.set('run', run)
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
		let me = this

		// Only add the item if it exists
		if ( !item ) return null

		// Link our item to ourself
		item.setConfig({
			'parent': this,
			'sync': this.config.get('sync')
		})
		if ( args.length !== 0 ) item.setConfig(...args)
		if ( !item.config.get('name') ) {
			item.config.set('name', `${item.type} ${this.totalItems+1} for [${this.name}]`)
		}

		// Extract
		let nestedConfig = this.config.get('nestedConfig')
		let nestedTaskConfig = this.config.get('nestedTaskConfig')

		// Bubble task events
		if ( Task.isTask(item) ) {
			// Nested configuration
			item.setConfig(nestedConfig)
			item.setConfig(nestedTaskConfig)

			item.state.get('events').forEach(function(event){
				item.on(event, function(...args){
					me.emit(`task.${event}`, item, ...args)
				})
			})

			// Notify our intention
			this.emit('task.add', item)
		}

		// Bubble group events
		else if ( TaskGroup.isTaskGroup(item) ) {
			// Nested configuration
			item.setConfig(nestedConfig)
			item.setConfig({nestedConfig, nestedTaskConfig})

			// Bubble item events
			item.state.get('events').forEach(function(event){
				item.on(event, function(...args){
					me.emit(`group.${event}`, item, ...args)
				})
			})

			// Notify our intention
			this.emit('group.add', item)
		}

		// Bubble item events
		item.state.get('events').forEach(function(event){
			item.on(event, function(...args){
				me.emit(`item.${event}`, item, ...args)
			})
		})

		// @TODO why is this commented out?
		// // Bubble item error event directly
		// item.on 'error', (...args) ->
		// 	me.emit('error', ...args)

		// Notify our intention
		this.emit('item.add', item)

		// Handle item completion and errors once
		// we can't just do item.done, or item.once('done'), because we need the item to be the argument, rather than `this`
		item.done(function(...args){
			me.itemCompletionCallback(item, ...args)
		})

		// Add the item
		this.state.get('itemsRemaining').push(item)

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
		items = util.ensureArray(items)
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
		let task = this.createTask(...args)
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
		items = util.ensureArray(items)
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
		let group = this.createGroup(...args)
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
		items = util.ensureArray(items)
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
		let running = this.state.get('itemsRunning').length
		let remaining = this.state.get('itemsRemaining').length
		let completed = this.state.get('itemsCompleted').length
		let total = running + remaining + completed
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
		let running = this.state.get('itemsRunning').map((item) => item.name)
		let remaining = this.state.get('itemsRemaining').map((item) => item.name)
		let completed = this.state.get('itemsCompleted').map((item) => item.name)
		let results = this.state.get('results')
		let total = running.length + remaining.length + completed.length
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
		let running = this.state.get('itemsRunning').length
		let remaining = this.state.get('itemsRemaining').length
		let completed = this.state.get('itemsCompleted').length
		let results = this.state.get('results').length
		let total = running + remaining + completed
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
		return this.state.get('itemsRunning').length !== 0
	}

	// Public: Whether or not we have any items that are yet to execute
	//
	// Returns a {Boolean} which is `true` if we have any items that are still yet to be executed
	get hasRemaining () {
		return this.state.get('itemsRemaining').length !== 0
	}

	// Public: Whether or not we have any items
	//
	// Returns a {Boolean} which is `true` if we have any running or remaining items
	get hasItems () {
		return this.hasRunning || this.hasRemaining
	}

	// Public
	get hasError () {
		return this.state.get('error') != null
	}

	// Public
	get hasResult () {
		return this.hasError || this.state.get('results').length !== 0
	}

	// Internal: Whether or not we have any available slots to execute more items.
	//
	// Returns a {Boolean} which is `true` if we have available slots.
	get hasSlots () {
		let concurrency = this.config.get('concurrency')
		return (
			concurrency === 0 || this.state.get('itemsRunning').length < concurrency
		)
	}

	// Internal: Whether or not we have errord and want to pause when we have an error.
	//
	// Returns a {Boolean} which is `true` if we are paused.
	get shouldPause () {
		return (
			this.config.get('onError') === 'exit' && this.hasError
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
		switch ( this.state.get('status') ) {
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
		return this.state.get('status') != null
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
		let completed = this.completed

		if ( completed ) {
			// Notity our listners we have completed
			this.emit('completed', this.state.get('error'), this.state.get('results'))

			// Prevent the error from persisting
			this.state.delete('error')

			// Cleanup the items that will now go unused
			let itemsCompleted = this.state.get('itemsCompleted')
			itemsCompleted.forEach(function(item){
				item.destroy()
			})
			itemsCompleted = []
			this.state.set('itemsCompleted', itemsCompleted)

			// Should we reset results?
			// this.results = []
			// no, it would break the promise nature of done
			// as it would mean that if multiple done handlers are added, they would each get different results
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
	whenDone (handler) {
		if ( this.completed ) {
			// avoid zalgo
			this.queue( () => handler.call(this, this.state.get('error'), this.state.get('results')) )
		} else {
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
			this.queue( () => handler.call(this, this.state.get('error'), this.state.get('results')) )
		} else {
			super.onceDone(handler)
		}

		// Chain
		return this
	}

	// Internal: Reset the results.
	//
	// At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	resetResults () {
		this.state.set('results', [])

		// Chain
		return this
	}

	// Internal: Fire the next items.
	//
	// Returns either an {Array} items that was fired, or `false` if no items were fired.
	fireNextItems () {
		// Prepare
		let items = []

		// Fire the next items
		while ( true ) {
			let item = this.fireNextItem()
			if ( item ) {
				items.push(item)
			}
			else {
				break
			}
		}

		// Return the items or false if no items
		let result = items.length !== 0 ? items : false
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
			let status = this.state.get('status')
			if ( status !== 'running' ) {
				status = 'running'
				this.state.set('status', status)
				this.emit(status)
			}

			// Get the next item
			let itemsRemaining = this.state.get('itemsRemaining')
			let item = itemsRemaining.shift()

			// Add it to the remaining items
			let itemsRunning = this.state.get('itemsRunning')
			itemsRunning.push(item)

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
		let error = this.state.get('error')
		let itemsRunning = this.state.get('itemsRunning')
		let itemsCompleted = this.state.get('itemsCompleted')
		let results = this.state.get('results')

		// Update error if it exists
		if ( this.config.get('onError') === 'exit' && args[0] ) {
			if ( !error ) {
				error = args[0]
				this.state.set('error', error)
			}
		}

		// Mark that one less item is running
		let index = itemsRunning.indexOf(item)
		if ( index === -1 ) {
			// this should never happen, but maybe it could, in which case we definitely want to know about it
			let indexError = new Error(`Could not find [${item.names}] in the running queue`)
			console.error(util.errorToString(indexError))
			if ( !error ) {
				error = indexError
				this.state.set('error', error)
			}
		}
		else {
			itemsRunning = itemsRunning.slice(0, index).concat(itemsRunning.slice(index+1))
			this.state.set('itemsRunning', itemsRunning)
		}

		// Add to the completed queue
		itemsCompleted.push(item)

		// Add the result
		if ( item.config.get('includeInResults') !== false ) {
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
		let itemsRemaining = this.state.get('itemsRemaining')
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
			let status = this.state.get('status')

			// Are we already destroyed?
			if ( status === 'destroyed' ) return

			// Update our status and notify our listeners
			status = 'destroyed'
			this.state.set('status', status)
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
		let error = this.state.get('error')
		if ( args[0] && !error ) {
			error = args[0]
			this.state.set('error', error)
		}

		// Did we error?
		let status = (error ? 'failed' : 'passed')
		this.state.set('status', status)

		// Notify our listeners of our status
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
			let status = 'started'
			this.state.set('status', status)
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

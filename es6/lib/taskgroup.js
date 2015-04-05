// Import
const ambi = require('ambi')
const csextends = require('csextends')
const EventEmitter = require('events').EventEmitter /* .EventEmitter for Node 0.8 compatability*/
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

/**
Base class containing common functionality for {{#crossLink "Task"}}{{/crossLink}} and {{#crossLink "TaskGroup"}}{{/crossLink}}.

@class BaseEventEmitter
@extends EventEmitter
@constructor
@private
*/
class BaseEventEmitter extends EventEmitter {
	/**
	A helper method to create a new subclass with our extensions.
	@param {Object} extensions - The methods and properties to use.
	@return {Object} A new instance of the sub class.

	@static
	@method subclass
	@public
	*/
	static subclass (...args) {
		return csextends.apply(this, args)
	}

	/**
	Creates a new {SubClass} instance.
	@param {Arguments} args - The arguments to be forwarded along to the constructor.
	@return {SubClass} The new instance.

	@static
	@method create
	@public
	*/
	static create (...args) {
		return new this(...args)
	}

	/**
	BaseEventEmitter Constructor

	Adds support for the done event while
	ensuring that errors are always handled correctly.
	It does this by listening to the `error` and `completed` events,
	and when the emit, we check if there is a `done` listener:

	- if there is, then emit the done event with the original event arguments
	- if there isn't, then output the error to stderr and throw it.

	@method constructor
	*/
	constructor () {
		super()

		// Generate our listener method that we will beind to different events
		// to add support for the `done` event and better error/event handling
		const listener = (event, ...args) => {
			// Prepare
			const error = args[0]

			// has done listener, forward to that
			if ( this.listeners('done').length !== 0 ) {
				this.emit('done', ...args)
			}

			// has error, but no done listener and no event listener, throw error
			else if ( error && this.listeners(event).length === 1 ) {
				if ( event === 'error' ) {
					console.error(errorToString(error))
					throw error
				}
				else {
					this.emit('error', error)
				}
			}
		}

		// Listen to the different events without listener
		this.on('error', listener.bind(this, 'done'))
		this.on('completed', listener.bind(this, 'done'))
		// this.on('halted', listener.bind(this, 'done'))
	}

	/**
	Attaches the listener to the `done` event to be emitted each time.
	@param {Function} listener - Attaches to the `done` event.
	@chainable
	@method whenDone
	@public
	*/
	whenDone (listener) {
		// check if we have a listener
		if ( typeof listener === 'function' ) {
			this.on('done', listener.bind(this))
		}

		// Chain
		return this
	}

	/**
	Attaches the listener to the `done` event to be emitted only once, then removed to not fire again.
	@param {Function} listener - Attaches to the `done` event.
	@chainable
	@method onceDone
	@public
	*/
	onceDone (listener) {
		// Check if we have a listener
		if ( typeof listener === 'function' ) {
			this.once('done', listener)
		}

		// Chain
		return this
	}

	/**
	Alias for {{#crossLink "BaseEventEmitter/onceDone"}}{{/crossLink}}
	@param {Function} listener - Attaches to the `done` event.
	@chainable
	@method done
	@public
	*/
	done (listener) {
		return this.onceDone(listener)
	}

	/**
	Gets our name prepended by all of our parents names
	@type Array
	@property namesArray
	@public
	*/
	get namesArray () {
		// Fetch
		const names = [], name = this.name, parent = this.config.parent
		if ( parent )  names.push(...parent.namesArray)
		if ( name )  names.push(name)

		// Return
		return names
	}

	/**
	Gets our name prefixed by all of our parents names
	@type String
	@property names
	@public
	*/
	get names () {
		return this.namesArray.join(' ➞  ')
	}


	/**
	Get the name of our instance.
	If the name was never configured, then return the name in the format of `'#{this.type} #{Math.random()}'` to output something like `task 0.2123`
	@type String
	@property name
	@public
	*/
	get name () {
		return this.config.name || `${this.type} ${Math.random()}`
	}

	/**
	Get extra state information for debugging.
	@type String
	@property stateInformation
	@private
	*/
	prepareStateInformation () {
		return require('util').inspect({
			error: errorToString(this.state.error),
			state: this.state,
			config: this.cofnig
		})
	}

	/**
	Executes the passed function either synchronously if `config.sync` is `true` or delays it for the next tick.
	@param {Function} fn - The function to execute
	@chainable
	@method queue
	@private
	*/
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

/**
Our Task Class

Available configuration is documented in {{#crossLink "Task/setConfig"}}{{/crossLink}}.

Available events:

- `started()` - emitted when we start execution
- `running()` - emitted when the method starts execution
- `failed(error)` - emitted when execution exited with a failure
- `passed()` - emitted when execution exited with a success
- `completed(error, ...resultArguments)` - emitted when execution exited, `resultArguments` are the result arguments from the method
- `error(error)` - emtited if an unexpected error occurs without ourself
- `done(error, ...resultArguments)` - emitted when either execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)

Available internal statuses:

- `null` - execution has not yet started
- `'started'` - execution has begun
- `'running'` - execution of our method has begun
- `'failed'` - execution of our method has failed
- `'passed'` - execution of our method has succeeded
- `'destroyed'` - we've been destroyed and can no longer execute

Example:

``` javascript
var Task = require('taskgroup').Task
var task

task = new Task('my synchronous task', function(){
	return 5
}).done(console.info).run()  // [null, 5]

task = new Task('my asynchronous task', function(complete){
	complete(null, 5)
}).done(console.info).run()  // [null, 5]

task = new Task('my task that returns an error', function(){
	var error = new Error('deliberate error')
	return error
}).done(console.info).run()  // [Error('deliberator error')]

task = new Task('my task that passes an error', function(complete){
	var error = new Error('deliberate error')
	complete(error)
}).done(console.info).run()  // [Error('deliberator error')]
```

@class Task
@extends BaseEventEmitter
@constructor
@public
*/
class Task extends BaseEventEmitter {
	/**
	The type of our class.

	Used for the purpose of duck typing
	which is needed when working with node virtual machines
	as instanceof will not work in those environments.

	@type String
	@property type
	@default 'task'
	@private
	*/
	get type () { return 'task' }

	/**
	A helper method to check if the passed argument is an instanceof a {Task}.
	@param {Task} item - The possible instance of the {Task} that we want to check
	@return {Boolean} Whether or not the item is a {Task} instance.
	@method isTask
	@static
	@public
	*/
	static isTask (item) {
		return (item && item.type === 'task') || (item instanceof Task)
	}

	/**
	Have we started execution yet?
	@type Boolean
	@property started
	@private
	*/
	get started () {
		return this.state.status != null
	}

	/**
	Have we finished its execution yet?
	@type Boolean
	@property exited
	@private
	*/
	get exited () {
		switch ( this.state.status ) {
			case 'completed':
			case 'destroyed':
				return true

			default:
				return false
		}
	}

	/**
	Have we been destroyed?
	@type Boolean
	@property destroyed
	@private
	*/
	get destroyed () {
		return this.state.status === 'destroyed'
	}

	/**
	Have we completed its execution yet?
	@type Boolean
	@property completed
	@private
	*/
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

	/**
	The first {Error} that has occured.
	@type Error
	@property error
	@protected
	*/
	get error () { return this.state.error }

	/**
	A {String} containing our current status. See our {Task} description for available values.
	@type String
	@property status
	@protected
	*/
	get status () { return this.state.status }

	/**
	An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	@type Array
	@property events
	@default ['events', 'error', 'started', 'running', 'failed', 'passed', 'completed', 'done', 'destroyed']
	@protected
	*/
	get events () { return this.state.events }

	/**
	An {Array} representing the returned result or the passed {Arguments} of our method.
	The first item in the array should be the {Error} if it exists.
	@type Array
	@property result
	@protected
	*/
	get result () { return this.state.result }

	/**
	The {Domain} that we create to capture errors for our method.
	@type Domain
	@property taskDomain
	@protected
	*/
	get taskDomain () { return this.state.taskDomain }

	/**
	Initialize our new {Task} instance. Forwards arguments onto {{#crossLink "Task/setConfig"}}{{/crossLink}}.
	@method constructor
	@public
	*/
	constructor (...args) {
		// Initialise BaseEventEmitter
		super()

		// State defaults
		this.state = {
			error: null,
			status: null,
			events: ['events', 'error', 'started', 'running', 'failed', 'passed', 'completed', 'done', 'destroyed']
		}

		// Configuration defaults
		this.config = {
			run: false,
			onError: 'exit',
			ambi: true,
			domain: true,
			sync: false,
			args: null
		}

		// Apply user configuration
		this.setConfig(...args)
	}

	/**
	Set the configuration for our instance.

	@param {Object} [config]

	@param {String} [config.name] - What we would like our name to be, useful for debugging.
	@param {Function} [config.done] - Passed to {{#crossLink "Task/onceDone"}}{{/crossLink}} (aliases are `onceDone`, and `next`)
	@param {Function} [config.whenDone] - Passed to {{#crossLink "Task/whenDone"}}{{/crossLink}}
	@param {Object} [config.on] - A map of event names linking to listener functions that we would like bounded via {EventEmitter.on}.
	@param {Object} [config.once] - A map of event names linking to listener functions that we would like bounded via {EventEmitter.once}.
	@param {TaskGroup} [config.parent] - A parent {{#crossLink "TaskGroup"}}{{/crossLink}} that we may be attached to.
	@param {String} [config.onError] - Either `'exit'` or `'ignore'`, when `'ignore'` duplicate run errors are not reported, useful when combined with the timeout option.
	@param {Boolean} [config.sync=false] - Whether or not we should execute certain calls asynchronously (set to `false`) or synchronously (set to `true`).

	@param {Function} [config.method] - The {Function} to execute for our {Task}.
	@param {Array} [config.args] - Arguments that we would like to forward onto our method when we execute it.
	@param {Number} [config.timeout] - Millesconds that we would like to wait before timing out the method.
	@param {Boolean} [config.ambi=true] - Whether or not to use bevry/ambi to determine if the method is asynchronous or synchronous and execute it appropriately.
	@param {Boolean} [config.domain=true] - Whether or not to wrap the task execution in a domain to attempt to catch background errors (aka errors that are occuring in other ticks than the initial execution).

	@chainable
	@method setConfig
	@public
	*/
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

	/**
	What to do when our task method completes.
	Should only ever execute once, if it executes more than once, then we error.
	@param {Arguments} args - The arguments that will be applied to the {::result} variable. First argument is the {Error} if it exists.
	@chainable
	@method exit
	@private
	*/
	itemCompletionCallback (...args) {
		// Store the first error
		let error = this.state.error
		if ( args[0] && !error ) {
			this.state.error = error = args[0]
		}

		// Complete for the first (and hopefully only) time
		if ( this.completed === false ) {
			// Apply the result if it exists
			if ( args.length !== 0 ) this.state.result = args
		}

		// Finish up
		this.finish()

		// Chain
		return this
	}

	/**
	Set our task to the completed state.
	@chainable
	@method finish
	@private
	*/
	finish () {
		const error = this.state.error

		// Complete for the first (and hopefully only) time
		if ( this.completed === false ) {
			// Set the status and emit depending on success or failure status
			const status = (error ? 'failed' : 'passed')
			this.state.status = status
			this.emit(status, error)

			// Fire the completion callback
			this.complete()
		}

		// Error as we have already completed before
		else if ( this.config.onError !== 'ignore' ) {
			const completedError = new Error(`The task [${this.names}] just completed, but it had already completed earlier, this is unexpected.`)
			this.emit('error', completedError)
		}

		// Chain
		return this
	}

	/**
	Allow the user to abort the execution of this task.
	@chainable
	@method abort
	@private
	@TODO figure out how this should actually work
	*/
	abort (error) {
		// Not yet implemented
		if ( true ) {
			const error = new Error('TaskGroup::abort has not yet been implemented.')
			this.emit('error', error)
		}

		// Don't allow aborting if we have already completed
		if ( this.completed ) {
			const error = new Error(`The task [${this.names}] cannot abort as the task has already completed, this is unexpected.`)
			this.emit('error', error)
		}
		else {
			// Update the error state if not yet set
			if ( error && !this.state.error ) {
				this.state.error = error
			}

			// Finish up
			this.finish()
		}

		// Chain
		return this
	}

	/**
	Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	@chainable
	@method complete
	@private
	*/
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

	/**
	When Done Promise.
	Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	@param {Function} listener - The {Function} to attach or execute.
	@chainable
	@method whenDone
	@public
	*/
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

	/**
	Once Done Promise.
	Fires the listener once, either on the next tick if we are already done, or if not, each time the `done` event fires.
	@param {Function} listener - The {Function} to attach or execute.
	@chainable
	@method onceDone
	@public
	*/
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

	/**
	Reset the results.
	At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	@chainable
	@method resetResults
	@private
	*/
	resetResults () {
		this.state.result = []
		return this
	}

	/**
	Clear the domain
	@chainable
	@method clearDomain
	@private
	*/
	clearDomain () {
		const taskDomain = this.state.taskDomain
		if ( taskDomain ) {
			taskDomain.exit()
			taskDomain.removeAllListeners()
			this.state.taskDomain = null
		}
		return this
	}

	/**
	Destroy ourself and prevent ourself from executing ever again.
	@chainable
	@method destroy
	@public
	*/
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

	/**
	Fire the task method with our config arguments and wrapped in a domain.
	@chainable
	@method fire
	@private
	*/
	fire () {
		// Prepare
		const args = (this.config.args || []).slice()
		let taskDomain = this.state.taskDomain
		const useDomains = this.config.domain !== false
		const exitMethod = this.itemCompletionCallback.bind(this)
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

	/**
	Start the execution of the task.
	Will emit an `error` event if the task has already started before.
	@chainable
	@method run
	@public
	*/
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

/**
Our TaskGroup class.

Available configuration is documented in {{#crossLink "TaskGroup/setConfig"}}{{/crossLink}}.

Available events:

- `started()` - emitted when we start execution
- `running()` - emitted when the first item starts execution
- `failed(error)` - emitted when execution exited with a failure
- `passed()` - emitted when execution exited with a success
- `completed(error, results)` - emitted when execution exited, `results` is an {Array} of the result arguments for each item that executed
- `error(error)` - emtited if an unexpected error occured within ourself
- `done(error, results)` - emitted when either the execution completes (the `completed` event) or when an unexpected error occurs (the `error` event)
- `item.*(...)` - bubbled events from an added item
- `task.*(...)` - bubbled events from an added {Task}
- `group.*(...)` - bubbled events from an added {TaskGroup}

Available internal statuses:

- `null` - execution has not yet started
- `'started'` - execution has begun
- `'running'` - execution of items has begun
- `'failed'` - execution has exited with failure status
- `'passed'` - execution has exited with success status
- `'destroyed'` - we've been destroyed and can no longer execute

@constructor
@class TaskGroup
@extends BaseEventEmitter
@public
*/
class TaskGroup extends BaseEventEmitter {
	/**
	The type of our class.

	Used for the purpose of duck typing
	which is needed when working with node virtual machines
	as instanceof will not work in those environments.

	@type String
	@property type
	@default 'taskgroup'
	@private
	*/
	get type () { return 'taskgroup' }

	/**
	A helper method to check if the passed argument is an instanceof a {TaskGroup}.
	@param {TaskGroup} item - The possible instance of the {TaskGroup} that we want to check
	@return {Boolean} Whether or not the item is a {TaskGroup} instance.
	@method isTaskGroup
	@static
	@public
	*/
	static isTaskGroup (group) {
		return (group && group.type === 'taskgroup') || group instanceof TaskGroup
	}

	/**
	A reference to the {Task} class for use in {::createTask} if we want to override it.
	@type Task
	@property Task
	@default Task
	@public
	*/
	get Task () { return Task }

	/**
	A reference to the {TaskGroup} class for use in {::createGroup} if we want to override it.
	@type TaskGroup
	@property TaskGroup
	@default TaskGroup
	@public
	*/
	get TaskGroup () { return TaskGroup }

	// -----------------------------------
	// Export API

	/**
	A reference to the {Task} class.
	@type Task
	@property Task
	@default Task
	@static
	@public
	*/
	static get Task () { return Task }

	/**
	A reference to the {TaskGroup} class.
	@type TaskGroup
	@property TaskGroup
	@default TaskGroup
	@static
	@public
	*/
	static get TaskGroup () { return TaskGroup }


	// -----------------------------------
	// @TODO Decide if the following is still needed

	/**
	The {config.concurrency} property.
	@type Number
	@property concurrency
	@protected
	*/
	get concurrency () { return this.config.concurrency }

	/**
	The first {Error} that has occured.
	@type Error
	@property error
	@protected
	*/
	get error () { return this.state.error }

	/**
	A {String} containing our current status. See our {TaskGroup} description for available values.
	@type String
	@property status
	@protected
	*/
	get status () { return this.state.status }

	/**
	An {Array} of the events that we may emit. Events that will be executed can be found in the {Task} description.
	@type Array
	@property events
	@protected
	*/
	get events () { return this.state.events }

	/**
	An {Array} that contains the result property for each completed {Task} and {TaskGroup}.
	An item can disable having its result property added to this results array by setting its {includeInResults} configuration option to `false`.
	@type Array
	@property results
	@protected
	*/
	get results () { return this.state.results }

	/**
	An {Array} of each {Task} and {TaskGroup} in this group that are still yet to execute.
	@type Array
	@property itemsRemaining
	@protected
	*/
	get itemsRemaining () { return this.state.itemsRemaining }

	/**
	An {Array} of each {Task} and {TaskGroup} in this group that are currently executing.
	@TODO offer the ability to disable this completely via `storeRunningItems: false`
	@type Array
	@property itemsRunning
	@protected
	*/
	get itemsRunning () { return this.state.itemsRunning }

	/**
	An {Array} of each {Task} and {TaskGroup} in this group that have completed.
	@TODO offer the ability to disable this completely via `storeCompletedItems: false`
	@type Array
	@property itemsRunning
	@protected
	*/
	get itemsCompleted () { return this.state.itemsCompleted }

	/**
	Initialize our new {TaskGroup} instance. Forwards arguments onto {{#crossLink "TaskGroup/setConfig"}}{{/crossLink}}.
	@method constructor
	@public
	*/
	constructor (...args) {
		super(...args)

		// State defaults
		this.state = {
			error: null,
			status: null,
			events: ['error', 'started', 'running', 'passed', 'failed', 'completed', 'done', 'destroyed'],
			results: [],
			itemsRemaining: [],
			itemsRunning: [],
			itemsCompleted: []
		}

		// Configuration defaults
		this.config = {
			// @TODO update storeCompleted to actually not store anything
			// this will require tests to be updated (as task names no longer will be stored)
			// as well as a counter inserted for the total completed (we may even get rid of that)
			storeCompleted: false,
			// @TODO implement one or both of the following to ensure taskgroups successfully die once completed
			//   should also implement this for the task class too
			// storeResults: false,
			// onExit: 'destroy',
			nestedEvents: false,
			nestedTaskConfig: {},
			nestedGroupConfig: {},
			concurrency: 1,
			onError: 'exit',
			sync: false
		}

		// Apply user configuration
		this.setConfig(...args)

		// Give setConfig enough chance to fire
		// Changing this to setImmediate breaks a lot of things
		// As tasks inside nested taskgroups will fire in any order
		this.queue(this.autoRun.bind(this))
	}


	// ---------------------------------
	// Configuration

	/**
	Merged passed configuration into {config.nestedTaskConfig}.
	@param {Object} opts - The configuration to merge.
	@chainable
	@method setNestedTaskConfig
	@public
	*/
	setNestedTaskConfig (opts) {
		// Fetch and copy options to the state's nested task configuration
		copyObject(this.state.nestedTaskConfig, opts)

		// Chain
		return this
	}

	/**
	Merged passed configuration into {config.nestedGroupConfig}.
	@param {Object} opts - The configuration to merge.
	@chainable
	@method setNestedGroupConfig
	@public
	*/
	setNestedGroupConfig (opts) {
		// Fetch and copy options to the state's nested configuration
		copyObject(this.state.nestedGroupConfig, opts)

		// Chain
		return this
	}

	/**
	Set the configuration for our instance.

	Despite accepting an {Object} of configuration, we can also accept an {Array} of configuration.	When using an array, a {String} becomes the :name, a {Function} becomes the :method, and an {Object} becomes the :config

	@param {Object} [config]

	@param {String} [config.name] - What we would like our name to be, useful for debugging.
	@param {Function} [config.done] - Passed to {{#crossLink "TaskGroup/onceDone"}}{{/crossLink}} (aliases are `onceDone`, and `next`)
	@param {Function} [config.whenDone] - Passed to {{#crossLink "TaskGroup/whenDone"}}{{/crossLink}}
	@param {Object} [config.on] - A map of event names linking to listener functions that we would like bounded via {EventEmitter.on}.
	@param {Object} [config.once] - A map of event names linking to listener functions that we would like bounded via {EventEmitter.once}.
	@param {TaskGroup} [config.parent] - A parent {{#crossLink "TaskGroup"}}{{/crossLink}} that we may be attached to.
	@param {String} [config.onError] - Either `'exit'` or `'ignore'`, when `'ignore'` duplicate run errors are not reported, useful when combined with the timeout option.
	@param {Boolean} [config.sync=false] - Whether or not we should execute certain calls asynchronously (set to `false`) or synchronously (set to `true`).

	@param {Function} [config.method] - The {Function} to execute for our {TaskGroup} when using inline execution style.
	@param {Boolean} [config.run=true] - A {Boolean} for whether or not to the :method (if specified) automatically.
	@param {Number} [config.concurrency=1] - The amount of items that we would like to execute at the same time. Use `0` for unlimited. `1` accomplishes serial execution, everything else accomplishes parallel execution.
	@param {Object} [config.nestedGroupConfig] - The nested configuration to be applied to all {TaskGroup} descendants of this group.
	@param {Object} [config.nestedTaskConfig] - The nested configuration to be applied to all {Task} descendants of this group.
	@param {Array} [config.tasks] - An {Array} of {Task} instances to be added to this group.
	@param {Array} [config.groups] - An {Array} of {TaskGroup} instances to be added to this group.
	@param {Array} [config.items] - An {Array} of {Task} and/or {TaskGroup} instances to be added to this group.

	@chainable
	@method setConfig
	@public
	*/
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

	/**
	Prepare the method and it's configuration, and add it as a task to be executed.
	@param {Function} method - The function we want to execute as the method of this TaskGroup.
	@param {Object} config - Optional configuration for the task to be created for the method.
	@return {Task} The task for the method.
	@method addMethod
	@private
	*/
	addMethod (method, opts={}) {
		method = method.bind(this) // run the taskgroup method on the group, rather than itself
		method.isTaskGroupMethod = true
		if ( !opts.name )  opts.name = 'taskgroup method for '+this.name
		if ( !opts.args )  opts.args = [this.addGroup.bind(this), this.addTask.bind(this)]
		if ( opts.includeInResults == null )  opts.includeInResults = false
		return this.addTask(method, opts)
	}

	/**
	Autorun ourself under certain conditions.

	Those conditions being:

	- if we the :method configuration is defined, and we have no :parent
	- if we the :run configuration is `true`

	Used primarily to cause the :method to fire at the appropriate time when using inline style.

	@chainable
	@method autoRun
	@private
	*/
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

	/**
	Adds a {Task|TaskGroup} instance and configures it from the arguments.

	@param {Arguments} ...args - Arguments used to configure the {Task|TaskGroup} instance.

	@return {Task|TaskGroup}
	@method addItem
	@public
	*/
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
		const nestedGroupConfig = this.config.nestedGroupConfig
		const nestedTaskConfig = this.config.nestedTaskConfig
		const nestedEvents = this.config.nestedEvents

		// Bubble task events
		if ( Task.isTask(item) ) {
			// Nested configuration
			item.setConfig(itemConfig, nestedTaskConfig, ...args)

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
			item.setConfig(itemConfig, {nestedTaskConfig, nestedGroupConfig}, nestedGroupConfig, ...args)

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
			let error = new Error('Unknown item type')
			this.emit('error', error)
			return this
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

	/**
	Adds {Task|TaskGroup} instances and configures them from the arguments.

	@param {Array} items - Array of {Task|TaskGroup} instances to add to this task group.
	@param {Arguments} ...args - Arguments used to configure the {Task|TaskGroup} instances.

	@return {Array}
	@method addItems
	@public
	*/
	addItems (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addItem(item, ...args))
		return items
	}

	/**
	Same as {{#crossLink "TaskGroup/addItem"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addItemChain
	@public
	*/
	addItemChain (...args) {
		this.addItem(...args)
		return this
	}

	/**
	Same as {{#crossLink "TaskGroup/addItems"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addItemsChain
	@public
	*/
	addItemsChain (...args) {
		this.addItems(...args)
		return this
	}


	// ---------------------------------
	// Add Task

	/**
	Creates a {Task} instance and configures it from the arguments.

	If the first argument is already a {Task} instance, then we configure it with the remaining arguments, instead of creating a new {Task} instance.

	@param {Arguments} ...args - Arguments used to configure the {Task} instance.

	@return {Task}
	@method createTask
	@public
	*/
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

	/**
	Adds a {Task} instance and configures it from the arguments.

	If a {Task} instance is not supplied, a {Task} instance is created from the arguments.

	@param {Arguments} ...args - Arguments used to configure the {Task} instance.

	@return {Task}
	@method addTask
	@public
	*/
	addTask (...args) {
		const task = this.createTask(...args)
		return this.addItem(task)
	}

	/**
	Adds {Task} instances and configures them from the arguments.

	@param {Array} items - Array of {Task} instances to add to this task group.
	@param {Arguments} ...args - Arguments used to configure the {Task} instances.

	@return {Array}
	@method addTask
	@public
	*/
	addTasks (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addTask(item, ...args))
		return items
	}

	/**
	Same as {{#crossLink "TaskGroup/addTask"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addTaskChain
	@public
	*/
	addTaskChain (...args) {
		this.addTask(...args)
		return this
	}

	/**
	Same as {{#crossLink "TaskGroup/addTasks"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addTasksChain
	@public
	*/
	addTasksChain (...args) {
		this.addTasks(...args)
		return this
	}


	// ---------------------------------
	// Add Group

	/**
	Creates a {TaskGroup} instance and configures it from the arguments.

	If the first argument is already a {TaskGroup} instance, then we configure it with the remaining arguments, instead of creating a new {TaskGroup} instance.

	@param {Arguments} ...args - Arguments used to configure the {TaskGroup} instance.

	@return {TaskGroup}
	@method createGroup
	@public
	*/
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

	/**
	Adds a {TaskGroup} instance and configures it from the arguments.

	If a {TaskGroup} instance is not supplied, a {TaskGroup} instance is created from the arguments.

	@param {Arguments} ...args - Arguments used to configure the {TaskGroup} instance.

	@return {TaskGroup}
	@method addGroup
	@public
	*/
	addGroup (...args) {
		const group = this.createGroup(...args)
		return this.addItem(group)
	}

	/**
	Adds {TaskGroup} instances and configures them from the arguments.

	@param {Array} items - Array of {TaskGroup} instances to add to this task group.
	@param {Arguments} ...args - Arguments used to configure the {TaskGroup} instances.

	@return {Array}
	@method addGroups
	@public
	*/
	addGroups (items, ...args) {
		items = ensureArray(items)
		items.map((item) => this.addGroup(item, ...args))
		return items
	}

	/**
	Same as {{#crossLink "TaskGroup/addGroup"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addGroupChain
	@public
	*/
	addGroupChain (...args) {
		this.addGroup(...args)
		return this
	}

	/**
	Same as {{#crossLink "TaskGroup/addGroups"}}{{/crossLink}} but chains instead of returning the item.
	@chainable
	@method addGroupsChain
	@public
	*/
	addGroupsChain (...args) {
		this.addGroups(...args)
		return this
	}


	// ---------------------------------
	// Status Indicators

	/**
	Gets the total number of items inside our task group.
	@type Number
	@property totalItems
	@public
	*/
	get totalItems () {
		const running = this.state.itemsRunning.length
		const remaining = this.state.itemsRemaining.length
		const completed = this.state.itemsCompleted.length
		const total = running + remaining + completed
		return total
	}

	/**
	Gets the total number count of each of our item lists.

	Returns an {Object} containg the hashes:

	- remaining - A {Number} of the names of the remaining items.
	- running - A {Number} of the names of the running items.
	- completed - A {Number} of the names of the completed items.
	- total - A {Number} of the total items we have.
	- results - A {Number} of the total results we have.

	@type Object
	@property itemTotals
	@public
	*/
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

	/**
	Gets the names of the items, the total number of items, and their results for the purpose of debugging.

	Returns an {Object} containg the hashes:

	- remaining - An {Array} of the names of the remaining items
	- running - An {Array} of the names of the running items
	- completed - An {Array} of the names of the completed items
	- total - A {Number} of the total items we have
	- results - An {Array} of the results of the compelted items

	@type Object
	@property itemNames
	@protected
	*/
	get itemNames () {
		const running = this.state.itemsRunning.map((item) => item.name)
		const remaining = this.state.itemsRemaining.map((item) => item.name)
		const completed = this.state.itemsCompleted.map((item) => item.name || item)
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

	/**
	Whether or not we have any running items.
	@type Boolean
	@property hasRunning
	@private
	*/
	get hasRunning () {
		return this.state.itemsRunning.length !== 0
	}

	/**
	Whether or not we have any items yet to execute.
	@type Boolean
	@property hasRunning
	@private
	*/
	get hasRemaining () {
		return this.state.itemsRemaining.length !== 0
	}

	/**
	Whether or not we have any items running or remaining.
	@type Boolean
	@property hasItems
	@private
	*/
	get hasItems () {
		return this.hasRunning || this.hasRemaining
	}

	/**
	Whether or not we have an error.
	@type Boolean
	@property hasError
	@private
	*/
	get hasError () {
		return this.state.error != null
	}

	/**
	Whether or not we have an error or a result.
	@type Boolean
	@property hasResult
	@private
	*/
	get hasResult () {
		return this.hasError || this.state.results.length !== 0
	}

	/**
	Whether or not we have any available slots to execute more items.
	@type Boolean
	@property hasResult
	@private
	*/
	get hasSlots () {
		const concurrency = this.config.concurrency
		return (
			concurrency === 0 || this.state.itemsRunning.length < concurrency
		)
	}

	/**
	Whether or not we are capable of firing more items.

	This is determined whether or not we are not paused, and we have remaning items, and we have slots able to execute those remaning items.

	@type Boolean
	@property shouldFire
	@private
	*/
	get shouldFire () {
		return (
			!this.shouldPause &&
			this.hasRemaining &&
			this.hasSlots
		)
	}

	/**
	Whether or not we have errord and want to pause when we have an error.
	@type Boolean
	@property shouldPause
	@private
	*/
	get shouldPause () {
		return (
			this.config.onError === 'exit' && this.hasError
		)
	}

	/**
	Whether or not we execution is currently paused.
	@type Boolean
	@property paused
	@private
	*/
	get paused () {
		return (
			this.shouldPause &&
			!this.hasRunning
		)
	}

	/**
	Whether or not we have no running or remaining items left.
	@type Boolean
	@property empty
	@private
	*/
	get empty () {
		return !this.hasItems
	}

	/**
	Whether or not we have finished execution.
	@type Boolean
	@property exited
	@private
	*/
	get exited () {
		switch ( this.state.status ) {
			case 'completed':
			case 'destroyed':
				return true

			default:
				return false
		}
	}

	/**
	Whether or not we have started execution.
	@type Boolean
	@property started
	@private
	*/
	get started () {
		return this.state.status != null
	}

	/**
	Whether or not we execution has completed.

	Completion of executed is determined of whether or not we have started, and whether or not we are currently paused or have no remaining and running items left

	@type Boolean
	@property completed
	@private
	*/
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

	/**
	Completetion Emitter. Used to emit the `completed` event and to cleanup our state.
	@chainable
	@method complete
	@private
	*/
	complete () {
		const completed = this.completed

		if ( completed ) {
			// Notity our listners we have completed
			this.emit('completed', this.state.error, this.state.results)

			// Prevent the error from persisting
			this.state.error = null

			// Clear and destroy completed
			this.clearCompleted()

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

	/**
	When Done Promise.
	Fires the listener, either on the next tick if we are already done, or if not, each time the `done` event fires.
	@param {Function} listener - The {Function} to attach or execute.
	@chainable
	@method whenDone
	@public
	*/
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

	/**
	Once Done Promise.
	Fires the listener once, either on the next tick if we are already done, or if not, each time the `done` event fires.
	@param {Function} listener - The {Function} to attach or execute.
	@chainable
	@method onceDone
	@public
	*/
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

	/**
	Reset the results.
	At this point this method is internal, as it's functionality may change in the future, and it's outside use is not yet confirmed. If you need such an ability, let us know via the issue tracker.
	@chainable
	@method resetResults
	@private
	*/
	resetResults () {
		this.state.results = []

		// Chain
		return this
	}

	/**
	Fire the next items.
	@return {Array|false} Either an {Array} of items that were fired or `false` if no items were fired.
	@method fireNextItems
	@private
	*/
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

	/**
	Fire the next item.
	@return {Task|TaskGroup|false} Either the {Task|TaskGroup} item that was fired or `false` if no item was fired.
	@method fireNextItem
	@private
	*/
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

	/**
	What to do when an item completes.
	@chainable
	@param {Task|TaskGroup} item - The item that has completed
	@param {Arguments} ...args - The arguments that the item completed with.
	@method itemCompletionCallback
	@private
	*/
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
		if ( this.config.storeCompleted ) {
			itemsCompleted.push(item)
		}
		else {
			// As it will no longer be destroyed in the complete() handler, destroy it here
			item.destroy()
			// Push the item name instead to keep getItemNames() working while keeping our footprint low
			itemsCompleted.push(item.name)
		}

		// Add the result
		if ( item.config.includeInResults !== false ) {
			results.push(args)
		}

		// Fire
		this.fire()

		// Chain
		return this
	}

	/**
	Internal: Either execute the reamining items we are not paused, or complete execution by exiting.
	@chainable
	@method fire
	@private
	*/
	fire () {
		// Have we actually started?
		if ( this.started ) {
			// Check if we are complete, if so, exit
			if ( this.completed ) {
				// Finish up
				this.finish()
			}

			// Otherwise continue firing items if we are wanting to pause
			else if ( !this.shouldPause ) {
				this.fireNextItems()
			}
		}

		// Chain
		return this
	}

	/**
	Remove and destroy the remaining items.
	@chainable
	@method clearRemaining
	@public
	*/
	clearRemaining () {
		const itemsRemaining = this.state.itemsRemaining
		while ( itemsRemaining.length !== 0 ) {
			itemsRemaining.pop().destroy()
		}

		// Chain
		return this
	}

	/**
	Remove and destroy the running items. Here for verboseness.
	@chainable
	@method clearRunning
	@private
	*/
	clearRunning () {
		const error = new Error('Clearing running items is not possible. Instead remaining items and wait for running items to complete.')
		this.emit('error', error)
	}

	/**
	Remove and destroy the completed items.
	@chainable
	@method clearCompleted
	@public
	*/
	clearCompleted () {
		const itemsCompleted = this.state.itemsCompleted
		if ( this.config.storeCompleted ) {
			while ( itemsCompleted.length !== 0 ) {
				itemsCompleted.pop().destroy()
			}
		}
		else {
			// jscs:disable disallowEmptyBlocks
			while ( itemsCompleted.pop() ) { }
			// jscs:enable requireCurlyBraces
		}

		// Chain
		return this
	}

	/**
	Destroy ourself and prevent ourself from executing ever again.
	@chainable
	@method destroy
	@public
	*/
	destroy () {
		// Clear remaining items to prevent them from running
		this.clearRemaining()

		// Once running items have finished, then proceed to destruction
		this.done(() => {
			// Prepare
			let status = this.state.status

			// Are we already destroyed?
			if ( status === 'destroyed' ) return

			// We don't need to call clear completed items as done() will have done that for us

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

	/**
	Set our task to the completed state.
	@TODO why is this here instead of inside .complete() ?
	@chainable
	@method finish
	@private
	*/
	finish () {
		// Set and emmit the appropriate status for our error or non-error
		const error = this.state.error
		const status = (error ? 'failed' : 'passed')
		this.state.status = status
		this.emit(status, error)

		// Fire the completion callback
		this.complete()
	}

	/**
	We want to halt execution and trigger our completion callback.

	@TODO figure out how this should actually work?
	Should it be two methods? .halt() and .abort(error?)
	Should it be a state?
	Should it alter the state?
	Should it clear or destroy?
	What is the definition of pausing with this?
	Perhaps we need to update the definition of pausing to be halted instead?
	How can we apply this to Tasks instead?

	@param {Error} error - An optional error to provide if not already set.
	@chainable
	@method abort
	@private
	*/
	abort (error) {
		// Not yet implemented
		if ( true ) {
			const error = new Error('TaskGroup::abort has not yet been implemented.')
			this.emit('error', error)
		}

		// Update the error state if not yet set
		if ( error && !this.state.error ) {
			this.state.error = error
		}

		// Finish up
		// ...

		// Chain
		return this
	}

	/**
	Start/restart/resume the execution of the TaskGroup.
	@chainable
	@method run
	@public
	*/
	run () {
		this.queue(() => {
			// Already destroyed?
			if ( this.state.status === 'destroyed' ) {
				const error = new Error(`The taskgroup [${this.names}] was just about to start, but it was destroyed earlier, this is unexpected.`)
				this.emit('error', error)
			}

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

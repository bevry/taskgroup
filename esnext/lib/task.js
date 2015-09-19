// Imports
const BaseInterface = require('./interface')
const {copyObject, iterateObject, queue, wait, domain} = require('./util')
const ambi = require('ambi')

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
@extends BaseInterface
@constructor
@public
*/
export default class Task extends BaseInterface {
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
		return (item && item.type === 'task') || (item instanceof this)
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
		// Initialise BaseInterface
		super()

		// State defaults
		this.state = {
			name: `${this.type} ${Math.random()}`,
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
			const status = error ? 'failed' : 'passed'
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

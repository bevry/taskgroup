'use strict'

// Imports
const {queue, errorToString} = require('./util')

/**
Base class containing common functionality for {{#crossLink "Task"}}{{/crossLink}} and {{#crossLink "TaskGroup"}}{{/crossLink}}.

@class BaseInterface
@extends EventEmitter
@constructor
@private
*/
export default class BaseInterface extends require('events').EventEmitter {
	/**
	Creates and returns new instance of this class.
	@param {Arguments} args - The arguments to be forwarded along to the constructor.
	@return {Object} The new instance.

	@static
	@method create
	@public
	*/
	static create (...args) {
		return new this(...args)
	}

	/**
	BaseInterface Constructor

	Adds support for the done event while
	ensuring that errors are always handled correctly.
	It does this by listening to the `error` and `completed` events,
	and when the emit, we check if there is a `done` listener:

	- if there is, then emit the done event with the original event arguments
	- if there isn't, then output the error to stderr and throw it.

	Sets the following configuration:

	- `nameSeparator` defaults to `' ➞  '`, used to stringify the result of `.names`

	@method constructor
	*/
	constructor () {
		super()

		// Set state and config
		if ( this.state == null )  this.state = {}
		if ( this.config == null )  this.config = {}
		if ( !this.config.nameSeparator )  this.config.nameSeparator = ' ➞  '

		// Generate our listener method that we will beind to different events
		// to add support for the `done` event and better error/event handling
		function listener (event, ...args) {
			// Prepare
			const error = args[0]

			// has done listener, forward to that
			if ( this.listeners('done').length !== 0 ) {
				this.emit('done', ...args)
			}

			// has error, but no done listener and no event listener, throw error
			else if ( error && this.listeners(event).length === 1 ) {
				if ( event === 'error' ) {
					/* eslint no-console:0 */
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
	Alias for {{#crossLink "BaseInterface/onceDone"}}{{/crossLink}}
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
	@property names
	@public
	*/
	get names () {
		// Fetch
		const names = [], parent = this.config.parent
		if ( parent )  names.push(...parent.names)
		if ( this.config.name !== false )  names.push(this.name)
		names.toString = () => {
			return names.join(this.config.nameSeparator)
		}

		// Return
		return names
	}

	/**
	Get the name of our instance.
	If the name was never configured, then return the name in the format of `'#{this.type} #{Math.random()}'` to output something like `task 0.2123`
	@type String
	@property name
	@public
	*/
	get name () {
		return this.config.name || this.state.name
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

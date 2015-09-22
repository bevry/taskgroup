/* eslint no-extra-parens:0 */
'use strict'

// Imports
const BaseInterface = require('./interface')
const Task = require('./task')
const {ensureArray, errorToString} = require('./util')
const extendr = require('extendr')
const eachr = require('eachr')

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
@extends BaseInterface
@public
*/
class TaskGroup extends BaseInterface {
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
		return group && group.type === 'taskgroup' || group instanceof this
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
	get events () {
		return ['error', 'started', 'running', 'passed', 'failed', 'completed', 'done', 'destroyed']
	}

	/**
	An {Array} that contains the result property for each completed {Task} and {TaskGroup}.
	An item can disable having its result property added to this results array by setting its {includeInResults} configuration option to `false`.
	@type Array
	@property results
	@protected
	*/
	get results () { return this.state.results }

	/**
	Initialize our new {TaskGroup} instance. Forwards arguments onto {{#crossLink "TaskGroup/setConfig"}}{{/crossLink}}.
	@method constructor
	@public
	*/
	constructor (...args) {
		super()

		// State defaults
		extendr.defaults(this.state, {
			id: `${this.type} ${Math.random()}`,
			error: null,
			status: null,
			results: [],
			itemsRemaining: [],
			itemsRunningCount: 0,
			itemsCompletedCount: 0
		})

		// Configuration defaults
		extendr.defaults(this.config, {
			destroyCompleted: true,
			onExit: 'destroy',
			emitNestedEvents: false,
			nestedTaskConfig: {},
			nestedGroupConfig: {},
			concurrency: 1,
			onError: 'exit',
			sync: false
		})

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
		extendr.deep(this.state.nestedTaskConfig, opts)

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
		extendr.deep(this.state.nestedGroupConfig, opts)

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
	@param {Object} [config.on] - An object of event names linking to listener functions that we would like bounded via {EventEmitter.on}.
	@param {Object} [config.once] - An object of event names linking to listener functions that we would like bounded via {EventEmitter.once}.
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
					extendr.deep(opts, arg)
					break
				default:
					const error = new Error(`Unknown argument type of [${type}] given to TaskGroup::setConfig()`)
					throw error
			}
		})

		// Apply the configuration directly to our instance
		eachr(opts, (value, key) => {
			if ( value == null )  return
			switch ( key ) {
				case 'on':
					eachr(value, (value, key) => {
						if ( value )  this.on(key, value)
					})
					break

				case 'once':
					eachr(value, (value, key) => {
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
	addMethod (method, opts = {}) {
		method = method.bind(this) // run the taskgroup method on the group, rather than itself
		method.isTaskGroupMethod = true
		if ( !opts.name )  opts.name = 'taskgroup method for ' + this.name
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
		const emitNestedEvents = this.config.emitNestedEvents

		// Bubble task events
		if ( Task.isTask(item) ) {
			// Nested configuration
			item.setConfig(itemConfig, nestedTaskConfig, ...args)

			// Bubble the nested events if desired
			if ( emitNestedEvents ) {
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
			if ( emitNestedEvents ) {
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
			item.config.name = `${item.type} ${this.totalItems + 1} for [${this.name}]`
		}

		// Bubble the nested events if desired
		if ( emitNestedEvents ) {
			item.state.events.forEach(function (event) {
				item.on(event, function (...args) {
					me.emit(`item.${event}`, item, ...args)
				})
			})
		}

		// Emit
		this.emit('item.add', item)

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
		const remaining = this.state.itemsRemaining.length
		const running = this.state.itemsRunningCount
		const completed = this.state.itemsCompletedCount
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
		const remaining = this.state.itemsRemaining.length
		const running = this.state.itemsRunningCount
		const completed = this.state.itemsCompletedCount
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
	Whether or not we have any items yet to execute.
	@type Boolean
	@property hasRunning
	@private
	*/
	get hasRemaining () {
		return this.state.itemsRemaining.length !== 0
	}

	/**
	Whether or not we have any running items.
	@type Boolean
	@property hasRunning
	@private
	*/
	get hasRunning () {
		return this.state.itemsRunningCount !== 0
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
		return concurrency === 0 || this.state.itemsRunningCount < concurrency
	}

	/**
	Whether or not we are capable of firing more items.

	This is determined whether or not we are not paused, and we have remaning items, and we have slots able to execute those remaning items.

	@type Boolean
	@property shouldFire
	@private
	*/
	get shouldFire () {
		return !this.shouldPause && this.hasRemaining && this.hasSlots
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

			// Get the next item and bump the running count
			const item = this.state.itemsRemaining.shift()
			++this.state.itemsRunningCount
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
		const results = this.state.results

		// Update error if it exists
		if ( this.config.onError === 'exit' && args[0] ) {
			if ( !error ) {
				this.state.error = error = args[0]
			}
		}

		// Add the result
		if ( !item.config.includeInResults ) {
			results.push(args)
		}

		// Mark that one less item is running and one more item completed
		--this.state.itemsRunningCount
		++this.state.itemsCompletedCount

		// As we no longer have any use for this item, as it has completed, destroy it if desired
		if ( this.config.destroyCompleted ) {
			item.destroy()
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
	@NOTE This doesn't have to be a separate method, it could just go inside `fire` however, it is nice to have here to keep `fire` simple
	@chainable
	@method finish
	@private
	*/
	finish () {
		// Set and emmit the appropriate status for our error or non-error
		const error = this.state.error
		const status = error ? 'failed' : 'passed'
		this.state.status = status
		this.emit(status, error)

		// Notity our listners we have completed
		this.emit('completed', this.state.error, this.state.results)

		// Prevent the error from persisting
		this.state.error = null

		// Destroy if desired
		if ( this.config.onExit === 'destroy' ) {
			this.destroy()
		}
	}

	/**
	@NOTE Perhaps at some point, we can add abort/exit functionality, but these things have to be considered:
	What will happen to currently running items?
	What will happen to remaining items?
	Should it be two methods? .halt() and .abort(error?)
	Should it be a state?
	Should it alter the state?
	Should it clear or destroy?
	What is the definition of pausing with this?
	Perhaps we need to update the definition of pausing to be halted instead?
	How can we apply this to Task and TaskGroup consistently?
	*/

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

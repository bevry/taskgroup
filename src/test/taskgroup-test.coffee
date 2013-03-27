# Requires
assert = require?('assert') or @assert
joe = require?('joe') or @joe
balUtil = require?(__dirname+'/../lib/balutil') or @balUtil


# =====================================
# Tests

wait = (delay,fn) -> setTimeout(fn,delay)

# -------------------------------------
# Flow

joe.describe 'misc', (describe,it) ->

	it 'should suffix arrays', (done) ->
		# Prepare
		expected = ['ba','ca','da','ea']
		actual = balUtil.suffixArray('a', 'b', ['c', 'd'], 'e')
		assert.deepEqual(expected, actual, 'actual was as expected')
		done()

	it 'should detect arrays', (done) ->
		# Prepare
		arr = []
		obj = {}
		str = ''
		assert.equal(true,balUtil.isArray(arr), 'array vs array comparison')
		assert.equal(false,balUtil.isArray(obj), 'object vs array comparison')
		assert.equal(false,balUtil.isArray(str), 'string vs array comparison')
		done()

	it 'should cycle arrays', (done) ->
		# Prepare
		arr = ['a','b','c']
		out = []
		balUtil.each arr, (value,key) ->
			out[key] = value
		assert.deepEqual(arr, out, 'cycling an array produced the expected results')
		done()

	it 'should cycle objects', (done) ->
		# Prepare
		obj = {'a':1,'b':2,'c':3}
		out = {}
		balUtil.each obj, (value,key) ->
			out[key] = value
		assert.deepEqual(obj, out, 'cycling an object produced the expected results')
		done()

	it 'should shallow extend correctly', (done) ->
		# Prepare
		src = {a:{b:2}}
		out = balUtil.shallowExtendPlainObjects({},src)
		out.a.b = 3
		assert.deepEqual({a:{b:3}}, out, 'out object was as expected')
		assert.deepEqual({a:{b:3}}, src, 'src object was modified')
		done()

	it 'should safe shallow extend correctly', (done) ->
		# Prepare
		expected = {a:2}
		actual = balUtil.safeShallowExtendPlainObjects({a:1}, {a:2}, {a:null})
		assert.deepEqual(actual, expected, 'out object was as expected')
		done()

	it 'should deep extend correctly', (done) ->
		# Prepare
		src = {a:{b:2}}
		out = balUtil.deepExtendPlainObjects({},src)
		out.a.b = 3
		assert.deepEqual({a:{b:3}}, out, 'out object was as expected')
		assert.deepEqual({a:{b:2}}, src, 'src object was not modified')
		done()

	it 'should safe deep extend correctly', (done) ->
		# Prepare
		expected = {a:b:2}
		actual = balUtil.safeDeepExtendPlainObjects({a:b:2}, {a:b:2}, {a:b:null})
		assert.deepEqual(actual, expected, 'out object was as expected')
		done()

	it 'should dereference correctly', (done) ->
		# Prepare
		src = {a:{b:2}}
		out = balUtil.dereference(src)
		out.a.b = 3
		assert.deepEqual({a:{b:3}}, out, 'out object was as expected')
		assert.deepEqual({a:{b:2}}, src, 'src object was not modified')
		done()

	it 'should getdeep correctly', (done) ->
		# Prepare
		src =
			a:
				b:
					attributes:
						c: 1

		expected = 1
		actual = balUtil.getDeep(src,'a.b.c')
		assert.equal(expected, actual, 'out value was as expected')

		actual = balUtil.getDeep(src,'a.b.unknown')
		assert.ok(typeof actual is 'undefined', 'undefined value was as expected')

		done()

	it 'should setdeep correctly', (done) ->
		# Prepare
		src =
			a:
				unknown: 'asd'
				b:
					attributes:
						c: 1

		expected =
			a:
				b:
					attributes:
						c: 2

		balUtil.setDeep(src,'a.unknown',undefined)
		balUtil.setDeep(src,'a.b.c',2)

		assert.deepEqual(expected, src, 'out value was as expected')

		done()


# -------------------------------------
# Group

joe.describe 'Group', (describe,it) ->

	it 'should work when tasks are specified manually', (done) ->
		# Prepare
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true
		tasks.total = 2

		# Make the first task finish after the second task
		wait 1000, ->
			firstTaskFinished = true
			assert.equal(true, secondTaskFinished, 'the first task ran second as expected')
			tasks.complete()

		# Make the second task finish before the first task
		wait 500, ->
			secondTaskFinished = true
			assert.equal(false, firstTaskFinished, 'the second task ran first as expected')
			tasks.complete()

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should work when run synchronously', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Make the first task take longer than the second task, but as we run synchronously, it should still finish first
		tasks.push (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(false, secondTaskFinished, 'the first task completed first as expected')
				complete()

		# Make the second task take shorter than the first task, but as we run synchronously, it should still finish second
		tasks.push (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(true, firstTaskFinished, 'the second task completed second as expected')
				complete()

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.sync()
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should work when run synchronously via run', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Make the first task take longer than the second task, but as we run synchronously, it should still finish first
		tasks.push (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(false, secondTaskFinished, 'the first task completed first as expected')
				complete()

		# Make the second task take shorter than the first task, but as we run synchronously, it should still finish second
		tasks.push (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(true, firstTaskFinished, 'the second task completed second as expected')
				complete()

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.run('sync')
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should work when run asynchronously', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Make the first task take longer than the second task, and as we run asynchronously, it should finish last
		tasks.push (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(true, secondTaskFinished, 'the first task completed second as expected')
				complete()

		# Make the second task take shorter than the first task, and as we run asynchronously, it should finish first
		tasks.push (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(false, firstTaskFinished, 'the second task completed first as expected')
				complete()

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.async()
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()



	it 'should handle errors correctly', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 1

		# Create our group
		tasks = new balUtil.Group (err) ->
			assert.equal(true, err != null, 'an error is present');
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Make the first task take longer than the second task, but as we run synchronously, it should still finish first
		tasks.push (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(false, secondTaskFinished, 'the first task completed first as expected')
				complete()

		# Make the second task take shorter than the first task, but as we run synchronously, it should still finish second
		tasks.push (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(true, firstTaskFinished, 'the second task completed second as expected')
				complete(new Error('deliberate error'))

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.sync()
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(false, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should work with optional completion callbacks', (done) ->
		# Prepare
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Add the first task
		tasks.push (done) -> done()

		# Add the second task
		tasks.push ->

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.sync()

		# Check all tasks ran
		wait 5000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()

	it 'should work when specifying contexts', (done) ->
		# Prepare
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Add the first task
		tasks.push {blah:1}, ->
			assert.equal(1, @blah, 'context was applied correctly')

		# Add the second task
		tasks.push {blah:2}, ->
			assert.equal(2, @blah, 'context was applied correctly')

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.sync()

		# Check all tasks ran
		wait 5000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()



	it 'should push and run synchronous tasks correctly', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group 'serial', (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true
		assert.equal('serial', tasks.mode, 'mode was correctly set to serial')

		# Make the first task take longer than the second task, but as we run synchronously, it should still finish first
		tasks.pushAndRun (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(false, secondTaskFinished, 'the first task completed first as expected')
				complete()

		# We're now running, so test that
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Make the second task take shorter than the first task, but as we run synchronously, it should still finish second
		tasks.pushAndRun (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(true, firstTaskFinished, 'the second task completed second as expected')
				complete()

		# Check all tasks ran
		wait 4000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()



	it 'should push and run asynchronous tasks correctly (queued)', (done) ->
		# Prepare
		firstTaskRun = false
		secondTaskRun = false
		firstTaskFinished = false
		secondTaskFinished = false
		finished = false
		total = 2

		# Create our group
		tasks = new balUtil.Group 'parallel', (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true
		assert.equal('parallel', tasks.mode, 'mode was correctly set to parallel')

		# Make the first task take longer than the second task, but as we run synchronously, it should still finish first
		tasks.pushAndRun (complete) ->
			firstTaskRun = true
			assert.equal(false, secondTaskRun, 'the first task ran first as expected')
			wait 1000, ->
				firstTaskFinished = true
				assert.equal(true, secondTaskFinished, 'the first task completed second as expected')
				complete()

		# We're now running, so test that
		assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Make the second task take shorter than the first task, but as we run synchronously, it should still finish second
		tasks.pushAndRun (complete) ->
			secondTaskRun = true
			assert.equal(true, firstTaskRun, 'the second task ran second as expected')
			wait 500, ->
				secondTaskFinished = true
				assert.equal(false, firstTaskFinished, 'the second task completed first as expected')
				complete()

		# Check all tasks ran
		wait 4000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should push and run synchronous tasks correctly (multiple times)', (done) ->
		# Prepare
		finished = 0
		total = 2

		# Create our group
		tasks = new balUtil.Group 'serial', {autoClear: true}, (err) ->
			return done(err)  if err
			++finished
		assert.equal('serial', tasks.mode, 'mode was correctly set to serial')
		assert.equal(true, tasks.autoClear, 'autoClear was correctly set to true')

		# Fire the first task right away
		tasks.pushAndRun (complete) -> complete()

		# Fire the second task after a while
		wait 500, ->
			tasks.pushAndRun (complete) -> wait 500, -> complete()
			assert.equal(true, tasks.isRunning(), 'isRunning() returned true')

		# Check all tasks ran
		wait 2000, ->
			assert.equal(total, finished, 'it exited the correct number of times')
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(false, tasks.hasCompleted(), 'hasCompleted() returned false')
			assert.equal(false, tasks.hasExited(), 'hasExited() returned false')
			done()



	it 'should work when running ten thousand tasks synchronously', (done) ->
		# Prepare
		finished = false
		total = 10000

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Add the tasks
		for i in [0...total]
			tasks.push (complete) ->
				complete()

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.sync()

		# Check all tasks ran
		wait 5000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()


	it 'should work when running ten thousand tasks asynchronously', (done) ->
		# Prepare
		finished = false
		total = 10000

		# Create our group
		tasks = new balUtil.Group (err) ->
			return done(err)  if err
			assert.equal(false, finished, 'the group of tasks only finished once')
			finished = true

		# Add the tasks
		for i in [0...total]
			tasks.push (complete) ->
				setTimeout(complete,50)

		# Check no tasks have run
		assert.equal(0, tasks.completed, 'no tasks should have started yet')

		# Run the tasks
		tasks.async()

		# Check all tasks ran
		wait 5000, ->
			assert.equal(total, tasks.completed, 'the expected number of tasks ran '+"#{tasks.completed}/#{total}")
			assert.equal(false, tasks.isRunning(), 'isRunning() returned false')
			assert.equal(true, tasks.hasCompleted(), 'hasCompleted() returned true')
			assert.equal(true, tasks.hasExited(), 'hasExited() returned true')
			done()

# 5 April 2015
# https://github.com/bevry/base


# =====================================
# Imports

fsUtil = require('fs')
pathUtil = require('path')


# =====================================
# Variables

WINDOWS          = process.platform.indexOf('win') is 0
NODE             = process.execPath
NPM              = (if WINDOWS then process.execPath.replace('node.exe', 'npm.cmd') else 'npm')
EXT              = (if WINDOWS then '.cmd' else '')
GIT              = "git"

APP_PATH         = process.cwd()
PACKAGE_PATH     = pathUtil.join(APP_PATH, "package.json")
PACKAGE_DATA     = require(PACKAGE_PATH)

MODULES_PATH     = pathUtil.join(APP_PATH, "node_modules")
DOCPAD_PATH      = pathUtil.join(MODULES_PATH, "docpad")
CAKE             = pathUtil.join(MODULES_PATH, ".bin", "cake")
COFFEE           = pathUtil.join(MODULES_PATH, ".bin", "coffee")
PROJECTZ         = pathUtil.join(MODULES_PATH, ".bin", "projectz")
DOCCO            = pathUtil.join(MODULES_PATH, ".bin", "docco")
DOCPAD           = pathUtil.join(MODULES_PATH, ".bin", "docpad")
BISCOTTO         = pathUtil.join(MODULES_PATH, ".bin", "biscotto")
YUIDOC           = pathUtil.join(MODULES_PATH, ".bin", "yuidoc")
BABEL            = pathUtil.join(MODULES_PATH, ".bin", "babel")
ESLINT           = pathUtil.join(MODULES_PATH, ".bin", "eslint")

config = {}
config.TEST_PATH           = "test"
config.DOCCO_SRC_PATH      = null
config.DOCCO_OUT_PATH      = "docs"
config.BISCOTTO_SRC_PATH   = null
config.BISCOTTO_OUT_PATH   = "docs"
config.YUIDOC_SRC_PATH     = null
config.YUIDOC_OUT_PATH     = "docs"
config.COFFEE_SRC_PATH     = null
config.COFFEE_OUT_PATH     = "out"
config.DOCPAD_SRC_PATH     = null
config.DOCPAD_OUT_PATH     = "out"
config.BABEL_SRC_PATH      = null
config.BABEL_OUT_PATH      = "es5"
config.ESLINT_SRC_PATH     = null

for own key,value of (PACKAGE_DATA.cakeConfiguration or {})
	config[key] = value

#for own key,value of config
#	config[key] = pathUtil.resolve(APP_PATH, value)  if value
# ^ causes issues with biscotto, as it just wants relative paths


# =====================================
# Generic

child_process = require('child_process')

spawn = (command, args, opts, next) ->
	commandString = command+' '+args.join(' ')
	if opts.output is true
		console.log(commandString)
		opts.stdio = 'inherit'
	pid = child_process.spawn(command, args, opts)
	pid.on 'close', (args...) ->
		if args[0] is 1
			error = new Error("Process [#{commandString}] exited with error status code.")
		else
			next?(args...)
	return pid

exec = (command, opts, next) ->
	if opts.output is true
		console.log(command)
		return child_process.exec command, opts, (err, stdout, stderr) ->
			console.log(stdout)
			console.log(stderr)
			next?()
	else
		return child_process.exec(command, opts, next)

finish = (error) ->
	if error
		process.stderr.write( (error.stack ? error) + '\n' )
		throw error
	else
		process.stdout.write('OK\n')

steps = (next, steps) ->
	step = 0

	complete = (error) ->
		# success status code
		if error is 0
			error = null

		# error status code
		else if error is 1
			error = new Error('Process exited with error status code')

		# Error
		if error
			next(error)
		else
			++step
			if step is steps.length
				next()
			else
				steps[step](complete)

	steps[step](complete)


# =====================================
# Actions

actions =
	clean: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\nclean:')

				# Prepare rm args
				args = ['-Rf']

				# Add compilation paths to args
				for own key, value of config
					if key.indexOf('OUT_PATH') isnt -1
						args.push(value)

				# Add common ignore paths to args
				for path in [APP_PATH, config.TEST_PATH]
					args.push(
						pathUtil.join(path,  'build')
						pathUtil.join(path,  'components')
						pathUtil.join(path,  'bower_components')
						pathUtil.join(path,  'node_modules')
						pathUtil.join(path,  '*out')
						pathUtil.join(path,  '*log')
						pathUtil.join(path,  '*heapsnaphot')
						pathUtil.join(path,  '*cpuprofile')
					)

				# rm
				spawn('rm', args, {output:true, cwd:APP_PATH}, complete)
		])

	setup: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\nnpm install (for app):')
				spawn(NPM, ['install'], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !config.TEST_PATH or !fsUtil.existsSync(config.TEST_PATH)
				console.log('\nnpm install (for test):')
				spawn(NPM, ['install'], {output:true, cwd:config.TEST_PATH}, complete)
			(complete) ->
				return complete()  if !fsUtil.existsSync(DOCPAD_PATH)
				console.log('\nnpm install (for docpad tests):')
				spawn(NPM, ['install'], {output:true, cwd:DOCPAD_PATH}, complete)
		])

	compile: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ncake setup')
				actions.setup(opts, complete)
			(complete) ->
				return complete()  if !config.COFFEE_SRC_PATH or !fsUtil.existsSync(COFFEE)
				console.log('\ncoffee compile:')
				spawn(NODE, [COFFEE, '-co', config.COFFEE_OUT_PATH, config.COFFEE_SRC_PATH], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !config.BABEL_SRC_PATH or !fsUtil.existsSync(BABEL)
				console.log('\nbabel compile:')
				spawn(NODE, [BABEL, config.BABEL_SRC_PATH, '--out-dir', config.BABEL_OUT_PATH], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !config.DOCPAD_SRC_PATH or !fsUtil.existsSync(DOCPAD)
				console.log('\ndocpad generate:')
				spawn(NODE, [DOCPAD, 'generate'], {output:true, cwd:APP_PATH}, complete)
		])

	watch: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ncake setup')
				actions.setup(opts, complete)
			(complete) ->
				return complete()  if !config.BABEL_SRC_PATH or !fsUtil.existsSync(BABEL)
				console.log('\nbabel compile:')
				spawn(NODE, [BABEL, '-w', config.BABEL_SRC_PATH, '--out-dir', config.BABEL_OUT_PATH], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !config.COFFEE_SRC_PATH or !fsUtil.existsSync(COFFEE)
				console.log('\ncoffee watch:')
				spawn(NODE, [COFFEE, '-wco', config.COFFEE_OUT_PATH, config.COFFEE_SRC_PATH], {output:true, cwd:APP_PATH})  # background
				complete()  # continue while coffee runs in background
			(complete) ->
				return complete()  if !config.DOCPAD_SRC_PATH or !fsUtil.existsSync(DOCPAD)
				console.log('\ndocpad run:')
				spawn(NODE, [DOCPAD, 'run'], {output:true, cwd:APP_PATH})  # background
				complete()  # continue while docpad runs in background
		])

	verify: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ncake compile')
				actions.compile(opts, complete)
			(complete) ->
				console.log('\neslint:')
				spawn(ESLINT, [config.ESLINT_SRC_PATH], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				console.log('\nnpm test:')
				spawn(NPM, ['test'], {output:true, cwd:APP_PATH}, complete)
		])

	meta: (opts, next) ->
		# Steps
		steps(next, [
			(complete) ->
				return complete()  if !config.DOCCO_SRC_PATH or !fsUtil.existsSync(DOCCO)
				console.log('\ndocco compile:')
				command = "#{NODE} #{DOCCO} -o #{config.DOCCO_OUT_PATH} #{config.DOCCO_SRC_PATH}"
				exec(command, {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !config.BISCOTTO_SRC_PATH or !fsUtil.existsSync(BISCOTTO)
				console.log('\nbiscotto compile:')
				command = """#{BISCOTTO} -n #{PACKAGE_DATA.title or PACKAGE_DATA.name} --title "#{PACKAGE_DATA.title or PACKAGE_DATA.name} API Documentation" -r README.md -o #{config.BISCOTTO_OUT_PATH} #{config.BISCOTTO_SRC_PATH} - LICENSE.md HISTORY.md"""
				exec(command, {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !fsUtil.existsSync(YUIDOC)
				console.log('\nyuidoc compile:')
				command = [YUIDOC]
				command.push('-o', config.YUIDOC_OUT_PATH)  if config.YUIDOC_OUT_PATH
				command.push(config.YUIDOC_SRC_PATH)  if config.YUIDOC_SRC_PATH
				spawn(NODE, command, {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				return complete()  if !fsUtil.existsSync(PROJECTZ)
				console.log('\nprojectz compile')
				spawn(NODE, [PROJECTZ, 'compile'], {output:true, cwd:APP_PATH}, complete)
		])

	prerelease: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ncake verify')
				actions.verify(opts, complete)
			(complete) ->
				console.log('\ncake meta')
				actions.meta(opts, complete)
		])

	release: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ncake prerelease')
				actions.prerelease(opts, complete)
			(complete) ->
				console.log('\nnpm publish:')
				spawn(NPM, ['publish'], {output:true, cwd:APP_PATH}, complete)
				# ^ npm will run prepublish and postpublish for us
			(complete) ->
				console.log('\ncake postrelease')
				actions.postrelease(opts, complete)
		])

	postrelease: (opts,next) ->
		# Steps
		steps(next, [
			(complete) ->
				console.log('\ngit tag:')
				spawn(GIT, ['tag', 'v'+PACKAGE_DATA.version, '-a'], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				console.log('\ngit push origin master:')
				spawn(GIT, ['push', 'origin', 'master'], {output:true, cwd:APP_PATH}, complete)
			(complete) ->
				console.log('\ngit push tags:')
				spawn(GIT, ['push', 'origin', '--tags'], {output:true, cwd:APP_PATH}, complete)
		])


# =====================================
# Commands

commands =
	clean:       'clean up instance'
	setup:       'setup our project for development'
	compile:     'compile our files (includes setup)'
	watch:       'compile our files initially, and again for each change (includes setup)'
	verify:      'verify our project works (includes compile)'
	meta:        'compile our meta files'
	prerelease:  'prepare our project for publishing (includes verify and compile)'
	release:     'publish our project using npm (includes prerelease and postrelease)'
	postrelease: 'prepare our project after publishing'
aliases =
	install:     'setup'
	test:        'verify'
	docs:        'meta'
	prepare:     'prerelease'
	prepublish:  'prerelease'
	publish:     'release'
	postpublish: 'postpublish'

Object.keys(commands).forEach (key) ->
	description = commands[key]
	actualMethod = actions[key]
	task key, description, (opts) ->  actualMethod(opts, finish)

Object.keys(aliases).forEach (desiredMethodName) ->
	actualMethodName = aliases[desiredMethodName]
	actualMethod = actions[actualMethodName]
	description = "alias for #{actualMethodName}"
	task desiredMethodName, description, (opts) ->  actualMethod(opts, finish)

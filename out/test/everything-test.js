// Generated by CoffeeScript 1.6.3
var Task, TaskGroup, delay, expect, joe, wait, _ref;

expect = require('chai').expect;

joe = require('joe');

_ref = require('../../'), Task = _ref.Task, TaskGroup = _ref.TaskGroup;

wait = function(delay, fn) {
  return setTimeout(fn, delay);
};

delay = 100;

joe.describe('task', function(describe, it) {
  describe("basic", function(suite, it) {
    it('should work with async', function(done) {
      var checks, task;
      checks = 0;
      task = new Task(function(complete) {
        return wait(delay, function() {
          ++checks;
          expect(task.result, "result to be null as we haven't set it yet").to.eql(null);
          return complete(null, 10);
        });
      });
      task.on('complete', function(err, result) {
        ++checks;
        expect(task.result, "the set result to be as expected as the task has completed").to.eql([err, result]);
        expect(err, "the callback error to be null as we did not error").to.eql(null);
        return expect(result, "the callback result to be as expected").to.eql(10);
      });
      expect(task.running, "running to be false as we haven't started running yet").to.eql(false);
      expect(task.result, "result to be null as we haven't started running yet").to.eql(null);
      task.run();
      expect(task.running, 'running to be true as tasks execute asynchronously').to.eql(true);
      expect(task.result, 'result to be null as tasks execute asynchronously').to.eql(null);
      return wait(delay * 2, function() {
        ++checks;
        expect(checks, "all our special checks have run").to.eql(3);
        return done();
      });
    });
    return it('should work with sync', function(done) {
      var checks, task;
      checks = 0;
      task = new Task(function() {
        ++checks;
        expect(task.result, "result to be null as we haven't set it yet").to.eql(null);
        return 10;
      });
      task.on('complete', function(err, result) {
        ++checks;
        expect(task.result, "the set result to be as expected as the task has completed").to.eql([err, result]);
        expect(err, "the callback error to be null as we did not error").to.eql(null);
        return expect(result, "the callback result to be as expected").to.eql(10);
      });
      expect(task.running, "running to be false as we haven't started running yet").to.eql(false);
      expect(task.result, "result to be null as we haven't started running yet").to.eql(null);
      task.run();
      expect(task.running, 'running to be true as tasks execute asynchronously').to.eql(true);
      expect(task.result, 'result to be null as tasks execute asynchronously').to.eql(null);
      return wait(delay, function() {
        ++checks;
        expect(checks, "all our special checks have run").to.eql(3);
        return done();
      });
    });
  });
  describe("errors", function(suite, it) {
    it('should detect return error on synchronous task', function(done) {
      var checks, err, errMessage, task;
      checks = 0;
      errMessage = 'deliberate return error';
      err = new Error(errMessage);
      task = new Task(function() {
        ++checks;
        expect(task.result, "result to be null as we haven't set it yet").to.eql(null);
        return err;
      });
      task.on('complete', function(_err, result) {
        ++checks;
        expect(task.result, "the set result to be as expected as the task has completed").to.eql([err]);
        expect(_err, "the callback error to be set as we errord").to.eql(err);
        return expect(result, "the callback result to be null we errord").to.not.exist;
      });
      expect(task.running, "running to be false as we haven't started running yet").to.eql(false);
      expect(task.result, "result to be null as we haven't started running yet").to.eql(null);
      task.run();
      expect(task.running, 'running to be true as tasks execute asynchronously').to.eql(true);
      expect(task.result, 'result to be null as tasks execute asynchronously').to.eql(null);
      return wait(delay, function() {
        ++checks;
        expect(checks, "all our special checks have run").to.eql(3);
        return done();
      });
    });
    it('should detect sync throw error on synchronous task', function(done) {
      var checks, err, errMessage, neverReached, task;
      checks = 0;
      neverReached = false;
      errMessage = 'deliberate sync throw error';
      err = new Error(errMessage);
      task = new Task(function() {
        ++checks;
        expect(task.result, "result to be null as we haven't set it yet").to.eql(null);
        throw err;
      });
      task.on('complete', function(_err, result) {
        return neverReached = true;
      });
      task.on('error', function(_err) {
        ++checks;
        return expect(_err, "the callback error to be set as we errord").to.eql(err);
      });
      expect(task.running, "running to be false as we haven't started running yet").to.eql(false);
      expect(task.result, "result to be null as we haven't started running yet").to.eql(null);
      task.run();
      expect(task.running, 'running to be true as tasks execute asynchronously').to.eql(true);
      expect(task.result, 'result to be null as tasks execute asynchronously').to.eql(null);
      return wait(delay, function() {
        ++checks;
        expect(checks, "all our special checks have run").to.eql(3);
        expect(neverReached, "never reached to be false").to.eql(false);
        return done();
      });
    });
    return it('should detect async throw error on asynchronous task', function(done) {
      var checks, err, errMessage, neverReached, task;
      if (process.versions.node.substr(0, 3) === '0.8') {
        console.log('skip this test on node 0.8 because domains behave differently');
        return done();
      }
      checks = 0;
      neverReached = false;
      errMessage = 'deliberate async throw error';
      err = new Error(errMessage);
      task = new Task(function(done) {
        return wait(delay, function() {
          ++checks;
          expect(task.result, "result to be null as we haven't set it yet").to.eql(null);
          throw err;
        });
      });
      task.on('complete', function(_err, result) {
        return neverReached = true;
      });
      task.on('error', function(_err) {
        ++checks;
        return expect(_err, "the callback error to be set as we errord").to.eql(err);
      });
      expect(task.running, "running to be false as we haven't started running yet").to.eql(false);
      expect(task.result, "result to be null as we haven't started running yet").to.eql(null);
      task.run();
      expect(task.running, 'running to be true as tasks execute asynchronously').to.eql(true);
      expect(task.result, 'result to be null as tasks execute asynchronously').to.eql(null);
      return wait(delay * 2, function() {
        ++checks;
        expect(checks, "all our special checks have run").to.eql(3);
        expect(neverReached, "never reached to be false").to.eql(false);
        return done();
      });
    });
  });
  return describe("arguments", function(suite, it) {
    it('should work with arguments in sync', function(done) {
      var checks, task;
      checks = 0;
      task = new Task(function(a, b) {
        ++checks;
        expect(task.result).to.eql(null);
        return a * b;
      });
      task.setConfig({
        args: [2, 5]
      });
      task.on('complete', function(err, result) {
        ++checks;
        expect(task.result).to.eql([err, result]);
        expect(err).to.eql(null);
        return expect(result).to.eql(10);
      });
      wait(1000, function() {
        ++checks;
        expect(checks).to.eql(3);
        return done();
      });
      return task.run();
    });
    return it('should work with arguments in async', function(done) {
      var checks, task;
      checks = 0;
      task = new Task(function(a, b, complete) {
        return wait(500, function() {
          ++checks;
          expect(task.result).to.eql(null);
          return complete(null, a * b);
        });
      });
      task.setConfig({
        args: [2, 5]
      });
      task.on('complete', function(err, result) {
        ++checks;
        expect(task.result).to.eql([err, result]);
        expect(err).to.eql(null);
        return expect(result).to.eql(10);
      });
      wait(1000, function() {
        ++checks;
        expect(checks).to.eql(3);
        return done();
      });
      return task.run();
    });
  });
});

joe.describe('taskgroup', function(describe, it) {
  describe("basic", function(suite, it) {
    it('should work when running in serial', function(done) {
      var tasks;
      tasks = new TaskGroup().setConfig({
        concurrency: 1
      }).on('complete', function(err, results) {
        expect(err).to.eql(null);
        expect(results).to.eql([[null, 10], [null, 5]]);
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(0);
        expect(tasks.concurrency).to.eql(1);
        return done();
      });
      tasks.addTask(function(complete) {
        expect(tasks.remaining.length).to.eql(1);
        expect(tasks.running).to.eql(1);
        return wait(500, function() {
          expect(tasks.remaining.length).to.eql(1);
          expect(tasks.running).to.eql(1);
          return complete(null, 10);
        });
      });
      tasks.addTask(function() {
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(1);
        return 5;
      });
      return tasks.run();
    });
    return it('should work when running in parallel', function(done) {
      var tasks;
      tasks = new TaskGroup().setConfig({
        concurrency: 0
      }).on('complete', function(err, results) {
        expect(err).to.eql(null);
        expect(results).to.eql([[null, 5], [null, 10]]);
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(0);
        expect(tasks.concurrency).to.eql(0);
        return done();
      });
      tasks.addTask(function(complete) {
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(2);
        return wait(500, function() {
          expect(tasks.remaining.length).to.eql(0);
          expect(tasks.running).to.eql(1);
          return complete(null, 10);
        });
      });
      tasks.addTask(function() {
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(2);
        return 5;
      });
      return tasks.run();
    });
  });
  return describe("errors", function(suite, it) {
    it('should handle error correctly in parallel', function(done) {
      var tasks;
      tasks = new TaskGroup().setConfig({
        concurrency: 0
      }).on('complete', function(err, results) {
        expect(err.message).to.eql('deliberate error');
        expect(results.length).to.eql(1);
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(1);
        expect(tasks.concurrency).to.eql(0);
        return done();
      });
      tasks.addTask(function(complete) {
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(2);
        wait(500, function() {
          var err;
          err = new Error('deliberate error');
          return complete(err);
        });
        return null;
      });
      tasks.addTask(function() {
        var err;
        expect(tasks.remaining.length).to.eql(0);
        expect(tasks.running).to.eql(2);
        err = new Error('deliberate error');
        return err;
      });
      return tasks.run();
    });
    return it('should handle error correctly in serial', function(done) {
      var tasks;
      tasks = new TaskGroup().setConfig({
        concurrency: 1
      }).on('complete', function(err, results) {
        expect(err.message).to.eql('deliberate error');
        expect(results.length).to.eql(1);
        expect(tasks.remaining.length).to.eql(1);
        expect(tasks.running).to.eql(0);
        expect(tasks.concurrency).to.eql(1);
        return done();
      });
      tasks.addTask(function(complete) {
        var err;
        expect(tasks.remaining.length).to.eql(1);
        expect(tasks.running).to.eql(1);
        err = new Error('deliberate error');
        return complete(err);
      });
      tasks.addTask(function() {
        throw 'unexpected';
      });
      return tasks.run();
    });
  });
});

joe.describe('inline', function(describe, it) {
  return it('should work', function(done) {
    var checks, tasks;
    checks = [];
    tasks = new TaskGroup('my tests', function(addGroup, addTask) {
      expect(this.name).to.eql('my tests');
      addTask('my task', function(complete) {
        checks.push('my task 1');
        expect(this.name).to.eql('my task');
        expect(tasks.remaining.length).to.eql(1);
        expect(tasks.running).to.eql(1);
        return wait(500, function() {
          checks.push('my task 2');
          expect(tasks.remaining.length).to.eql(1);
          expect(tasks.running).to.eql(1);
          return complete();
        });
      });
      return addGroup('my group', function(addGroup, addTask) {
        checks.push('my group');
        expect(this.name).to.eql('my group');
        expect(tasks.remaining.length, 'my group remaining').to.eql(0);
        expect(tasks.running).to.eql(1);
        return addTask('my second task', function() {
          checks.push('my second task');
          expect(this.name).to.eql('my second task');
          expect(tasks.remaining.length, 'my second task remaining').to.eql(0);
          return expect(tasks.running).to.eql(1);
        });
      });
    });
    return tasks.on('complete', function(err) {
      if (err) {
        console.log(err);
      }
      expect(err).to.eql(null);
      if (checks.length !== 4) {
        console.log(checks);
      }
      expect(checks.length, 'checks').to.eql(4);
      return done();
    });
  });
});

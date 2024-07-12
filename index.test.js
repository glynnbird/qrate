/* eslint-env mocha */
const test = require('node:test')
const qrate = require('./index.js')
const assert = require('assert')

// several tests of these tests are flakey with timing issues
//  this.retries(3)

test('basics', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    const delays = [40, 10, 60, 10]

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3

    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callOrder.push('process ' + task)
        callback('error', 'arg') // eslint-disable-line 
      }, delays.shift())
    }, 2)

    q.push(1, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 1)
      callOrder.push('callback ' + 1)
    })
    q.push(2, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 2)
      callOrder.push('callback ' + 2)
    })
    q.push(3, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 0)
      callOrder.push('callback ' + 3)
    })
    q.push(4, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 0)
      callOrder.push('callback ' + 4)
    })
    assert.equal(q.length(), 4)
    assert.equal(q.concurrency, 2)

    q.drain = function () {
      assert.deepEqual(callOrder, [
        'process 2', 'callback 2',
        'process 1', 'callback 1',
        'process 4', 'callback 4',
        'process 3', 'callback 3'
      ])
      assert.equal(q.concurrency, 2)
      assert.equal(q.length(), 0)
      resolve()
    }
  })
})

test('default concurrency', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    const delays = [40, 10, 60, 10]

    // order of completion: 1,2,3,4
    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callOrder.push('process ' + task)
        callback('error', 'arg') // eslint-disable-line 
      }, delays.shift())
    })

    q.push(1, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 3)
      callOrder.push('callback ' + 1)
    })
    q.push(2, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 2)
      callOrder.push('callback ' + 2)
    })
    q.push(3, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 1)
      callOrder.push('callback ' + 3)
    })
    q.push(4, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 0)
      callOrder.push('callback ' + 4)
    })
    assert.equal(q.length(), 4)
    assert.equal(q.concurrency, 1)

    q.drain = function () {
      assert.deepEqual(callOrder, [
        'process 1', 'callback 1',
        'process 2', 'callback 2',
        'process 3', 'callback 3',
        'process 4', 'callback 4'
      ])
      assert.equal(q.concurrency, 1)
      assert.equal(q.length(), 0)
      resolve()
    }
  })
})

test('zero concurrency', function () {
  assert.throws(function () {
    qrate(function (task, callback) {
      callback(null, task)
    }, 0)
  })
})

test('rate limiting', async function () {
  return new Promise((resolve, reject) => {
    // this is a long-running test
    // this.timeout(4000)
    const callOrder = []
    const delays = [40, 10, 60, 10]

    // order of completion: 1,2,3,4
    // create queue that only complete 1 task a second
    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callOrder.push('process ' + task)
        callback('error', 'arg') // eslint-disable-line 
      }, delays.shift())
    }, 1, 1)
    const start = new Date().getTime()

    q.push(1, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 3)
      callOrder.push('callback ' + 1)
    })
    q.push(2, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 2)
      callOrder.push('callback ' + 2)
    })
    q.push(3, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 1)
      callOrder.push('callback ' + 3)
    })
    q.push(4, function (err, arg) {
      assert.equal(err, 'error')
      assert.equal(arg, 'arg')
      assert.equal(q.length(), 0)
      callOrder.push('callback ' + 4)
    })
    assert.equal(q.length(), 4)
    assert.equal(q.concurrency, 1)

    q.drain = function () {
      assert.deepEqual(callOrder, [
        'process 1', 'callback 1',
        'process 2', 'callback 2',
        'process 3', 'callback 3',
        'process 4', 'callback 4'
      ])
      assert.equal(q.concurrency, 1)
      assert.equal(q.length(), 0)
      q.kill()
      // with 4 tasks, running at 1 per second
      // this test should take over 3 seconds
      assert.equal((new Date().getTime() - start > 3), true)
      resolve()
    }
  })
})

test('error propagation', async function () {
  return new Promise((resolve, reject) => {
    const results = []

    const q = qrate(function (task, callback) {
      callback(task.name === 'foo' ? new Error('fooError') : null)
    }, 2)

    q.drain = function () {
      assert.deepEqual(results, ['bar', 'fooError'])
      resolve()
    }

    q.push({ name: 'bar' }, function (err) {
      if (err) {
        results.push('barError')
        return
      }
      results.push('bar')
    })

    q.push({ name: 'foo' }, function (err) {
      if (err) {
        results.push('fooError')
        return
      }
      results.push('foo')
    })
  })
})

// The original queue implementation allowed the concurrency to be changed only
// on the same event loop during which a task was added to the queue. This
// test attempts to be a more robust test.
// Start with a concurrency of 1. Wait until a leter event loop and change
// the concurrency to 2. Wait again for a later loop then verify the concurrency
// Repeat that one more time by chaning the concurrency to 5.
test('changing concurrency', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callback()
      }, 10)
    }, 1)

    for (let i = 0; i < 50; i++) {
      q.push('')
    }

    q.drain = function () {
      resolve()
    }

    setTimeout(function () {
      assert.equal(q.concurrency, 1)
      q.concurrency = 2
      setTimeout(function () {
        assert.equal(q.running(), 2)
        q.concurrency = 5
        setTimeout(function () {
          assert.equal(q.running(), 5)
        }, 40)
      }, 40)
    }, 40)
  })
})

test('push without callback', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    const delays = [40, 10, 60, 10]
    const concurrencyList = []
    let running = 0

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3
    const q = qrate(function (task, callback) {
      running++
      concurrencyList.push(running)
      setTimeout(function () {
        callOrder.push('process ' + task)
        running--
        callback('error', 'arg') // eslint-disable-line 
      }, delays.shift())
    }, 2)

    q.push(1)
    q.push(2)
    q.push(3)
    q.push(4)

    q.drain = function () {
      assert.equal(running, 0)
      assert.deepEqual(concurrencyList, [1, 2, 2, 2])
      assert.deepEqual(callOrder, [
        'process 2',
        'process 1',
        'process 4',
        'process 3'
      ])
      resolve()
    }
  })
})

test('push with non-function', function () {
  const q = qrate(function () {}, 1)
  assert.throws(function () {
    q.push({}, 1)
  })
})

test('unshift', async function () {
  return new Promise((resolve, reject) => {
    const queueOrder = []
    const q = qrate(function (task, callback) {
      queueOrder.push(task)
      callback()
    }, 1)

    q.unshift(4)
    q.unshift(3)
    q.unshift(2)
    q.unshift(1)

    setTimeout(function () {
      assert.deepEqual(queueOrder, [1, 2, 3, 4])
      resolve()
    }, 100)
  })
})

test('too many callbacks', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function (task, callback) {
      callback()
      assert.throws(function () {
        callback()
      })
      resolve()
    }, 2)
    q.push(1)
  })
})

test('bulk task', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    const delays = [40, 10, 60, 10]

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3
    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callOrder.push('process ' + task)
        callback('error', task) // eslint-disable-line
      }, delays.splice(0, 1)[0])
    }, 2)

    q.push([1, 2, 3, 4], function (err, arg) {
      assert.equal(err, 'error')
      callOrder.push('callback ' + arg)
    })

    assert.equal(q.length(), 4)
    assert.equal(q.concurrency, 2)

    q.drain = function () {
      assert.deepEqual(callOrder, [
        'process 2', 'callback 2',
        'process 1', 'callback 1',
        'process 4', 'callback 4',
        'process 3', 'callback 3'
      ])
      assert.equal(q.concurrency, 2)
      assert.equal(q.length(), 0)
      resolve()
    }
  })
})

test('idle', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function (task, callback) {
      // Queue is busy when workers are running
      assert.equal(q.idle(), false)
      callback()
    }, 1)

    // Queue is idle before anything added
    assert.equal(q.idle(), true)

    q.unshift(4)
    q.unshift(3)
    q.unshift(2)
    q.unshift(1)

    // Queue is busy when tasks added
    assert.equal(q.idle(), false)

    q.drain = function () {
      // Queue is idle after drain
      assert.equal(q.idle(), true)
      resolve()
    }
  })
})

test('pause', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    let running = 0
    const concurrencyList = []
    const pauseCalls = ['process 1', 'process 2', 'process 3']
    const q = qrate(function (task, callback) {
      running++
      callOrder.push('process ' + task)
      concurrencyList.push(running)
      setTimeout(function () {
        running--
        callback()
      }, 10)
    }, 2)

    q.push(1)
    q.push(2, after2)
    q.push(3)

    function after2 () {
      q.pause()
      assert.deepEqual(concurrencyList, [1, 2, 2])
      assert.deepEqual(callOrder, pauseCalls)
      setTimeout(whilePaused, 5)
      setTimeout(afterPause, 10)
    }

    function whilePaused () {
      q.push(4)
    }

    function afterPause () {
      assert.deepEqual(concurrencyList, [1, 2, 2])
      assert.deepEqual(callOrder, pauseCalls)
      q.resume()
      q.push(5)
      q.push(6)
      q.drain = drain
    }
    function drain () {
      assert.deepEqual(concurrencyList, [1, 2, 2, 1, 2, 2])
      assert.deepEqual(callOrder, [
        'process 1',
        'process 2',
        'process 3',
        'process 4',
        'process 5',
        'process 6'
      ])
      resolve()
    }
  })
})

test('pause in worker with concurrency', async function () {
  return new Promise((resolve, reject) => {
    const callOrder = []
    const q = qrate(function (task, callback) {
      if (task.isLongRunning) {
        q.pause()
        setTimeout(function () {
          callOrder.push(task.id)
          q.resume()
          callback()
        }, 50)
      } else {
        callOrder.push(task.id)
        setTimeout(callback, 10)
      }
    }, 10)

    q.push({ id: 1, isLongRunning: true })
    q.push({ id: 2 })
    q.push({ id: 3 })
    q.push({ id: 4 })
    q.push({ id: 5 })

    q.drain = function () {
      assert.deepEqual(callOrder, [1, 2, 3, 4, 5])
      resolve()
    }
  })
})

test('start paused', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function (task, callback) {
      setTimeout(function () {
        callback()
      }, 40)
    }, 2)
    q.pause()
    q.push([1, 2, 3])

    setTimeout(function () {
      assert.equal(q.running(), 0)
      q.resume()
    }, 5)

    setTimeout(function () {
      assert.equal(q.length(), 1)
      assert.equal(q.running(), 2)
      q.resume()
    }, 15)

    q.drain = function () {
      resolve()
    }
  })
})

test('kill', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function () {
      setTimeout(function () {
        throw new Error('Function should never be called')
      }, 20)
    }, 1)
    q.drain = function () {
      throw new Error('Function should never be called')
    }

    q.push(0)

    q.kill()

    setTimeout(function () {
      assert.equal(q.length(), 0)
      resolve()
    }, 40)
  })
})

test('events', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      // nop
      calls.push('process ' + task)
      setTimeout(cb, 10)
    }, 3)
    q.concurrency = 3

    q.saturated = function () {
      assert.equal(q.running(), 3) // queue should be saturated now
      calls.push('saturated')
    }
    q.empty = function () {
      assert.equal(q.length(), 0) // queue should be empty now
      calls.push('empty')
    }
    q.drain = function () {
      // queue should be empty now and no more workers should be running
      assert.equal(q.length(), 0)
      assert.equal(q.running(), 0)
      calls.push('drain')
      assert.deepEqual(calls, [
        'process foo',
        'process bar',
        'saturated',
        'process zoo',
        'foo cb',
        'saturated',
        'process poo',
        'bar cb',
        'empty',
        'saturated',
        'process moo',
        'zoo cb',
        'poo cb',
        'moo cb',
        'drain'
      ])
      resolve()
    }
    q.push('foo', function () { calls.push('foo cb') })
    q.push('bar', function () { calls.push('bar cb') })
    q.push('zoo', function () { calls.push('zoo cb') })
    q.push('poo', function () { calls.push('poo cb') })
    q.push('moo', function () { calls.push('moo cb') })
  })
})

test('empty', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      // nop
      calls.push('process ' + task)
      setImmediate(cb)
    }, 3)

    q.drain = function () {
      // queue should be empty now and no more workers should be running
      assert.equal(q.length(), 0)
      assert.equal(q.running(), 0)
      calls.push('drain')
      assert.deepEqual(calls, ['drain'])
      resolve()
    }
    q.push([])
  })
})

// #1367
test('empty and not idle()', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      // nop
      calls.push('process ' + task)
      setImmediate(cb)
    }, 1)

    q.empty = function () {
      calls.push('empty')
      assert.equal(q.idle(), false) // tasks should be running when empty is called
      assert.equal(q.running(), 1)
    }

    q.drain = function () {
      calls.push('drain')
      assert.deepEqual(calls, [
        'empty',
        'process 1',
        'drain'
      ])
      resolve()
    }
    q.push(1)
  })
})

test('saturated', async function () {
  return new Promise((resolve, reject) => {
    let saturatedCalled = false
    const q = qrate(function (task, cb) {
      setImmediate(cb)
    }, 2)

    q.saturated = function () {
      saturatedCalled = true
    }
    q.drain = function () {
      assert.equal(saturatedCalled, true) // saturated not called
      resolve()
    }

    q.push(['foo', 'bar', 'baz', 'moo'])
  })
})

test('started', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(function (task, cb) {
      cb(null, task)
    })

    assert.equal(q.started, false)
    q.push([])
    assert.equal(q.started, true)
    resolve()
  })
})

test('should call the saturated callback if tasks length is concurrency', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      calls.push('process ' + task)
      setImmediate(cb)
    }, 4)
    q.saturated = function () {
      calls.push('saturated')
    }
    q.empty = function () {
      setTimeout(function () {
        assert.deepEqual(calls, [
          'process foo0',
          'process foo1',
          'process foo2',
          'saturated',
          'process foo3',
          'foo0 cb',
          'saturated',
          'process foo4',
          'foo1 cb',
          'foo2 cb',
          'foo3 cb',
          'foo4 cb'
        ])
        resolve()
      }, 50)
    }
    q.push('foo0', function () { calls.push('foo0 cb') })
    q.push('foo1', function () { calls.push('foo1 cb') })
    q.push('foo2', function () { calls.push('foo2 cb') })
    q.push('foo3', function () { calls.push('foo3 cb') })
    q.push('foo4', function () { calls.push('foo4 cb') })
  })
})

test('should have a default buffer property that equals 25% of the concurrenct rate', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      // nop
      calls.push('process ' + task)
      setImmediate(cb)
    }, 10)
    assert.equal(q.buffer, 2.5)
    resolve()
  })
})

test('should allow a user to change the buffer property', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      // nop
      calls.push('process ' + task)
      setImmediate(cb)
    }, 10)
    q.buffer = 4
    assert.notEqual(q.buffer, 2.5)
    assert.equal(q.buffer, 4)
    resolve()
  })
})

test('should call the unsaturated callback if tasks length is less than concurrency minus buffer', async function () {
  return new Promise((resolve, reject) => {
    const calls = []
    const q = qrate(function (task, cb) {
      calls.push('process ' + task)
      setImmediate(cb)
    }, 4)
    q.unsaturated = function () {
      calls.push('unsaturated')
    }
    q.empty = function () {
      assert.equal(calls.indexOf('unsaturated') > 1, true)
      setTimeout(function () {
        assert.deepEqual(calls, [
          'process foo0',
          'process foo1',
          'process foo2',
          'process foo3',
          'foo0 cb',
          'unsaturated',
          'process foo4',
          'foo1 cb',
          'unsaturated',
          'foo2 cb',
          'unsaturated',
          'foo3 cb',
          'unsaturated',
          'foo4 cb',
          'unsaturated'
        ])
        resolve()
      }, 50)
    }
    q.push('foo0', function () { calls.push('foo0 cb') })
    q.push('foo1', function () { calls.push('foo1 cb') })
    q.push('foo2', function () { calls.push('foo2 cb') })
    q.push('foo3', function () { calls.push('foo3 cb') })
    q.push('foo4', function () { calls.push('foo4 cb') })
  })
})

test('remove', async function () {
  return new Promise((resolve, reject) => {
    const result = []
    const q = qrate(function (data, cb) {
      result.push(data)
      setImmediate(cb)
    })

    q.push([1, 2, 3, 4, 5])

    q.remove(function (node) {
      return node.data === 3
    })

    q.drain = function () {
      assert.deepEqual(result, [1, 2, 4, 5])
      resolve()
    }
  })
})

test('promises', async function () {
  return new Promise((resolve, reject) => {
    const q = qrate(async (task, callback) => {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          resolve({ ok: true, task })
        })
      })
    }, 2)

    q.push(1)
    q.push(2)
    assert.equal(q.length(), 2)
    assert.equal(q.concurrency, 2)

    q.drain = function () {
      assert.equal(q.concurrency, 2)
      assert.equal(q.length(), 0)
      resolve()
    }
  })
})

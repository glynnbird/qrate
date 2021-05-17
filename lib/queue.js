
const onlyOnce = require('./onlyOnce.js')
const DLL = require('./DLL.js')
const wrapAsync = require('./wrapAsync.js')

const noop = () => { }

function queue (worker, concurrency, rateLimit) {
  if (concurrency == null) {
    concurrency = 1
  } else if (concurrency === 0) {
    throw new RangeError('Concurrency must not be zero')
  }

  if (typeof rateLimit === 'number' && rateLimit <= 0) {
    throw new Error('rateLimit must greater than zero')
  }

  var _worker = wrapAsync(worker)
  var numRunning = 0
  var workersList = []
  var tokens = 0
  var interval = null
  var timer = null

  /**
   * Enhanced Resumeable Timer That acts as setInterval
   * https://gist.github.com/ncou/3a0a1f89c8e22416d0d607f621a948a9
   */
  function RecurringTimer (callback, delay) {
    var timerId, start
    var remaining = delay

    this.pause = function () {
      this.isPaused = true
      clearTimeout(timerId)
      remaining -= new Date() - start
    }

    var resume = function () {
      this.isPaused = false
      start = new Date()
      timerId = setTimeout(function () {
        remaining = delay
        resume()
        callback()
      }, remaining)
    }

    this.resume = resume
    this.remainingTime = remaining

    this.resume()
  }

  function rateLimitInterval () {
    // reset tokens back to full capacity after each interval
    tokens = rateLimit
    q.process()
  }
  // add tokens to the token count at the given rateLimit
  if (rateLimit) {
    tokens = (rateLimit > 1) ? rateLimit : 1
    timer = new RecurringTimer(rateLimitInterval, 1000)
  }

  var processingScheduled = false
  function _insert (data, insertAtFront, callback) {
    if (callback != null && typeof callback !== 'function') {
      throw new Error('task callback must be a function')
    }
    q.started = true
    if (!Array.isArray(data)) {
      data = [data]
    }
    if (data.length === 0 && q.idle()) {
      // call drain immediately if there are no tasks
      return setImmediate(() => q.drain())
    }

    var previousTasksLength = q._tasks.length

    for (var i = 0, l = data.length; i < l; i++) {
      var item = {
        data: data[i],
        callback: callback || noop
      }

      if (insertAtFront) {
        q._tasks.unshift(item)
      } else {
        q._tasks.push(item)
      }
    }

    if (!processingScheduled) {
      // only immediately starting queue if it was empty before
      if (previousTasksLength === 0) {
        processingScheduled = true
        setImmediate(() => {
          processingScheduled = false
          q.process()
        })
      }
      // resuming timer if queue is rate limited
      if (rateLimit && timer.isPaused) {
        timer.resume()
      }
    }
  }

  function _next (tasks) {
    return function (err, ...args) {
      numRunning -= 1

      for (var i = 0, l = tasks.length; i < l; i++) {
        var task = tasks[i]

        var index = workersList.indexOf(task)
        if (index === 0) {
          workersList.shift()
        } else if (index > 0) {
          workersList.splice(index, 1)
        }

        task.callback(err, ...args)

        if (err != null) {
          q.error(err, task.data)
        }
      }

      if (numRunning <= (q.concurrency - q.buffer)) {
        q.unsaturated()
      }

      if (q.idle()) {
        q.drain()
      }
      q.process()
    }
  }

  var isProcessing = false
  var q = {
    _tasks: new DLL(),
    * [Symbol.iterator] () {
      yield * q._tasks[Symbol.iterator]()
    },
    concurrency,
    saturated: noop,
    unsaturated: noop,
    buffer: concurrency / 4,
    empty: noop,
    drain: noop,
    error: noop,
    started: false,
    paused: false,
    push (data, callback) {
      _insert(data, false, callback)
    },
    kill () {
      q.drain = noop
      q._tasks.empty()
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    },
    unshift (data, callback) {
      _insert(data, true, callback)
    },
    remove (testFn) {
      q._tasks.remove(testFn)
    },
    process () {
      // Avoid trying to start too many processing operations. This can occur
      // when callbacks resolve synchronously (#1267).
      if (isProcessing) {
        return
      }
      isProcessing = true
      while (!q.paused && numRunning < q.concurrency && q._tasks.length && (!rateLimit || (rateLimit && tokens >= 1))) { // eslint-disable-line no-unmodified-loop-condition
        var tasks = []; var data = []
        var node = q._tasks.shift()
        tasks.push(node)
        data.push(node.data)
        numRunning += 1
        workersList.push(tasks[0])

        if (rateLimit) {
          tokens--
        }

        if (q._tasks.length === 0) {
          q.empty()
          // Pausing timer when queue is empty to save resources
          if (rateLimit) {
            timer.pause()
            // Restoring tokens back to full capacity after current second passing
            setTimeout(() => {
              if (q._tasks.length === 0) tokens = rateLimit
            }, timer.remainingTime)
          }
        }

        if (numRunning === q.concurrency) {
          q.saturated()
        }

        var cb = onlyOnce(_next(tasks))
        _worker(data, cb)
      }
      isProcessing = false
    },
    length () {
      return q._tasks.length
    },
    running () {
      return numRunning
    },
    workersList () {
      return workersList
    },
    idle () {
      return q._tasks.length + numRunning === 0
    },
    pause () {
      q.paused = true
    },
    resume () {
      if (q.paused === false) { return }
      q.paused = false
      setImmediate(q.process)
    }
  }
  return q
}
module.exports = queue

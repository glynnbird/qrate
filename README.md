# qrate

[![Build Status](https://travis-ci.org/glynnbird/qrate.svg?branch=master)](https://travis-ci.org/glynnbird/qrate) [![npm version](https://badge.fury.io/js/qrate.svg)](https://badge.fury.io/js/qrate)

## Introduction

The queue library based on the [async.queue](http://caolan.github.io/async/docs.html#queue) utility but modified to allow a queue's throughput to be controlled in terms of:

- concurrency - the maximum number of workers running at any point in time
- rateLimit - the maximum number of workers started per second

The default behaviour is a `concurrency` of 1 (one worker at a time) and a `rateLimit` of null (no rate limiting).

The *qrate* library can be used as a drop-in replacement for the [async.queue](http://caolan.github.io/async/docs.html#queue) function.

## Installation

Install with

```sh
npm install qrate
```

or to import it into your Node.js project:

```sh
npm install --save qrate
```

## Usage

A queue is created by calling `qrate` passing in the the worker function you want to operate on each item in the queue. The returned `q` can then be used to push data into the queue.

```js

// require qrate library
const qrate = require('qrate');

// mark the start time of this script
const start = new Date().getTime();

// worker function that calls back after 100ms
const worker = function(data, done) {

  // your worker code goes here
  // 'data' contains the queue to work on
  // call 'done' when finished.


  // output a message including a timestamp
  console.log('Processing', data, '@', new Date().getTime() - start, 'ms');

  // call the 'done' function after 100ms
  setTimeout(done, 100);
};

// create a queue with default properties (concurrency = 1, rateLimit = null)
// using our 'worker' function to process each item in the queue
const q = qrate(worker);

// add ten things to the queue
for (let i = 0; i < 10; i++) {
  q.push({ i: i });
}
```

The queue has the default `concurrency` of 1, so worker starts after its predecessor finishes:

```sh
Processing { i: 0 } @ 21 ms
Processing { i: 1 } @ 129 ms
Processing { i: 2 } @ 233 ms
Processing { i: 3 } @ 338 ms
Processing { i: 4 } @ 441 ms
Processing { i: 5 } @ 545 ms
Processing { i: 6 } @ 650 ms
Processing { i: 7 } @ 751 ms
Processing { i: 8 } @ 852 ms
Processing { i: 9 } @ 958 ms
```

We can increase the number of workers running in parallel by passing a `concurrency` value as a second parameter:

```js

// create a queue where up to three workers run at any time
const q = qrate(worker, 3);
```

which speeds things up significantly:

```
Processing { i: 0 } @ 27 ms
Processing { i: 1 } @ 33 ms
Processing { i: 2 } @ 35 ms
Processing { i: 3 } @ 134 ms
Processing { i: 4 } @ 135 ms
Processing { i: 5 } @ 135 ms
Processing { i: 6 } @ 235 ms
Processing { i: 7 } @ 235 ms
Processing { i: 8 } @ 236 ms
Processing { i: 9 } @ 340 ms
```

So far we have not done anything that a normal `async.queue` could do. This is where the third parameter comes in.

## Rate limiting the queue

If you want to limit the rate of throughput of the queue (e.g. 5 jobs per second), then you can pass a third `rateLimit`  parameter to `qrate`. The `rateLimit` indicates the maximum number workers per second you want the queue to start:

- rateLimit = 1 - one per second
- rateLimit = 5 - five per second
- rateLimit = 0.5 - one every two seconds
- rateLimit = null - as fast as possible (default)

```js
// concurrency 1, rateLimit 2 workers per second
const q = qrate(worker, 1, 2);
```

which produces the output:

```
Processing { i: 0 } @ 16 ms
Processing { i: 1 } @ 126 ms
Processing { i: 2 } @ 1007 ms
Processing { i: 3 } @ 1111 ms
Processing { i: 4 } @ 2013 ms
Processing { i: 5 } @ 2118 ms
Processing { i: 6 } @ 3018 ms
Processing { i: 7 } @ 3124 ms
Processing { i: 8 } @ 4025 ms
Processing { i: 9 } @ 4127 ms
```

Notice how in the early part of each second, two workers are executed in turn, then the queue waits until the next second boundary before resuming work again.

Rate-limiting is useful if you want to ensure that the number of API calls your code generates stays below the API provider's quota, e.g. five API calls per second.

## Worker functions with callbacks

Your worker function can be a standard JavaScript function with two parameters

- the payload - the data that your function receives from the queue.
- a callback - you call this function to indicate that the worker has finished its work.

```js
// worker function that calls back after 100ms
const worker = function(data, done) {
  // let's imagine we're writing data to a database
  // This is typically an asynchronous action.
  db.insert(data, function(err, insertData) {
    // now we can call the callback function to show that we're finished
    done(err, insertData)
  })
};
```

## Work functions with Promises

Alternatively, a more modern pattern is to define your worker function as an `async` function. This allows you to deal with asynchronous activity, like database calls, without callbacks. This time the function only accepts one parameter:

```js
const worker = async (data) => {
  const insertData = await db.insert(data)
  return {ok: true}
};
```

## Detecting that the queue is empty

If you create a `q.drain` function, it will be called when the queue size reaches zero. This can be used as a trigger to publish results, fetch more work or to kill the queue & tidy up. (see Killing the queue).

```js
q.drain = () => {
  // all of the queue items have been processed
  console.log('the queue is empty');
}
```

## Killing the queue

A rate-limited `qrate` queue sets up a timer to handle the throttling of a rate-limited queue. The queue can be cleaned up by calling the `q.kill()` function.

If your application is working through a single list of work, the you can provide a `q.drain` function that is called when a queue is emptied and call `q.kill` in that function:

```js
q.drain = () => {
  console.log('the queue is empty');
  q.kill();
};
```

or, simply tie the `drain` and `kill` functions together:

```js
q.drain = q.kill;
```

In other applications, you may wish to keep the queue alive and periodically feed it with fresh work. 








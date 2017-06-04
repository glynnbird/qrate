# qrate

[![Build Status](https://travis-ci.org/glynnbird/qrate.svg?branch=master)](https://travis-ci.org/glynnbird/qrate) [![npm version](https://badge.fury.io/js/qrate.svg)](https://badge.fury.io/js/qrate)

## Introduction

The queue module based on queue from the [async](https://caolan.github.io/async/) library but modified to allow the queues throughput to be controlled in terms of:

- concurrency - the maximum number of workers running at any point in time
- rateLimit - the maximum number of workers to be started per second

The default behaviour is a `concurrency` of 1 (one worker at a time) and a `rateLimit` of null (no rate limiting).

The qrate library can be used as a drop-in replacement for the async.queue function.

## Installation

Install with

```sh
npm install qrate
```

or to import it into your Node.js project:

```
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
for (var i = 0; i < 10; i++) {
  q.push({ i: i });
}
```

As the queue has the default `concurrency` of 1, only one worker is executing at any one time so each item in the queue takes 100ms:

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

We can increase the concurrency to deal with work at a faster rate (to process workers in parallel) by passing a `concurrency` value as a second parameter:

```js

// create a queue where up to three workers run at any time
var q = qrate(worker, 3);
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

If you want to limit that rate of throughput of the queue (e.g. 5 jobs per second), then you can pass a third paramter to `qrate`. This is the `rateLimit` parameter which is a number that indicates how many jobs per second you want the queue to consume:

- rateLimit = 1 - one per second
- rateLimit = 5 - five per second
- rateLimit = 0.5 - one every two seconds
- rateLimit = null - as fast as possible (default)

```js
// concurrency 1, rateLimit 2 workers per second
var q = qrate(worker, 1, 2);
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

## Killing the queue

Unlike a normal queue, a timer is set up to handle the throttling of a rate-limited queue. The queue
can be cleaned up by calling the `q.kill()` function.

The `q.drain` function is called when a queue is emptied:

```js
q.drain = funcion() {
  console.log('the queue is empty');
};
```

so if you want the queue to stop when empty, then call `q.kill` in that function:

```
q.drain = funcion() {
  console.log('the queue is empty');
  q.kill();
};
```

or 

```
q.drain = q.kill;
```

In other applications, you may wish to keep the queue alive and periodically feed it with fresh work.








const asyncify = require('./asyncify.js')
const isAsync = require('./isAsync.js')

function wrapAsync (asyncFn) {
  if (typeof asyncFn !== 'function') throw new Error('expected a function')
  return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn
}

module.exports = wrapAsync

import asyncify from './asyncify.js'
import isAsync from './isAsync.js'

export default function wrapAsync (asyncFn) {
  if (typeof asyncFn !== 'function') throw new Error('expected a function')
  return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn
}


function isAsync (fn) {
  return fn[Symbol.toStringTag] === 'AsyncFunction'
}

module.exports = isAsync

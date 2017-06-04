const asyncify = require('./asyncify.js');

const supportsSymbol = typeof Symbol === 'function';

const isAsync = function (fn) {
  return supportsSymbol && fn[Symbol.toStringTag] === 'AsyncFunction';
};

const wrapAsync = function (asyncFn) {
  return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn;
};

module.exports = wrapAsync;

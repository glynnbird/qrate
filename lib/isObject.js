const isObject = function (obj) {
  return obj != null && typeof obj === 'object';
};

module.exports = isObject;
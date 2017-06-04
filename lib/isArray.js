const isArray = function (obj) {
  return obj != null && obj.constructor === Array;
};

module.exports = isArray;
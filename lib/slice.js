const slice = function (arrayLike, start) {
  start = start | 0;
  var newLen = Math.max(arrayLike.length - start, 0);
  var newArr = Array(newLen);
  for (var idx = 0; idx < newLen; idx++) {
    newArr[idx] = arrayLike[start + idx];
  }
  return newArr;
}

module.exports = slice;
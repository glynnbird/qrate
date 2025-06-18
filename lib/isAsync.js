export default function isAsync (fn) {
  return fn[Symbol.toStringTag] === 'AsyncFunction'
}


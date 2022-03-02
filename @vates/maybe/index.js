'use strict'

class Maybe {}

function isMaybe(value) {
  return value instanceof Maybe
}

function unwrap(value) {
  return isMaybe(value) ? value.unwrap() : value
}

class None extends Maybe {
  map(fn) {
    return this
  }

  unwrap() {
    throw new TypeError('cannot unwrap None')
  }

  unwrapOr(defaultValue) {
    return unwrap(defaultValue)
  }

  unwrapOrElse(defaultGenerator) {
    return unwrap(defaultGenerator())
  }
}
const NONE = new None()
exports.NONE = NONE

function some(value) {
  return isMaybe(value) ? value : new Some(value)
}
exports.some = some
class Some extends Maybe {
  #value

  constructor(value) {
    super()

    this.#value = unwrap(value)
  }

  map(fn) {
    return some(fn(this.#value))
  }

  unwrap() {
    return this.#value
  }

  unwrapOr(defaultValue) {
    return this.#value
  }

  unwrapOrElse(defaultGenerator) {
    return this.#value
  }
}

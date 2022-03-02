<!-- DO NOT EDIT MANUALLY, THIS FILE HAS BEEN GENERATED -->

# @vates/maybe

> Minimal Maybe/Option monad to help handling optional values

## Usage

```js
import * as Maybe from '@vates/maybe'
```

### `NONE`

> `Maybe` not containing a value.

```js
const maybe = Maybe.NONE
```

### `some(value)`

> Creates a `Maybe` containing a value.

```js
const maybe = Maybe.some('foo')
```

`Maybe`s are flattened:

- `some(NONE)` → `NONE`
- `some(some(value))` → `some(value)`

### `Maybe#map(fn)`

> Applies a function to the contained value if any.

```js
const maybe = some('foo')
assert.strictEqual(maybe.map(_ => _.length).unwrap(), 3)

const maybe = NONE
assert.strictEqual(
  maybe.map(_ => _.length),
  NONE
)
```

### `Maybe#unwrap()`

> Returns the contained value if any, otherwise throws a `TypeError`

```js
assert.strictEqual(Maybe.some('foo').unwrap(), 'foo')

assert.throws(() => NONE.unwrap(), {
  name: 'TypeError',
  message: 'cannot unwrap None',
})
```

### `Maybe.unwrapOr(defaultValue)`

> Returns the contained value if any, otherwise returns `defaultValue`.

```js
assert.strictEqual(Maybe.some('foo').unwrapOr('bar'), 'foo')

assert.strictEqual(Maybe.NONE.unwrapOr('bar'), 'bar')
```

### `Maybe.unwrapOrElse(defaultGenerator)`

> Returns the contained value if any, otherwise returns the result of `defaultGenerator`.

```js
assert.strictEqual(
  Maybe.some('foo').unwrapOrElse(() => 'bar'),
  'foo'
)

assert.strictEqual(
  Maybe.NONE.unwrapOrElse(() => 'bar'),
  'bar'
)
```

## Contributions

Contributions are _very_ welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/vatesfr/xen-orchestra/issues)
  you've encountered;
- fork and create a pull request.

## License

[ISC](https://spdx.org/licenses/ISC) © [Vates SAS](https://vates.fr)

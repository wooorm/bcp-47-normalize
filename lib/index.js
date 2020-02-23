'use strict'

var bcp47 = require('bcp-47')
var match = require('bcp-47-match')
var matches = require('./matches.json')
var fields = require('./fields.json')
var defaults = require('./defaults.json')
var many = require('./many.json')

module.exports = normalize

var own = {}.hasOwnProperty

var parse = bcp47.parse
var stringify = bcp47.stringify

var collator = new Intl.Collator()

function normalize(value, options) {
  var opts = options || {}
  var forgiving = opts.forgiving
  var warning = opts.warning
  // 1. normalize and lowercase the tag (`sgn-be-fr` -> `sfb`).
  var schema = parse(String(value || '').toLowerCase(), {forgiving, warning})
  var tag = stringify(schema)
  // 2. Do fancy, expensive replaces (`ha-latn-gh` -> `ha-gh`).
  var length = matches.length
  var index = -1
  var d

  if (tag === '') {
    return tag
  }

  while (++index < length) {
    d = matches[index]
    if (match.extendedFilter(tag, d.from).length !== 0) {
      replace(schema, d.from, d.to)
      tag = stringify(schema)
    }
  }

  // 3. Do basic field replaces (`en-840` -> `en-us`).
  length = fields.length
  index = -1

  while (++index < length) {
    d = fields[index]

    if (remove(schema, d.from.field, d.from.value)) {
      add(schema, d.to.field, d.to.value)
    }
  }

  // 4. Remove defaults (`nl-nl` -> `nl`).
  tag = stringify(schema)
  length = defaults.length
  index = -1

  while (++index < length) {
    d = defaults[index]

    if (
      d === tag ||
      (tag.charAt(d.length) === '-' && tag.slice(0, d.length) === d)
    ) {
      tag = d.slice(0, d.lastIndexOf('-')) + tag.slice(d.length)
    }
  }

  // 5. Add proper casing back.
  schema = parse(tag)

  // 6. Sort extensions on singleton.
  schema.extensions.sort(compareSingleton)

  // 7. Warn if fields (currently only regions) should be updated but have
  // multiple choices.
  if (warning) {
    for (d in many) {
      if (own.call(many[d], schema[d])) {
        warning(
          'Deprecated ' +
            d +
            ' `' +
            schema[d] +
            '`, expected one of `' +
            many[d][schema[d]].join('`, `') +
            '`',
          null,
          7
        )
      }
    }
  }

  // Format script (ISO 15924) as titlecase (example: `Latn`):
  if (schema.script !== null) {
    schema.script =
      schema.script.charAt(0).toUpperCase() + schema.script.slice(1)
  }

  // Format region (ISO 3166) as uppercase (note: this doesn’t affect numeric
  // codes, which is fine):
  if (schema.region !== null) {
    schema.region = schema.region.toUpperCase()
  }

  return stringify(schema)
}

function replace(schema, from, to) {
  var left = parse(from)
  var right = parse(to)
  var removed = []
  var key

  // Remove values from `from`:
  for (key in left) {
    if (defined(left[key]) && remove(schema, key, left[key])) {
      removed.push(key)
    }
  }

  // Add values from `to`:
  for (key in right) {
    // Only add values that are defined on `to`, and that were either removed by
    // `from` or are currently empty.
    if (
      defined(right[key]) &&
      (removed.indexOf(key) !== -1 || !defined(schema[key]))
    ) {
      add(schema, key, right[key])
    }
  }
}

function remove(obj, key, value) {
  var removed = false
  var current
  var result
  var length
  var index
  var val

  /* istanbul ignore else - this is currently done by wrapping code, so else is
   * never reached.
   * However, that could change in the future, so leave this guard here. */
  if (value) {
    current = obj[key]
    result = current

    if (array(current)) {
      result = []
      length = current.length
      index = -1
      while (++index < length) {
        val = current[index]

        if (value.indexOf(val) === -1) {
          result.push(val)
        } else {
          removed = true
        }
      }
    } else if (current === value) {
      result = null
      removed = true
    }

    obj[key] = result
  }

  return removed
}

function add(obj, key, value) {
  var current = obj[key]
  var list
  var length
  var index
  var val

  if (array(current)) {
    list = [].concat(value)
    length = list.length
    index = -1

    while (++index < length) {
      val = list[index]

      /* istanbul ignore else - this currently can’t happen, but guard for the
       * future. */
      if (current.indexOf(val) === -1) {
        current.push(val)
      }
    }
  } else {
    obj[key] = value
  }
}

function defined(value) {
  return value !== null && value.length !== 0
}

function array(value) {
  return value !== null && typeof value === 'object'
}

function compareSingleton(left, right) {
  return compare(singleton(left), singleton(right))
}

function compare(left, right) {
  /* istanbul ignore next - equality can’t happen in BCP 47 tags, but let’s keep
   * it in as a guard. */
  return left === right ? 0 : collator.compare(left, right)
}

function singleton(value) {
  return value.singleton
}

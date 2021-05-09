/**
 * @typedef {import('bcp-47/lib/parse.js').ParseOptions['warning']} Warning
 * @typedef {import('bcp-47/lib/parse.js').Schema} Schema
 * @typedef {import('bcp-47/lib/parse.js').Extension} Extension
 *
 * @typedef Options
 * @property {boolean} [forgiving]
 * @property {Warning} [warning]
 */

import {parse, stringify} from 'bcp-47'
import {extendedFilter} from 'bcp-47-match'
import {matches} from './matches.js'
import {fields} from './fields.js'
import {defaults} from './defaults.js'
import {many} from './many.js'

var own = {}.hasOwnProperty

var collator = new Intl.Collator()

/** @type {Partial<Schema>} */
var emptyExtraFields = {
  variants: [],
  extensions: [],
  privateuse: [],
  irregular: null,
  regular: null
}

/**
 * @param {string} value
 * @param {Options} [options]
 * @returns {string}
 */
export function bcp47Normalize(value, options) {
  var settings = options || {}
  // 1. normalize and lowercase the tag (`sgn-be-fr` -> `sfb`).
  var schema = parse(String(value || '').toLowerCase(), settings)
  var tag = stringify(schema)
  var index = -1
  /** @type {string} */
  var key

  if (!tag) {
    return tag
  }

  // 2. Do fancy, expensive replaces (`ha-latn-gh` -> `ha-gh`).
  while (++index < matches.length) {
    if (extendedFilter(tag, matches[index].from).length > 0) {
      replace(schema, matches[index].from, matches[index].to)
      tag = stringify(schema)
    }
  }

  // 3. Do basic field replaces (`en-840` -> `en-us`).
  index = -1

  while (++index < fields.length) {
    if (remove(schema, fields[index].from.field, fields[index].from.value)) {
      add(schema, fields[index].to.field, fields[index].to.value)
    }
  }

  // 4. Remove defaults (`nl-nl` -> `nl`).
  tag = stringify(Object.assign({}, schema, emptyExtraFields))
  index = -1

  while (++index < defaults.length) {
    if (tag === defaults[index]) {
      replace(
        schema,
        defaults[index],
        defaults[index].split('-').slice(0, -1).join('-')
      )
      tag = stringify(Object.assign({}, schema, emptyExtraFields))
    }
  }

  // 5. Sort extensions on singleton.
  schema.extensions.sort(compareSingleton)

  // 6. Warn if fields (currently only regions) should be updated but have
  // multiple choices.
  if (settings.warning) {
    for (key in many) {
      if (own.call(many[key], schema[key])) {
        settings.warning(
          'Deprecated ' +
            key +
            ' `' +
            schema[key] +
            '`, expected one of `' +
            many[key][schema[key]].join('`, `') +
            '`',
          null,
          7
        )
      }
    }
  }

  // 7. Add proper casing back.
  // Format script (ISO 15924) as titlecase (example: `Latn`):
  if (schema.script) {
    schema.script =
      schema.script.charAt(0).toUpperCase() + schema.script.slice(1)
  }

  // Format region (ISO 3166) as uppercase (note: this doesn’t affect numeric
  // codes, which is fine):
  if (schema.region) {
    schema.region = schema.region.toUpperCase()
  }

  return stringify(schema)
}

/**
 * @param {Schema} schema
 * @param {string} from
 * @param {string} to
 * @returns {void}
 */
function replace(schema, from, to) {
  var left = parse(from)
  var right = parse(to)
  /** @type {Array.<string>} */
  var removed = []
  /** @type {string} */
  var key

  // Remove values from `from`:
  for (key in left) {
    if (left[key] && left[key].length > 0 && remove(schema, key, left[key])) {
      removed.push(key)
    }
  }

  // Add values from `to`:
  for (key in right) {
    // Only add values that are defined on `to`, and that were either removed by
    // `from` or are currently empty.
    if (
      right[key] &&
      right[key].length > 0 &&
      (removed.includes(key) || !schema[key] || schema[key].length === 0)
    ) {
      add(schema, key, right[key])
    }
  }
}

/**
 * @param {Schema} object
 * @param {string} key
 * @param {string|Array.<string>} value
 * @returns {boolean}
 */
function remove(object, key, value) {
  var removed = false
  /** @type {string|Array.<string>} */
  var current
  /** @type {string|Array.<string>} */
  var result
  /** @type {number} */
  var index
  /** @type {string} */
  var item

  /* istanbul ignore else - this is currently done by wrapping code, so else is
   * never reached.
   * However, that could change in the future, so leave this guard here. */
  if (value) {
    current = object[key]
    result = current

    if (current && typeof current === 'object') {
      result = []
      index = -1

      while (++index < current.length) {
        item = current[index]

        if (value.includes(item)) {
          removed = true
        } else {
          result.push(item)
        }
      }
    } else if (current === value) {
      result = null
      removed = true
    }

    object[key] = result
  }

  return removed
}

/**
 * @param {Schema} object
 * @param {string} key
 * @param {string|Array.<string>} value
 * @returns {void}
 */
function add(object, key, value) {
  var current = object[key]
  /** @type {Array.<string>} */
  var list
  /** @type {number} */
  var index
  /** @type {string} */
  var item

  if (current && typeof current === 'object') {
    list = [].concat(value)
    index = -1

    while (++index < list.length) {
      item = list[index]

      /* istanbul ignore else - this currently can’t happen, but guard for the
       * future. */
      if (!current.includes(item)) {
        current.push(item)
      }
    }
  } else {
    object[key] = value
  }
}

/**
 * @param {Extension} left
 * @param {Extension} right
 * @returns {number}
 */
function compareSingleton(left, right) {
  return collator.compare(left.singleton, right.singleton)
}

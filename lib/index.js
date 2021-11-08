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
import {many} from './many.js'
import {likely} from './likely.js'

const own = {}.hasOwnProperty

const collator = new Intl.Collator()

/**
 * @param {Schema} base
 * @param {Partial<Schema>} changes
 * @returns {Schema}
 */
function merge(base, changes) {
  if (!base.language) base.language = changes.language
  if (!base.script) base.script = changes.script
  if (!base.region) base.region = changes.region
  if (changes.variants) base.variants.push(...changes.variants)

  return base
}

/**
 * Mostly like:
 * <https://github.com/formatjs/formatjs/blob/a15e757/packages/intl-locale/index.ts#L254>
 * But doesn’t crash.
 *
 * @param {Schema} schema
 * @returns {string}
 */
function addLikelySubtags(schema) {
  const {language, script, region} = schema
  /** @type {string} */
  let match

  if (
    script &&
    region &&
    (match = likely[stringify({language, script, region})])
  ) {
    schema.script = undefined
    schema.region = undefined
  } else if (script && (match = likely[stringify({language, script})])) {
    schema.script = undefined
  } else if (region && (match = likely[stringify({language, region})])) {
    schema.region = undefined
  } else if ((match = likely[language])) {
    // Empty.
  }

  if (match) {
    schema.language = undefined
    merge(schema, parse(match))
  }

  return stringify(schema)
}

/**
 * @param {Schema} schema
 */
function removeLikelySubtags(schema) {
  addLikelySubtags(schema)

  const {language, script, region} = schema

  if (!language) return schema

  const maxLocale = stringify({language, script, region})

  if (maxLocale === addLikelySubtags(parse(language))) {
    schema.script = undefined
    schema.region = undefined
  } else if (
    region &&
    maxLocale === addLikelySubtags(parse(language + '-' + region))
  ) {
    schema.script = undefined
  } else if (
    script &&
    maxLocale === addLikelySubtags(parse(language + '-' + script))
  ) {
    schema.region = undefined
  }

  return schema
}

/**
 * @param {string} value
 * @param {Options} [options]
 * @returns {string}
 */
export function bcp47Normalize(value, options) {
  const settings = options || {}
  // 1. normalize and lowercase the tag (`sgn-be-fr` -> `sfb`).
  const schema = parse(String(value || '').toLowerCase(), settings)
  const tag = stringify(schema)

  if (!tag) {
    return tag
  }

  let index = -1

  // 2. Do fancy, expensive replaces (`ha-latn-gh` -> `ha-gh`).
  while (++index < matches.length) {
    let from = matches[index].from

    if (from.slice(0, 4) === 'und-' && schema.language) {
      from = schema.language + from.slice(3)
    }

    if (extendedFilter(tag, from).length > 0) {
      replace(schema, from, matches[index].to)
    }
  }

  // 3. Do basic field replaces (`en-840` -> `en-us`).
  index = -1

  while (++index < fields.length) {
    if (remove(schema, fields[index].from.field, fields[index].from.value)) {
      add(schema, fields[index].to.field, fields[index].to.value)
    }
  }

  // 4. Minimize.
  removeLikelySubtags(schema)

  // 5. Sort variants, and sort extensions on singleton.
  schema.variants.sort(collator.compare)
  schema.extensions.sort(compareSingleton)

  // 6. Warn if fields (currently only regions) should be updated but have
  // multiple choices.
  if (settings.warning) {
    /** @type {string} */
    let key

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
  const left = parse(from)
  const right = parse(to)
  /** @type {Array.<string>} */
  const removed = []
  /** @type {string} */
  const lang = left.language
  /** @type {string} */
  let key

  // Remove values from `from`:
  for (key in left) {
    if (left[key] && remove(schema, key, left[key])) {
      removed.push(key)
    }
  }

  // Add values from `to`:
  for (key in right) {
    // Only add values that are defined on `to`, and that were either removed by
    // `from` or are currently empty.
    if (right[key] && (removed.includes(key) || !schema[key])) {
      add(
        schema,
        key,
        key === 'language' && right[key] === 'und' ? lang : right[key]
      )
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
  let removed = false
  /** @type {string|Array.<string>} */
  let result

  /* istanbul ignore else - this is currently done by wrapping code, so else is
   * never reached.
   * However, that could change in the future, so leave this guard here. */
  if (value) {
    /** @type {string|Array.<string>} */
    const current = object[key]
    result = current

    if (current && typeof current === 'object') {
      result = []
      let index = -1

      while (++index < current.length) {
        const item = current[index]

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
  /** @type {string|Array.<string>} */
  const current = object[key]

  if (Array.isArray(current)) {
    const list = Array.isArray(value) ? value : [value]
    /** @type {number} */
    let index = -1

    while (++index < list.length) {
      const item = list[index]

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

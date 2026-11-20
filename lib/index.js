/**
 * @import {Extension, Schema, Warning} from 'bcp-47'
 */

/**
 * @typedef Options
 *   Configuration for `bcp47Normalize`.
 * @property {boolean | null | undefined} [forgiving=false]
 *   Keep what was found before an error,
 *   instead of returning an empty string (default: `false`);
 *   passed to `bcp-47` as `options.forgiving`.
 * @property {Warning | null | undefined} [warning]
 *   Called when an error is found (optional);
 *   passed to `bcp-47` as `options.warning`;
 *   one additional warning is given,
 *   with code `-1`,
 *   when a deprecated region cannot be fixed automatically
 *   (because it was split into multiple regions).
 */

import {parse, stringify} from 'bcp-47'
import {extendedFilter} from 'bcp-47-match'
import {matches} from './matches.js'
import {fields} from './fields.js'
import {many} from './many.js'
import {likely} from './likely.js'

const own = {}.hasOwnProperty

/**
 * Fill missing fields in `base` from `changes`.
 *
 * @param {Schema} base
 *   Schema to change.
 * @param {Partial<Schema>} changes
 *   Fields to add.
 * @returns {Schema}
 *   `base`.
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
 *   Schema to change.
 * @returns {string}
 *   Maximized tag.
 */
function addLikelySubtags(schema) {
  const {language, script, region} = schema
  /** @type {string|undefined} */
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
  } else if (language && (match = likely[language])) {
    // Empty.
  }

  if (match) {
    schema.language = undefined
    merge(schema, parse(match))
  }

  return stringify(schema)
}

/**
 * Remove likely subtags.
 *
 * @param {Schema} schema
 *   Schema to change.
 * @returns {Schema}
 *   `schema`.
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
 * Normalize the given BCP 47 tag according to Unicode CLDR suggestions.
 *
 * @param {string} tag
 *   BCP 47 tag.
 * @param {Options | null | undefined} [options]
 *   Configuration (optional).
 * @returns {string}
 *   Normal, canonical, and pretty BCP 47 tag.
 */
export function bcp47Normalize(tag, options) {
  const settings = options || {}
  const input = String(tag || '').toLowerCase()
  // 1. normalize and lowercase the tag (`sgn-be-fr` -> `sfb`).
  const schema = parse(input, settings)
  const value = stringify(schema)

  if (!value) {
    return value
  }

  let index = -1

  // 2. Do fancy, expensive replaces (`ha-latn-gh` -> `ha-gh`).
  while (++index < matches.length) {
    let {from} = matches[index]

    if (from.slice(0, 4) === 'und-' && schema.language) {
      from = schema.language + from.slice(3)
    }

    if (extendedFilter(value, from).length > 0) {
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
  schema.variants.sort()
  schema.extensions.sort(compareSingleton)

  // 6. Warn if fields (currently only regions) should be updated but have
  // multiple choices.
  if (settings.warning) {
    /** @type {keyof many} */
    let key

    for (key in many) {
      if (own.call(many, key)) {
        const map = many[key]
        const value = schema[key]
        if (value && own.call(map, value)) {
          const replacements = map[value]
          // Region is in the input after the language.
          const subtags = input.split('-')
          const before = subtags.slice(0, subtags.indexOf(value, 1))
          const offset = before.join('-').length + 1
          settings.warning(
            'Deprecated ' +
              key +
              ' `' +
              value +
              '`, expected one of `' +
              replacements.join('`, `') +
              '`',
            -1,
            offset
          )
        }
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
 * Replace `from` with `to` in `schema`.
 *
 * @param {Schema} schema
 *   Schema to change.
 * @param {string} from
 *   Tag to remove.
 * @param {string} to
 *   Tag to add.
 * @returns {undefined}
 *   Nothing.
 */
function replace(schema, from, to) {
  const left = parse(from)
  const right = parse(to)
  /** @type {Array<string>} */
  const removed = []
  /** @type {string|null|undefined} */
  const lang = left.language
  /** @type {keyof schema} */
  let key

  // Remove values from `from`:
  for (key in left) {
    if (own.call(left, key)) {
      const value = left[key]
      if (value && remove(schema, key, value)) {
        removed.push(key)
      }
    }
  }

  // Add values from `to`:
  for (key in right) {
    if (own.call(right, key)) {
      const value = right[key]
      // Only add values that are defined on `to`,
      // and that were either removed by `from` or are currently empty.
      if (lang && value && (removed.includes(key) || !schema[key])) {
        add(schema, key, key === 'language' && value === 'und' ? lang : value)
      }
    }
  }
}

/**
 * Remove `value` from `key` in `object`.
 *
 * @param {Schema} object
 *   Schema to change.
 * @param {keyof Schema} key
 *   Field.
 * @param {string|Array<string>|Array<Extension>} value
 *   Value or values to remove.
 * @returns {boolean}
 *   Whether something was removed.
 */
function remove(object, key, value) {
  let removed = false
  /** @type {string|Array<string>|Array<Extension>|null|undefined} */
  let result

  if (value) {
    const current = object[key]
    result = current

    if (Array.isArray(current)) {
      result = []
      let index = -1

      while (++index < current.length) {
        const item = current[index]

        // @ts-expect-error: TS can’t handle the two lists.
        if (value.includes(item)) {
          removed = true
        } else {
          // @ts-expect-error: TS can’t handle the two lists.
          result.push(item)
        }
      }
    } else if (current === value) {
      result = null
      removed = true
    }

    // @ts-expect-error: Assume the value matches.
    object[key] = result
  }

  return removed
}

/**
 * Add `value` to `key` in `object`.
 *
 * @param {Schema} object
 *   Schema to change.
 * @param {keyof Schema} key
 *   Field.
 * @param {string|Array<string>|Array<Extension>} value
 *   Value or values to add.
 * @returns {undefined}
 *   Nothing.
 */
function add(object, key, value) {
  /** @type {string|Array<string>|Array<Extension>|null|undefined} */
  const current = object[key]

  if (Array.isArray(current)) {
    const list = Array.isArray(value) ? value : [value]
    /** @type {number} */
    let index = -1

    while (++index < list.length) {
      const item = list[index]

      // @ts-expect-error: TS can’t handle the two lists.
      if (!current.includes(item)) {
        // @ts-expect-error: TS can’t handle the two lists.
        current.push(item)
      }
    }
  } else {
    // @ts-expect-error: Assume the value matches.
    object[key] = value
  }
}

/**
 * Compare extensions on their singleton.
 *
 * @param {Extension} left
 *   Extension.
 * @param {Extension} right
 *   Other extension.
 * @returns {number}
 *   Order.
 */
function compareSingleton(left, right) {
  if (left.singleton > right.singleton) {
    return 1
  }

  if (left.singleton < right.singleton) {
    return -1
  }

  // It is invalid to have more than one extension with the same singleton so
  // we should never reach this code.
  return 0
}

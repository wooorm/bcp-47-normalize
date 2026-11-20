/**
 * @import {Element} from 'xast'
 */

/**
 * @typedef AddOrRemove
 *   Field and value.
 * @property {string} field
 *   Field (such as `region`).
 * @property {string} value
 *   Value.
 */

/**
 * @typedef FieldChange
 *   Change of a field.
 * @property {AddOrRemove} from
 *   Field and value to remove.
 * @property {AddOrRemove} to
 *   Field and value to add.
 */

/**
 * @typedef LikelySubtagsData
 *   Data in `cldr-core/supplemental/likelySubtags.json`.
 * @property {LikelySubtagsSupplemental} supplemental
 *   Likely subtags and version info.
 */

/**
 * @typedef LikelySubtagsSupplemental
 *   Likely subtags and version info.
 * @property {Record<string, string>} likelySubtags
 *   Map of tags to their likely tags.
 * @property {LikelySubtagsVersion} version
 *   Version info.
 */

/**
 * @typedef LikelySubtagsVersion
 *   Version in `cldr-core/supplemental/likelySubtags.json`.
 * @property {string} _cldrVersion
 *   CLDR version (such as `'49'`).
 */

/**
 * @typedef TagChange
 *   Change of a tag.
 * @property {string} from
 *   Tag to match.
 * @property {string} to
 *   Tag to replace with.
 */

import fs from 'node:fs/promises'
import {fromXml} from 'xast-util-from-xml'
import {visit} from 'unist-util-visit'
import {parse} from 'bcp-47'

const own = {}.hasOwnProperty

/** @type {LikelySubtagsData} */
const data = JSON.parse(
  String(
    await fs.readFile(
      new URL(
        'node_modules/cldr-core/supplemental/likelySubtags.json',
        import.meta.url
      )
    )
  )
)

const {likelySubtags, version} = data.supplemental

/** @type {Record<string, string>} */
const likely = {}
/** @type {string} */
let key

for (key in likelySubtags) {
  if (own.call(likelySubtags, key)) {
    likely[key.toLowerCase()] = likelySubtags[key].toLowerCase()
  }
}

await fs.writeFile(
  new URL('lib/likely.js', import.meta.url),
  [
    '/**',
    ' * @type {Record<string, string>}',
    ' */',
    'export const likely = ' + JSON.stringify(likely, null, 2),
    ''
  ].join('\n')
)

// Aliases from the same CLDR release as `cldr-core` (`49` -> `release-49`,
// `48.1` -> `release-48-1`).
const endpoint =
  'https://raw.githubusercontent.com/unicode-org/cldr/release-' +
  version._cldrVersion.replaceAll('.', '-') +
  '/common/supplemental/supplementalMetadata.xml'

const response = await fetch(endpoint)

if (!response.ok) {
  throw new Error('Cannot fetch `' + endpoint + '`: ' + response.status)
}

const text = await response.text()

/** @type {Array<FieldChange>} */
const fields = []
/** @type {Record<string, Record<string, Array<string>>>} */
const many = {}
/** @type {Array<TagChange>} */
const match = []
const suffix = 'Alias'
let seenHeploc = false
const ignore = new Set([
  // Subdivisions (ISO 3166-2) are not used in BCP 47 tags.
  'subdivision',
  // Timezones.
  'zone'
])

visit(fromXml(text), 'element', onelement)

await fs.writeFile(
  new URL('lib/fields.js', import.meta.url),
  [
    '/**',
    " * @typedef {'language' | 'region' | 'script' | 'variants'} Field",
    ' *   Field.',
    ' *',
    ' * @typedef AddOrRemove',
    ' *   Field and value.',
    ' * @property {Field} field',
    ' *   Field.',
    ' * @property {string} value',
    ' *   Value.',
    ' *',
    ' * @typedef FieldChange',
    ' *   Change of a field.',
    ' * @property {AddOrRemove} from',
    ' *   Field and value to remove.',
    ' * @property {AddOrRemove} to',
    ' *   Field and value to add.',
    ' */',
    '',
    '/**',
    ' * @type {Array<FieldChange>}',
    ' */',
    'export const fields = ' + JSON.stringify(fields, null, 2),
    ''
  ].join('\n')
)

await fs.writeFile(
  new URL('lib/many.js', import.meta.url),
  [
    '/**',
    ' * @type {{region: Record<string, Array<string>>}}',
    ' */',
    'export const many = ' + JSON.stringify(many, null, 2),
    ''
  ].join('\n')
)

await fs.writeFile(
  new URL('lib/matches.js', import.meta.url),
  [
    '/**',
    ' * @typedef TagChange',
    ' *   Change of a tag.',
    ' * @property {string} from',
    ' *   Tag to match.',
    ' * @property {string} to',
    ' *   Tag to replace with.',
    ' */',
    '',
    '/**',
    ' * @type {Array<TagChange>}',
    ' */',
    'export const matches = ' + JSON.stringify(match, null, 2),
    ''
  ].join('\n')
)

/**
 * Handle an element.
 *
 * @param {Element} node
 *   Element.
 * @returns {undefined}
 *   Nothing.
 */
/* eslint-disable-next-line complexity */
function onelement(node) {
  let {name} = node
  const attributes = node.attributes || {}
  const pos = name.indexOf(suffix)

  if (pos === -1) {
    return
  }

  name = name.slice(0, pos)

  if (name === 'territory') {
    name = 'region'
  }

  if (name === 'variant') {
    name = 'variants'
  }

  if (ignore.has(name)) {
    return
  }

  const allFrom = clean(attributes.type)
  const allTo = clean(attributes.replacement)
  /** @type {string} */
  let from
  /** @type {string} */
  let to

  if (allFrom.length === 1) {
    from = allFrom[0]
  } else {
    throw new Error('Cannot map from many: ' + allFrom)
  }

  if (allTo.length === 1) {
    to = allTo[0]
  } else {
    if (!many[name]) {
      many[name] = {}
    }

    many[name][from] = allTo
    return
  }

  if (name === 'region' && from.length === 3 && Number.isNaN(Number(from))) {
    console.log(
      'ISO 3166-1 alpha 3 codes cannot be represented in BCP 47: %s',
      from
    )
    return
  }

  if (name === 'language') {
    const schema = parse(from, {normalize: false})

    if (schema.irregular || schema.regular) {
      console.warn('Ignoring normalized value: %s -> %s', from, to)
      return
    }

    match.push({from, to})
  } else if (name === 'variants') {
    if (from === 'aaland' && to === 'ax') {
      fields.push({
        from: {field: name, value: from},
        to: {field: 'region', value: to}
      })
    } else if (from === 'heploc' && to === 'alalc97') {
      if (seenHeploc) {
        console.warn('Ignoring double heploc alias')
        return
      }

      seenHeploc = true
      fields.push({
        from: {field: name, value: from},
        to: {field: name, value: to}
      })
    } else if (from === 'polytoni' && to === 'polyton') {
      fields.push({
        from: {field: name, value: from},
        to: {field: name, value: to}
      })
    } else if (
      (from === 'arevela' && to === 'hy') ||
      (from === 'arevmda' && to === 'hyw')
    ) {
      fields.push({
        from: {field: name, value: from},
        to: {field: 'language', value: to}
      })
    } else {
      console.warn('Ignoring unknown variant alias', from, to)
    }
  } else {
    fields.push({
      from: {field: name, value: from},
      to: {field: name, value: to}
    })
  }
}

/**
 * Turn a space-separated list of CLDR identifiers into BCP 47 subtags.
 *
 * @param {string|null|undefined} value
 *   Value.
 * @returns {Array<string>}
 *   Subtags.
 */
function clean(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .split(' ')
}

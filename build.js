/**
 * @typedef {import('xast').Element} Element
 *
 * @typedef {{field: string, value: string}} FromTuple
 * @typedef {{from: FromTuple, to: FromTuple}} Field
 * @typedef {{from: string, to: string}} Match
 */

import fs from 'node:fs/promises'
import fetch from 'node-fetch'
import {fromXml} from 'xast-util-from-xml'
import {visit} from 'unist-util-visit'
import {normal} from 'bcp-47/lib/normal.js'

const own = {}.hasOwnProperty

/** @type {{supplemental: {likelySubtags: Record<string, string>}}} */
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

const likelySubtags = data.supplemental.likelySubtags

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

const endpoint =
  'https://raw.githubusercontent.com/unicode-org/cldr/HEAD/common/supplemental/supplementalMetadata.xml'

const response = await fetch(endpoint)
const text = await response.text()

/** @type {Array<Field>} */
const fields = []
/** @type {Record<string, Record<string, Array<string>>>} */
const many = {}
/** @type {Array<Match>} */
const match = []
const suffix = 'Alias'
let seenHeploc = false
const ignore = new Set([
  // Subdivisions (ISO 3166-2) are not used in BCP 47 tags.
  'subdivision',
  // Timezones.
  'zone'
])

// @ts-expect-error: types are wrong?
visit(fromXml(text), 'element', onelement)

await fs.writeFile(
  new URL('lib/fields.js', import.meta.url),
  [
    '/**',
    " * @typedef {'script'|'region'|'variants'} Field",
    ' *',
    ' * @typedef AddOrRemove',
    ' * @property {Field} field',
    ' * @property {string} value',
    ' *',
    ' * @typedef Change',
    ' * @property {AddOrRemove} from',
    ' * @property {AddOrRemove} to',
    ' */',
    '',
    '/**',
    ' * @type {Array<Change>}',
    ' */',
    'export const fields = ' + JSON.stringify(fields, null, 2),
    ''
  ].join('\n')
)

await fs.writeFile(
  new URL('lib/many.js', import.meta.url),
  [
    '/**',
    " * @typedef {'script'|'region'|'variants'} Field",
    ' */',
    '',
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
    ' * @typedef Change',
    ' * @property {string} from',
    ' * @property {string} to',
    ' */',
    '',
    '/**',
    ' * @type {Array<Change>}',
    ' */',
    'export const matches = ' + JSON.stringify(match, null, 2),
    ''
  ].join('\n')
)

/** @param {Element} node */
/* eslint-disable-next-line complexity */
function onelement(node) {
  let name = node.name
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
    if (own.call(normal, from)) {
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
 * @param {string|null|undefined} value
 * @returns {Array<string>}
 */
function clean(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('_', '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .split(' ')
}

/**
 * @typedef {import('xast').Element} Element
 *
 * @typedef {{field: string, value: string}} FromTuple
 * @typedef {{from: FromTuple, to: FromTuple}} Field
 * @typedef {{from: string, to: string}} Match
 */

import fs from 'node:fs'
import path from 'node:path'
import fetch from 'node-fetch'
import {fromXml} from 'xast-util-from-xml'
import {visit} from 'unist-util-visit'
import {normal} from 'bcp-47/lib/normal.js'

var own = {}.hasOwnProperty

/** @type {{supplemental: {likelySubtags: Object.<string, string>}}} */
var data = JSON.parse(
  String(
    fs.readFileSync(
      path.join(
        'node_modules',
        'cldr-core',
        'supplemental',
        'likelySubtags.json'
      )
    )
  )
)

var likelySubtags = data.supplemental.likelySubtags

/** @type {Object.<string, string>} */
var likely = {}
/** @type {string} */
var key

for (key in likelySubtags) {
  if (own.call(likelySubtags, key)) {
    likely[key.toLowerCase()] = likelySubtags[key].toLowerCase()
  }
}

write('likely', likely)

var endpoint =
  'https://raw.githubusercontent.com/unicode-org/cldr/HEAD/common/supplemental/supplementalMetadata.xml'

fetch(endpoint)
  .then((response) => response.text())
  .then(onbody, console.error)

/**
 * @param {string} doc
 */
function onbody(doc) {
  /** @type {Array.<Field>} */
  var fields = []
  /** @type {Object.<string, Object.<string, Array.<string>>>} */
  var many = {}
  /** @type {Array.<Match>} */
  var match = []
  var suffix = 'Alias'
  var seenHeploc = false
  var ignore = new Set([
    // Subdivisions (ISO 3166-2) are not used in BCP 47 tags.
    'subdivision',
    // Timezones.
    'zone'
  ])

  visit(fromXml(doc), 'element', onelement)

  write('fields', fields)
  write('many', many)
  write('matches', match)

  /** @param {Element} node */
  /* eslint-disable-next-line complexity */
  function onelement(node) {
    var name = node.name
    var pos = name.indexOf(suffix)
    /** @type {Array.<string>} */
    var allFrom
    /** @type {Array.<string>} */
    var allTo
    /** @type {string} */
    var from
    /** @type {string} */
    var to

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

    allFrom = clean(node.attributes.type)
    allTo = clean(node.attributes.replacement)

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
}

/**
 * @param {string} value
 * @returns {Array.<string>}
 */
function clean(value) {
  return value
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
}

/**
 * @param {string} name
 * @param {unknown} values
 * @returns {void}
 */
function write(name, values) {
  fs.writeFileSync(
    path.join('lib', name + '.js'),
    'export const ' + name + ' = ' + JSON.stringify(values, null, 2) + '\n'
  )
}

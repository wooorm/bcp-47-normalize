'use strict'

var fs = require('fs')
var path = require('path')
var fetch = require('node-fetch')
var fromXml = require('xast-util-from-xml')
var visit = require('unist-util-visit')
var normalize = require('bcp-47/lib/normalize')

var own = {}.hasOwnProperty

var endpoint =
  'https://raw.githubusercontent.com/unicode-org/cldr/master/common/supplemental/supplementalMetadata.xml'

fetch(endpoint)
  .then(res => res.text())
  .then(onbody, console.error)

function onbody(doc) {
  var fields = []
  var match = []
  var defaults = []
  var many = {}
  var suffix = 'Alias'
  var seenHeploc = false
  var ignore = [
    // Subdivisions (ISO 3166-2) are not used in BCP 47 tags.
    'subdivision',
    // Timezones.
    'zone'
  ]

  visit(fromXml(doc), 'element', onelement)

  write('defaults', defaults)
  write('fields', fields)
  write('many', many)
  write('matches', match)

  /* eslint-disable-next-line complexity */
  function onelement(node) {
    var name = node.name
    var pos = name.indexOf(suffix)
    var from
    var to

    if (name === 'defaultContent') {
      defaults = defaults.concat(clean(node.attributes.locales))
    }

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

    if (ignore.includes(name)) {
      return
    }

    from = clean(node.attributes.type)
    to = clean(node.attributes.replacement)

    if (from.length === 1) {
      from = from[0]
    } else {
      throw new Error('Cannot map from many: ' + from)
    }

    if (to.length === 1) {
      to = to[0]
    } else {
      if (!many[name]) {
        many[name] = {}
      }

      many[name][from] = to
      return
    }

    if (name === 'region' && from.length === 3 && isNaN(from)) {
      console.log(
        'ISO 3166-1 alpha 3 codes cannot be represented in BCP 47: %s',
        from
      )
      return
    }

    if (name === 'language') {
      if (own.call(normalize, from)) {
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

function clean(value) {
  return value
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
}

function write(name, values) {
  fs.writeFileSync(
    path.join('lib', name + '.json'),
    JSON.stringify(values, null, 2) + '\n'
  )
}

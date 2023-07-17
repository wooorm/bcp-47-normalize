/**
 * @typedef {import('bcp-47').Warning} Warning
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {bcp47Normalize as normalize} from './index.js'

const own = {}.hasOwnProperty

test('bcp-47-normalize (basic)', async function (t) {
  // @ts-expect-error runtime.
  assert.equal(normalize(), '', 'should not fail on without a value')
  assert.equal(normalize(''), '', 'should not fail on an empty string')
  assert.equal(normalize('en-us'), 'en', 'should normalize')
  assert.equal(normalize('EN-CYRL-gb'), 'en-Cyrl-GB', 'should fix casing')

  assert.equal(
    normalize('en-gb-abcdefghi'),
    '',
    'should return empty if the tag is invalid by default'
  )

  assert.equal(
    normalize('en-gb-abcdefghi', {forgiving: true}),
    'en-GB',
    'should ignore trailing stuff in forgiving mode'
  )

  await t.test('should emit when given a warning function', function () {
    let called = false

    normalize('en-aaa-bbb-ccc-ddd', {warning})

    assert.equal(called, true, 'should call')

    /** @type {Warning} */
    function warning(reason, code, offset) {
      assert.deepEqual(
        [reason, code, offset],
        [
          'Too many extended language subtags, expected at most 3 subtags',
          3,
          14
        ],
        'warning'
      )
      called = true
    }
  })

  await t.test('should emit if deprecated tags can’t be fixed', function () {
    let called = false

    normalize('pap-an', {warning})

    assert.equal(called, true, 'warning')

    /** @type {Warning} */
    function warning(reason, code, offset) {
      assert.deepEqual(
        [reason, code, offset],
        ['Deprecated region `an`, expected one of `cw`, `sx`, `bq`', -1, 7],
        'warning'
      )
      called = true
    }
  })

  await t.test('should not emit if there are no deprecated tags', function () {
    let called = false

    normalize('pap-cw', {warning})

    assert.equal(called, false, 'warning')

    function warning() {
      called = true
    }
  })
})

test('bcp-47-normalize (normalize)', function () {
  assert.equal(
    normalize('art-lojban'),
    'jbo',
    'should normalize a deprecated regular language'
  )

  assert.equal(
    normalize('i-klingon'),
    'tlh',
    'should normalize a deprecated irregular language'
  )

  assert.equal(
    normalize('in'),
    'id',
    'should normalize a deprecated language (two-letter)'
  )

  assert.equal(
    normalize('krm'),
    'bmf',
    'should normalize a deprecated language (three-letter)'
  )

  assert.equal(
    normalize('no-bokmal'),
    'nb',
    'should normalize a deprecated variant'
  )

  assert.equal(normalize('pa-pk'), 'pa-PK', 'should normalize to add a script')

  assert.equal(
    normalize('ha-latn-gh'),
    'ha-GH',
    'should normalize to remove a script'
  )

  assert.equal(
    normalize('nld'),
    'nl',
    'should normalize overlong language codes'
  )

  assert.equal(normalize('aju'), 'jrb', 'should normalize macrolanguages codes')

  assert.equal(normalize('alb'), 'sq', 'should normalize bibliographic codes')

  assert.equal(normalize('en-qaai'), 'en-Zinh', 'should normalize scripts')

  assert.equal(
    normalize('en-bu'),
    'en-MM',
    'should normalize deprecated regions'
  )

  assert.equal(
    normalize('en-784'),
    'en-AE',
    'should normalize overlong regions'
  )

  assert.equal(
    normalize('sv-aaland'),
    'sv-AX',
    'should normalize legacy variants (1)'
  )

  assert.equal(
    normalize('el-polytoni'),
    'el-polyton',
    'should normalize legacy variants (2)'
  )

  assert.equal(
    normalize('hy-arevela'),
    'hy',
    'should normalize legacy variants (3)'
  )

  assert.equal(
    normalize('hy-arevmda'),
    'hyw',
    'should normalize legacy variants (4)'
  )

  assert.equal(
    normalize('el-polytoni-polyton'),
    'el-polyton',
    'should not duplicate new variants (1)'
  )
  assert.equal(
    normalize('el-polyton-polytoni'),
    'el-polyton',
    'should not duplicate new variants (2)'
  )

  assert.equal(normalize('nl-nl'), 'nl', 'should normalize default regions')

  assert.equal(
    normalize('en-b-warble-a-warble'),
    'en-a-warble-b-warble',
    'should canonicalize extension sequences'
  )
})

test('fixtures', function () {
  /** @type {Record<string, string>} */
  const fixtures = {
    afb: 'afb',
    'ar-afb': 'ar-afb',
    'art-lojban': 'jbo',
    ast: 'ast',
    'az-arab-x-aze-derbend': 'az-IR-x-aze-derbend',
    'az-latn': 'az',
    'cel-gaulish': 'cel-gaulish',
    'cmn-hans-cn': 'zh',
    'de-de-1901': 'de-1901',
    'de-de-x-goethe': 'de-x-goethe',
    'de-deva': 'de-Deva',
    'de-deva-de': 'de-Deva',
    'de-latf-de': 'de-Latf',
    'de-ch-x-phonebk': 'de-CH-x-phonebk',
    'de-de-u-co-phonebk': 'de-u-co-phonebk',
    'de-de': 'de',
    'de-qaaa': 'de-Qaaa',
    de: 'de',
    'eng-840': 'en',
    'en-840': 'en',
    'pt-pt': 'pt-PT',
    'pt-br': 'pt',
    'az-arab-ir': 'az-IR',
    'sl-cyrl-yu-rozaj-solba-1994-b-1234-a-Foobar-x-b-1234-a-Foobar':
      'sl-Cyrl-YU-1994-rozaj-solba-a-foobar-b-1234-x-b-1234-a-foobar',
    'en-gb-oed': 'en-GB-oxendict',
    'en-us-u-islamcal': 'en-u-islamcal',
    'en-us': 'en',
    'en-gb': 'en-GB',
    'en-us-x-twain': 'en-x-twain',
    'en-a-ext1-a-ext2': 'en-a-ext1-a-ext2',
    'en-a-myext-b-another': 'en-a-myext-b-another',
    'en-bu': 'en-MM',
    en: 'en',
    'es-005': 'es-005',
    'es-419': 'es-419',
    'fr-ca': 'fr-CA',
    fr: 'fr',
    hak: 'hak',
    'hy-latn-it-arevela': 'hy-Latn-IT',
    'i-ami': 'ami',
    'i-bnn': 'bnn',
    'i-default': 'i-default',
    'i-enochian': 'i-enochian',
    'i-hak': 'hak',
    'i-klingon': 'tlh',
    'i-lux': 'lb',
    'i-mingo': 'i-mingo',
    'i-navajo': 'nv',
    'i-pwn': 'pwn',
    'i-tao': 'tao',
    'i-tay': 'tay',
    'i-tsu': 'tsu',
    ja: 'ja',
    mas: 'mas',
    'no-bok': 'nb',
    'no-nyn': 'nn',
    'qaa-qaaa-qm-x-southern': 'qaa-Qaaa-QM-x-southern',
    'sgn-be-fr': 'sfb',
    'sgn-be-nl': 'vgt',
    'sgn-ch-de': 'sgg',
    'sl-it-nedis': 'sl-IT-nedis',
    'sl-nedis': 'sl-nedis',
    'sl-rozaj-biske': 'sl-biske-rozaj',
    'sl-rozaj': 'sl-rozaj',
    'sr-cyrl': 'sr',
    'sr-latn-qm': 'sr-Latn-QM',
    'sr-latn-rs': 'sr-Latn',
    'sr-latn': 'sr-Latn',
    'sr-qaaa-rs': 'sr-Qaaa',
    und: 'en',
    'und-GB': 'en-GB',
    'und-arab-cc': 'ms-CC',
    'x-whatever': 'x-whatever',
    'yue-hk': 'yue',
    'zh-cn-a-myext-x-private': 'zh-a-myext-x-private',
    'zh-hans-cn': 'zh',
    'zh-hans': 'zh',
    'zh-hant-hk': 'zh-HK',
    'zh-hant': 'zh-TW',
    'zh-cmn-hans-cn': 'zh',
    'zh-guoyu': 'zh',
    'zh-hakka': 'hak',
    'zh-min-nan': 'nan',
    'zh-min': 'zh-min',
    'zh-xiang': 'hsn',
    'zh-yue-hk': 'yue',
    'zh-yue': 'yue',
    'zh-hans-tw': 'zh-Hans-TW',
    'zh-tw': 'zh-TW'
  }
  /** @type {string} */
  let from

  for (from in fixtures) {
    if (own.call(fixtures, from)) {
      const to = fixtures[from]
      assert.equal(normalize(from), to, '`' + from + '` -> `' + to + '`')
    }
  }
})

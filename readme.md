# bcp-47-normalize

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]

Normalize, canonicalize, and format [BCP 47][spec] tags.

## Install

This package is [ESM only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c):
Node 12+ is needed to use it and it must be `import`ed instead of `require`d.

[npm][]:

```sh
npm install bcp-47-normalize
```

## Use

```js
import {bcp47Normalize} from 'bcp-47-normalize'

var tags = [
  'de-de-1901',
  'en-gb',
  'en-us',
  'en-bu',
  'hy-arevmda',
  'nld-nl',
  'no-nyn',
  'pt-br',
  'pt-pt',
  'zh-hans-cn'
]

tags.forEach(function (tag) {
  console.log('%s -> %s', tag, bcp47Normalize(tag))
})
```

Yields:

```txt
de-de-1901 -> de-1901
en-gb -> en-GB
en-us -> en
en-bu -> en-MM
hy-arevmda -> hyw
nld-nl -> nl
no-nyn -> nn
pt-br -> pt
pt-pt -> pt-PT
zh-hans-cn -> zh
```

## API

This package exports the following identifiers: `bcp47Normalize`.
There is no default export.

### `bcp47Normalize(tag[, options])`

Normalize the given BCP 47 tag according to [Unicode CLDR suggestions][alias].

###### `options.forgiving`

Passed to `bcp-47` as [`options.forgiving`][forgiving].

###### `options.warning`

Passed to `bcp-47` as [`options.warning`][warning].

One additional warning is given:

| code | reason                                                     |
| :--- | :--------------------------------------------------------- |
| 7    | Deprecated region `CURRENT`, expected one of `SUGGESTIONS` |

This warning is only given if the region cannot be automatically fixed (when
regions split into multiple regions).

###### Returns

`string` — Normal, canonical, and pretty [BCP 47][spec] tag.

## Related

*   [`bcp-47`](https://github.com/wooorm/bcp-47-match)
    — Parse and stringify BCP 47 language tags
*   [`bcp-47-match`](https://github.com/wooorm/bcp-47-match)
    — Match BCP 47 language tags with language ranges per RFC 4647
*   [`iso-3166`](https://github.com/wooorm/iso-3166)
    — ISO 3166 codes
*   [`iso-639-2`](https://github.com/wooorm/iso-639-2)
    — ISO 639-2 codes
*   [`iso-639-3`](https://github.com/wooorm/iso-639-3)
    — ISO 639-3 codes
*   [`iso-15924`](https://github.com/wooorm/iso-15924)
    — ISO 15924 codes
*   [`un-m49`](https://github.com/wooorm/un-m49)
    — UN M49 codes

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/wooorm/bcp-47-normalize/workflows/main/badge.svg

[build]: https://github.com/wooorm/bcp-47-normalize/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/wooorm/bcp-47-normalize.svg

[coverage]: https://codecov.io/github/wooorm/bcp-47-normalize

[downloads-badge]: https://img.shields.io/npm/dm/bcp-47-normalize.svg

[downloads]: https://www.npmjs.com/package/bcp-47-normalize

[size-badge]: https://img.shields.io/bundlephobia/minzip/bcp-47-normalize.svg

[size]: https://bundlephobia.com/result?p=bcp-47-normalize

[npm]: https://docs.npmjs.com/cli/install

[license]: license

[author]: https://wooorm.com

[spec]: https://tools.ietf.org/html/bcp47

[alias]: https://github.com/unicode-org/cldr/blob/4b1225ead2ca9bc7a969a271b9931f137040d2bf/common/supplemental/supplementalMetadata.xml#L32

[forgiving]: https://github.com/wooorm/bcp-47#optionsforgiving

[warning]: https://github.com/wooorm/bcp-47#optionswarning

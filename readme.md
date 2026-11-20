# bcp-47-normalize

[![Build][badge-build-image]][badge-build-url]
[![Coverage][badge-coverage-image]][badge-coverage-url]
[![Downloads][badge-downloads-image]][badge-downloads-url]
[![Size][badge-size-image]][badge-size-url]

Normalize, canonicalize, and format [BCP 47][ietf-bcp-47] tags.

## Contents

* [What is this?](#what-is-this)
* [When should I use this?](#when-should-i-use-this)
* [Install](#install)
* [Use](#use)
* [API](#api)
  * [`Options`](#options)
  * [`Warning`](#warning)
  * [`bcp47Normalize(tag[, options])`](#bcp47normalizetag-options)
* [Compatibility](#compatibility)
* [Security](#security)
* [Related](#related)
* [Contribute](#contribute)
* [License](#license)

## What is this?

This package takes BCP 47 tags and makes them uniform.
It removes unneeded info (`en-us` -> `en`)
and replaces deprecated,
overlong,
and otherwise unpreferred values with preferred values
(`en-bu` -> `en-MM`).
It works by applying
[Unicode CLDR suggestions][github-cldr-alias].

## When should I use this?

You can use this package when dealing with user-provided language tags
and want to normalize and clean them.

## Install

This package is [ESM only][github-gist-esm].
In Node.js (version 14.14+),
install with [npm][npmjs-install]:

```sh
npm install bcp-47-normalize
```

In browsers with [`esm.sh`][esmsh]:

```html
<script type="module">
  import {bcp47Normalize} from 'https://esm.sh/bcp-47-normalize@2?bundle'
</script>
```

## Use

```js
import {bcp47Normalize} from 'bcp-47-normalize'

const tags = [
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

for (const tag of tags) {
  console.log('%s -> %s', tag, bcp47Normalize(tag))
}
```

Yields:

```text
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

This package exports the identifier
[`bcp47Normalize`][api-bcp-47-normalize].
There is no default export.
It exports the additional [TypeScript][] types
[`Options`][api-options] and
[`Warning`][api-warning].

### `Options`

Configuration for [`bcp47Normalize`][api-bcp-47-normalize]
(TypeScript type).

###### Fields

* `forgiving` (`boolean`, default: `false`)
  — keep what was found before an error,
  instead of returning an empty string;
  passed to `bcp-47` as [`options.forgiving`][github-bcp-47-options]
* `warning` ([`Warning`][api-warning], optional)
  — called when an error is found;
  passed to `bcp-47` as [`options.warning`][github-bcp-47-options]

### `Warning`

Called when an error occurs (TypeScript type).

Same as [`Warning` from `bcp-47`][github-bcp-47-warning],
which lists the codes it uses.
One additional warning is given,
with code `-1`,
when a deprecated region cannot be fixed automatically
(because it was split into multiple regions):

| code | reason                                                     |
| :--- | :--------------------------------------------------------- |
| -1   | Deprecated region `CURRENT`, expected one of `SUGGESTIONS` |

###### Parameters

* `reason` (`string`)
  — reason for failure in English
* `code` (`number`)
  — code for failure
* `offset` (`number`)
  — index of place where the error occurred in the tag

###### Returns

Nothing (`undefined`).

### `bcp47Normalize(tag[, options])`

Normalize the given BCP 47 tag according to
[Unicode CLDR suggestions][github-cldr-alias].

###### Parameters

* `tag` (`string`, required)
  — BCP 47 tag
* `options` ([`Options`][api-options], optional)
  — configuration

###### Returns

Normal, canonical, and pretty [BCP 47][ietf-bcp-47] tag (`string`).

## Compatibility

This package is compatible with maintained versions of Node.js.

When we cut a new major release,
we drop support for unmaintained versions of Node.
This means we try to keep the current release line,
`bcp-47-normalize@2`,
compatible with Node.js 14.14.

## Security

This package is safe.

## Related

* [`wooorm/bcp-47`][github-bcp-47]
  — parse and stringify BCP 47 language tags
* [`wooorm/bcp-47-match`][github-bcp-47-match]
  — match BCP 47 language tags with language ranges per RFC 4647
* [`wooorm/iso-3166`][github-iso-3166]
  — ISO 3166 codes
* [`wooorm/iso-639-2`][github-iso-639-2]
  — ISO 639-2 codes
* [`wooorm/iso-639-3`][github-iso-639-3]
  — ISO 639-3 codes
* [`wooorm/iso-15924`][github-iso-15924]
  — ISO 15924 codes
* [`wooorm/un-m49`][github-un-m49]
  — UN M49 codes

## Contribute

Yes please!
See [How to Contribute to Open Source][opensource-guide-contribute].

## License

[MIT][file-license] © [Titus Wormer][wooorm]

<!-- Definitions -->

[api-bcp-47-normalize]: #bcp47normalizetag-options

[api-options]: #options

[api-warning]: #warning

[badge-build-image]: https://github.com/wooorm/bcp-47-normalize/workflows/main/badge.svg

[badge-build-url]: https://github.com/wooorm/bcp-47-normalize/actions

[badge-coverage-image]: https://img.shields.io/codecov/c/github/wooorm/bcp-47-normalize.svg

[badge-coverage-url]: https://codecov.io/github/wooorm/bcp-47-normalize

[badge-downloads-image]: https://img.shields.io/npm/dm/bcp-47-normalize.svg

[badge-downloads-url]: https://www.npmjs.com/package/bcp-47-normalize

[badge-size-image]: https://img.shields.io/bundlejs/size/bcp-47-normalize

[badge-size-url]: https://bundlejs.com/?q=bcp-47-normalize

[esmsh]: https://esm.sh

[file-license]: license

[github-bcp-47]: https://github.com/wooorm/bcp-47

[github-bcp-47-match]: https://github.com/wooorm/bcp-47-match

[github-bcp-47-options]: https://github.com/wooorm/bcp-47#options

[github-bcp-47-warning]: https://github.com/wooorm/bcp-47#warning

[github-cldr-alias]: https://github.com/unicode-org/cldr/blob/release-49/common/supplemental/supplementalMetadata.xml

[github-gist-esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[github-iso-15924]: https://github.com/wooorm/iso-15924

[github-iso-3166]: https://github.com/wooorm/iso-3166

[github-iso-639-2]: https://github.com/wooorm/iso-639-2

[github-iso-639-3]: https://github.com/wooorm/iso-639-3

[github-un-m49]: https://github.com/wooorm/un-m49

[ietf-bcp-47]: https://tools.ietf.org/rfc/bcp/bcp47.html

[npmjs-install]: https://docs.npmjs.com/cli/install

[opensource-guide-contribute]: https://opensource.guide/how-to-contribute/

[typescript]: https://www.typescriptlang.org

[wooorm]: https://wooorm.com

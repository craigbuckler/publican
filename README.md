# Publican

A tiny, simple, and very fast static site generator.

*This is an alpha product: please use at your own discretion.*

Features:

* lightweight EcmaScript module
* standard JavaScript template literal `${ expression }`
* `!{ expression }` are evaluated at runtime so a partially-built template can be used by Express.js or others. The expressions are converted to `${ expression }` so they can be parsed by jsTACS
* automatic creation of paginated post and tag lists


## Usage

Install into your project with `npm i publican`

Create:

1. Markdown or other content files in `./src/content/`
1. HTML template files in `./src/template/`

Create a `publican.config.js` or similar file for configuration with content such as:

```js
import { Publican } from 'publican';

const publican = new Publican();

// watch for changes
publican.config.watch = false;

// build site
await publican.build();
```

Build the site to `./build/` with `node publican.config.js`.


## Front matter

You can add any front matter to content files but the following values control publication:

|name|description|
|-|-|
|`date`|date of post (defaults to now if not set)|
|`publish`|date of publication or `draft` determine whether post is published|
|`priority`|post priority from 0 - 1 (most important)|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` to not index|
|`tags`|comma-delimited list of tags|


## Content

Add a `<nav-heading></nav-heading>` element in any content to add a contents section to the page at that point.


## Post properties

Posts have the following properties in the `data` object:

|name|description|
|-|-|
|`filename`|original name of data file|
|`slug`|rendered file name|
|`link`|link to post|
|`directory`|top-level directory name|
|`date`|date of post|
|`publish`|false if the post is not to published|
|`priority`|post priority from 0 - 1|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` if not indexed|
|`tags`|array of tag objects: { tag, ref, link, slug }|
|`content`|page content (without templates)|
|`contentRendered`|final rendered page content (post templating)|


## Notes

Avoid JavaScript expressions in markdown content. Simple expressions are generally fine, e.g. `${ data.title }` but complex expressions such as `${ data.all.map(i => i.title) }` can be altered by the markdown processor. To work around this, you can:

1. Use the notation `${{ expression }}` to denote a real expression.
1. Move the expressions into a template file.
1. Create a jsTACS function to simplify the expression.
1. Change the `.md` file to `.html` and create HTML instead.

Escape `` ` `` backticks and `${` using `&#96;` and `&#36;{` accordingly when you want those characters to be shown rather than rendered.

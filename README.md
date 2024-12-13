# Publican

Publican is a tiny, simple, and very fast HTML-first static site generator.

*This is a beta product! Please use it at your own risk!*

Full documentation, examples, and starter templates coming soon!

Features:

* lightweight EcmaScript module
* templating handled with standard JavaScript template literals `${ expression }`
* `!{ expression }` values are converted to `${ expression }` at build time. Templates can be partially-built where possible and used in Express.js or other frameworks with [jsTACS](https://www.npmjs.com/package/jstacs)
* automatic markdown conversion with block and inline code syntax highlighting
* automatic creation of page navigation, in-page heading contents, paginated posts, and paginated tag lists
* renders HTML or any other text-based file types
* pass-through file copying
* custom string replacement
* automatic minification options
* hooks for custom processing functions
* watch mode
* works on Windows, Mac OS, and Linux


## Quick start

If necessary, create a new Node.js project directory:

```sh
mkdir mysite
cd mysite
npm init
```

Add `"type": "module",` to `package.json` to use EcmaScript modules by default.

Install Publican:

```sh
npm i publican
```

Create markdown or other content files in the `src/content/` sub-directory. For example, `src/content/#index.md`:

```md
---
title: My Publican site
---

This is my new static site!

*Under construction!*
```

Create HTML template files in the `src/template/` sub-directory. For example, `src/template/default.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${ data.title }</title>
  </head>
  <body>
    ${ include('_partials/header.html') }
    <main>
      <h1>${ data.title }</h1>
      ${ data.content }
    </main>
  </body>
</html>
```

The template above includes a partial at `src/template/_partials/header.html`:

```html
<header>
  <nav><a href="${ tacs.root }">HOME</a></nav>
</header>
```

Create a configuration file in the project root, e.g. `publican.config.js` (use a `.mjs` extension if `"type": "module",` is not set in `package.json`):

```js
import { Publican } from 'publican';
const publican = new Publican();

// clear build directory (optional)
await publican.clean();

// build site
await publican.build();
```

Build the site to the `./build/` directory:

```sh
node publican.config.js
```


## Content files

Publican ignores all content files with names starting with an underscore, e.g. `_draft.md`. This restriction does not apply to template files.


## Front matter

You can add any front matter to content files but the following values control publication:

|name|description|
|-|-|
|`title`|page title (optional)|
|`menu`|title used on menus or set `false` to omit (optional)|
|`slug`|page slug (optional)|
|`template`|HTML template filename (in template directory)|
|`tags`|comma-delimited list of tags|
|`date`|date of post|
|`publish`|date of publication or `draft` determine whether post is published|
|`priority`|post priority from 0 (least important) to 1 (most important)|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` to not index|
|`debug`|set `true` to output content properties|

Note that front matter can contain `${ expressions }`.


## Content

Add a `<nav-heading></nav-heading>` element in any content or template to add a contents section with links to the main content headings (H2 to H6).


## Post properties

Post information can be analysed and used in templates with a `data` object that has the front matter properties above, any custom properties you set, and the following properties:

|name|description|
|-|-|
|`filename`|original name of data file|
|`slug`|rendered file name|
|`link`|link to post|
|`directory`|top-level directory name|
|`date`|date of post|
|`publish`|false if the post is not to published|
|`priority`|post priority from 0 - 1|
|`isMD`|content provided in markdown format|
|`isHTML`|content is rendered to HTML|
|`isXML`|content is rendered to XML|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` if not indexed|
|`tags`|array of tag objects: { tag, ref, link, slug }|
|`content`|page content|
|`contentRendered`|final rendered page content (post templating)|
|`wordCount`|content word count|
|`postnext`|`data` object of the next post in the directory|
|`postback`|`data` object the previous post in the directory|
|`pagination`|[pagination data](#pagination-properties)|


### Pagination properties

The `data.pagination` object contains the following properties when available:

|name|description|
|-|-|
|`page`|array of pages|
|`pageTotal`|total number of pages|
|`pageCurrent`|current page number (zero based)|
|`pageCurrent1`|current page number (one based)|
|`subpageFrom1`|post number from|
|`subpageTo1`|post number to|
|`hrefBack`|link to previous paginated page|
|`hrefNext`|link to next paginated page|
|`href`|array of links to all paginated pages|


## Global values

The following values are available in all pages:

|name|description|
|-|-|
|`tacs.root`|root build directory (defaults to `/`)|
|`tacs.all`|Map object of all posts indexed by slug|
|`tacs.dir`|Map object of all posts in a root directory. Returns an array of posts.|
|`tacs.tag`|Map object of all tags. Returns an array of posts.|
|`tacs.tagList`|array of tag objects: { tag, ref (normalized tag), link, slug, count }|
|`tacs.nav`|nested array of navigation item objects: { data: {}, children [ { data,children },... ] }|


## Publican configuration

Publican configuration is set in a `publican.config` object with the following properties (defaults shown in brackets):

|property|description|
|-|-|
|`.dir.content`|content directory (`./src/content/`)|
|`.dir.template`|template directory (`./src/template/`)|
|`.dir.build`|build directory (`./build/`)|
|`.defaultHTMLTemplate`|default template for HTML files (`default.html`)|
|`.root`|root path (`/`)|
|`.ignoreContentFile`|ignore file regex (anything starting `_`)|
|`.slugReplace`|slug replacer Map|
|`.frontmatterDelimit`|front matter delimiter (`---`)|
|`.indexFrequency`|default indexing frequency (`monthly`). Set `false` to prevent sitemap indexing|
|`.markdownOptions.core`|[markdown-it core options](https://github.com/markdown-it/markdown-it?tab=readme-ov-file#init-with-presets-and-options) object|
|`.markdownOptions.prism`|[markdown-it-prism syntax highlighting options](https://github.com/jGleitz/markdown-it-prism?tab=readme-ov-file#options) object|
|`.headingAnchor`|heading anchor and contents block options object|
|`.dirPages`|directory pages options object|
|`.tagPages`|tag page index options object|
|`.minify`|[HTML minification options](https://github.com/kangax/html-minifier?tab=readme-ov-file#options-quick-reference) object|
|`.passThrough`|file copy Set|
|`.replace`|string replacer Map|
|`.processContent`|function hook Set for content files (`slug`, `object`)|
|`.processTemplate`|function hook Set for template files (`slug`, `string`) - returns string|
|`.processPreRender`|function hook Set prior to rendering (`slug`, `object`)|
|`.processPostRender`|function hook Set post rendering (`slug`, `string`) - returns string|
|`.watch`|enable watch mode (`false`)|
|`.watchDebounce`|watch debounce in milliseconds (`300`)|
|`.logLevel`|log verbosity, `0` to `2` (`2`)|


### Pass-through files

Copy static files into the build directory using:

```js
publican.config.passThrough.add({ from: <src>, to: <dest> });
```

where:

* `<src>` is a source directory relative to the project root, and
* `<dest>` is a destination directory relative to the build directory

Examples:

```js
// copy static files
publican.config.passThrough.add({ from: './src/media/images/', to: 'images/' });
publican.config.passThrough.add({ from: './src/css/', to: 'css/' });
```


### Custom string replacement

Built files can have strings replaced:

```js
publican.config.passThrough.set(<search>, <replace>);
```

where:

* `<search>` is a search string or regular expression
* `<replace>` is the replacement string

Examples:

```js
// replace __YEAR__ with the current year
publican.config.passThrough.set( '__YEAR__', (new Date()).getUTCFullYear() );

// replace text in <p class="bold"> with <p><strong>
publican.config.passThrough.set( /<p class="bold">(.*?)<\/p>/ig, '<p><strong>$1</strong></p>);
```


### Custom jsTACS data and functions

The `tacs` object can have any global data or functions appended although you should avoid changing the default [global values](#global-values). For example:

```js
tacs.generator = {
  name: 'Publican',
  url: 'https://www.npmjs.com/package/publican/'
}
```

Any template can now use a render-time expression such as `${ tacs.generator.name }`.

You can also create reusable functions to simplify rendering, e.g.

```js
tacs.exec = tacs.exec || {};

// output links to most recent pages
tacs.exec.listRecent = (list, maxSize = Infinity) => {

  // copy list
  list = [ ...list ];

  // limit size
  list.length = Math.min( list.length, maxSize );

  // sort and generate list of links
  let ret = list.
    .sort((a, b) => b.date - a.date)
    .map(i => `<li><a href="${ i.link }">${ i.title }</a></li>`)
    .join('\n');

  // make into list
  if (ret) ret = `<ol>\n${ ret }</ol>\n`;

  // return to template
  return ret;

};
```

Templates can now use this function, e.g. list the ten most recent posts in the `article` directory:

```js
<p>Ten most recent articles:</p>
${ tacs.exec.listRecent( tacs.dir.get('article'), 10 ) }
```


### Virtual content and templates

Content can be programmatically added by calling:

```js
publican.addContent( <filename>, <content> );
```

where:

* `<filename>` is a virtual filename such as `article/mypost.md`, and
* `<content>` is the content of that file

Example:

```js
publican.addContent(
  'article/vpost.md',
`
---
title: Virtual post
---
This is a virtual post!
`
);
```

This would render a file to `article/vpost/index.html` in the `build` directory.

Similarly, a virtual template can be added by calling:

```js
publican.addTemplate(
  'mytemplate.html',
  '<!doctype html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${ data.title }</title>\n</head>\n<body>\n${ include("_partials/header.html") }\n<main>\n<h1>${ data.title }</h1>\n${ data.content }\n</main>\n${ include("_partials/footer.html") }\n</body>\n</html>'
);
```

Content can refer to this template in front matter using `template: mytemplate.html`.

Note the template string cannot be delimited with `` ` `` backticks if they contain `${ expressions }`.


### Processing function hooks

Plugins or configuration code can define custom functions to alter data at build time.

To process content data when it's initially loaded, add a `.processContent` function. The function is passed the file name and `data` object which it can manipulate (return values are ignored). The following example prepends "POST:" to every title:

```js
publican.config.processContent.add(
  (filename, data) => data.title = 'POST: ' + data.title
);
```

To process a template string when it's initially loaded, add a `.processTemplate` function. The function is passed the file name and the template string which it can manipulate and return. The following example replaces all instances of `__COPYRIGHT__` with a `©` symbol:

```js
publican.config.processTemplate.add(
  (filename, template) => template.replaceAll('__COPYRIGHT__', '&copy;')
);
```

To process content data before it's rendered, add a `.processPreRender` function. The function is passed the `data` object which it can manipulate (return values are ignored). The following example sets a `renderTime` value to the current datetime on all output HTML files:

```js
publican.config.processPreRender.add(
  (filename, data) => {
    if (data.isHTML) data.renderTime = new Date();
  }
);
```

To process the fully rendered content prior to minification, add a `.processPostRender` function. The function is passed the data object and the final output string which it can manipulate and return. The following example inserts a meta tag into HTML content:

```js
publican.config.processPostRender.add(
  (data, output) => output.replace(
    '</head>',
    '<meta name="generator" content="Publican" />\n</head>'
  )
);
```


## Notes

Avoid JavaScript expressions in markdown content. Simple expressions are generally fine, e.g. `${ data.title }`, but the markdown process will:

* alter complex expressions such as `${ data.all.map(i => i.title) }`, and
* escape expressions in code blocks so no code will run.

To work around these restrictions, you can:

1. Use the `${{ expression }}` notation. This denotes a *real* expression irrespective of where it resides in the markdown.
1. Move expressions into the HTML template file.
1. [Create jsTACS functions](#custom-jstacs-data-and-functions) to simplify the expression.
1. Change the `.md` file to `.html` and author HTML instead.

You can used escape characters to avoid any template expression processing:

* for `` ` `` backticks, use `&#96;`
* for `${`, use `&#36;{`
* for `!{`, use `&#33;{`

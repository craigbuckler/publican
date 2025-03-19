# Publican

Publican is a tiny, simple, and very fast HTML-first static site generator.

Full documentation is available at [Publican.dev](https://publican.dev/).

*This is a beta product! Please use it at your own risk!*

Features:

* lightweight EcmaScript module
* templating handled with standard JavaScript template literals `${ expression }`
* `!{ expression }` values are converted to `${ expression }` at build time. Templates can be partially-built where possible and used in Express.js or other frameworks with [jsTACS](https://www.npmjs.com/package/jstacs)
* automatic markdown conversion with block and inline code syntax highlighting
* automatic creation of page navigation, in-page heading contents, paginated posts, and paginated tag lists
* renders HTML or any other text-based file types
* pass-through file copying
* add virtual content and templates
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


### Front matter

You can add any front matter to any content file but the following values control publication:

|name|description|
|-|-|
|`title`|page title (optional)|
|`menu`|title used on menus or set `false` to omit (optional)|
|`slug`|page slug (optional)|
|`priority`|post priority from 0 (least important) to 1 (most important)|
|`date`|date of post|
|`publish`|date of publication or `draft` determine whether post is published|
|`tags`|comma-delimited list of tags|
|`template`|HTML template filename (in template directory)|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` to not index|
|`debug`|set `true` to output content properties|

Note that front matter can contain `${ expressions }`.


### In-page navigation

Add a `<nav-heading></nav-heading>` element in any content or template to add a contents section with links to the main content headings (`h2` to `h6`).


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


### Markdown notes

You can use template literals in markdown content but some care may be necessary to avoid problems with HTML conversion.

Simpler expressions will work as expected, but you can use double-bracket `${{ expressions }}` or `!{{ expressions }}` when necessary. This denotes a *real* expression irrespective of where it resides in the markdown. Use them in markdown code blocks when an expression must be parsed rather than shown as-is:

```js
// ```js code block inside markdown

   console.log( '${ data.title }' );
// expression rendered as code:
// console.log( '${ data.title }' );

   console.log( '${{ data.title }}' );
// expression rendered as string:
// console.log( 'This Page Heading' );
```

If this does not solve your problem, you can:

1. Use HTML snippets in your markdown file, such as `<p>${ expression }</p>`.
1. Simplify expressions using [custom jsTACS functions](#custom-jstacs-data-and-functions).
1. Only use complex expressions in HTML content or template files.

You can used escape characters to avoid any template expression processing:

* for `!{`, use `&#33;{`
* for `${`, use `&#36;{`
* for `` ` `` backticks, use `&#96;`


## Post properties

Post information can be analysed and used in content or templates using a `data` object that has the [front matter properties](#front-matter) above, any custom properties you add, and and other properties set by Publican.

|name|description|
|-|-|
|`title`|page title|
|`menu`|title used in menus|
|`content`|main content|
|`contentRendered`|final rendered main content|
|`date`|date of post|
|`publish`|false if the post is not to published|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` if not indexed|
|`priority`|post priority from 0 - 1|
|`tags`|array of tag objects: { tag, ref, link, slug }|
|`wordCount`|content word count|
|`postnext`|`data` object of the next post in the directory|
|`postback`|`data` object the previous post in the directory|
|`pagination`|[pagination data](#pagination-properties)|
|`filename`|original name of data file|
|`template`|HTML template filename (in template directory)|
|`slug`|the rendered filename relative to the build directory|
|`link`|link to post|
|`directory`|top-level directory name|
|`isMD`|content provided in markdown format|
|`isHTML`|content is rendered to HTML|
|`isXML`|content is rendered to XML|
|`debug`|whether debugging is enabled|


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
|`tacs.nav`|nested array of navigation item objects: { data: {}, children \[ { data,children },... \] }|


## Publican configuration

Publican configuration is set in a `publican.config` object with the following properties (defaults shown in brackets):

|property|description|
|-|-|
|`.dir.content`|content directory (`./src/content/`)|
|`.dir.template`|template directory (`./src/template/`)|
|`.dir.build`|build directory (`./build/`)|
|`.ignoreContentFile`|ignore file regex (anything starting `_`)|
|`.slugReplace`|slug replacer Map|
|`.frontmatterDelimit`|front matter delimiter (`---`)|
|`.root`|root path (`/`)|
|`.indexFrequency`|default indexing frequency (`monthly`). Set `false` to prevent sitemap indexing|
|`.defaultHTMLTemplate`|default template for HTML files (`default.html`)|
|`.markdownOptions.core`|[markdown-it core options](https://github.com/markdown-it/markdown-it?tab=readme-ov-file#init-with-presets-and-options) object|
|`.markdownOptions.prism`|[markdown-it-prism syntax highlighting options](https://github.com/jGleitz/markdown-it-prism?tab=readme-ov-file#options) object|
|`.headingAnchor`|heading anchor and contents block options object {`nolink`, `linkContent`, `linkClass`, `nomenu`, `navClass`, `tag`}|
|`.replace`|string replacer Map|
|`.dirPages`|directory pages options object {`size`, `sortBy`, `sortOrder`, `template`, `dir`}|
|`.tagPages`|tag page index options object {`root`, `size`, `sortBy`, `sortOrder`, `template`, `menu`, `index`}|
|`.minify`|[HTML minification options](https://github.com/kangax/html-minifier?tab=readme-ov-file#options-quick-reference) object|
|`.passThrough`|file copy Set|
|`.processContent`|function hook Set for content files (`filename`, `object`)|
|`.processTemplate`|function hook Set for template files (`filename`, `string`) - returns string|
|`.processRenderStart`|function hook Set called once prior to rendering ()|
|`.processPreRender`|function hook Set prior to rendering post (`slug`, `object`)|
|`.processPostRender`|function hook Set after rendering post (`slug`, `string`) - returns string|
|`.processRenderComplete`|function hook Set called once after rendering (changed file list `[{slug,content},...]`)|
|`.watch`|enable watch mode (`false`)|
|`.watchDebounce`|watch debounce in milliseconds (`300`)|
|`.logLevel`|log verbosity, `0` to `2` (`2`)|


### Custom string replacement

Built files can have strings replaced:

```js
publican.config.replace.set(<search>, <replace>);
```

where:

* `<search>` is a search string or regular expression
* `<replace>` is the replacement string

Examples:

```js
// replace __YEAR__ with the current year
publican.config.replace.set( '__YEAR__', (new Date()).getUTCFullYear() );

// replace text in <p class="bold"> with <p><strong>
publican.config.replace.set( /<p class="bold">(.*?)<\/p>/ig, '<p><strong>$1</strong></p>);
```


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
// copy ./src/media/favicons/**/* to ./build/
publican.config.passThrough.add({ from: './src/media/favicons', to: './' });

// copy ./src/media/images/**/* to ./build/images/
publican.config.passThrough.add({ from: './src/media/images', to: './images/' });
```


### Custom jsTACS data and functions

The `tacs` object can have any global data or functions appended although you should avoid changing the default [global values](#global-values). For example:

```js
tacs.generator = {
  name: 'Publican',
  url: 'https://www.npmjs.com/package/publican/'
};
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


### Processing function hooks

Plugins or configuration code can define custom synchronous functions to add, alter, or remove data at build time. *(Asynchronous functions which return a Promise are not supported.)*

To process content data when it's initially loaded, add a `.processContent` function (only synchronous functions are permitted). The function is passed the `data` object and filename. Return values are ignored, but `data` properties can be manipulated. The following example prepends "POST:" to every title:

```js
publican.config.processContent.add(
  (data, filename) => data.title = 'POST: ' + data.title
);
```

To process a template string when it's initially loaded, add a `.processTemplate` function. The function is passed the template string and the filename. Return the (changed) template string. The following example adds the filename as an HTML comment to the template:

```js
publican.config.processTemplate.add(
  (template, filename) => `\n<!-- ${ filename } -->\n${ template }`
);
```

To process any data before rendering starts, add a `.processRenderStart` function. It is called once and passed the global `tacs` object so it can manipulate properties. Return values are ignored. The following example creates a new `tacs.tagScore` Map which gives the post count for each tag reference:

```js
publican.config.processRenderStart.add(
  tacs => {
    tacs.tagScore = new Map();
    tacs.tagList.forEach(t => tacs.tagScore.set(t.ref, t.count));
  }
);
```

To process each post before it's rendered, add a `.processPreRender` function. The function is passed the post `data` object and the `tacs` global data object so it can manipulate properties. Return values are ignored. The following example sets a `renderTime` value to the current datetime on all output HTML files:

```js
publican.config.processPreRender.add(
  (data) => {
    if (data.isHTML) data.renderTime = new Date();
  }
);
```

To process the fully rendered content of each post (prior to minification and saving), add a `.processPostRender` function. The function is passed the final output string, the post `data` object, and the `tacs` global object. Return the (changed) output string. The following example inserts a meta tag into HTML content:

```js
publican.config.processPostRender.add(
  (output, data) => {
    if (data.isHTML) {
      output = output.replace('</head>', '<meta name="generator" content="Publican.dev" />\n</head>');
    }
    return output;
  }
);
```

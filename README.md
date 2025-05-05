# Publican

Publican is a tiny, simple, and very fast HTML-first static site generator.

[Full documentation](https://publican.dev/docs/) is available at [Publican.dev](https://publican.dev/).

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

For more information, refer to the [full documentation at Publican.dev](https://publican.dev/docs/).

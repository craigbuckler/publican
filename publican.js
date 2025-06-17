/*
Publican HTML-first Static Site Generator
https://www.npmjs.com/package/publican
By Craig Buckler
*/
import { readdir, mkdir, rm, readFile, writeFile, cp } from 'node:fs/promises';
import { sep, join, dirname, basename, extname } from 'node:path';
import { watch } from 'node:fs';

import { tacsConfig, tacs, templateMap, templateParse } from 'jstacs';
import { PerfPro } from 'perfpro';
import { ConCol } from 'concol';

import { slugify, properCase, normalize, extractFmContent, parseFrontMatter, mdHTML, navHeading, minifySimple, minifyFull, chunk, strReplacer, strHash } from './lib/lib.js';

// performance handler
const perf = new PerfPro('Publican');

// console logger
export const concol = new ConCol('Publican', 'blue');

// export jsTACS
export * from 'jstacs';


// main Publican class
export class Publican {

  // private members
  #isDev = (process.env.NODE_ENV === 'development');
  #contentMap = new Map();
  #writeHash = new Map();
  #now = new Date();
  #watchDebounce = null;
  #reRendering = false;

  static #jsBackTick = '\u02cb\u02cb';
  static #logLine = '─'.repeat(43);

  // set defaults
  constructor() {

    this.config = {

      // source and build directories
      dir: {
        content:  './src/content/',
        template: './src/template/',
        build:    './build/'
      },

      // index filename
      indexFilename: 'index.html',

      // root
      root: '/',

      // ignore content filename regex (ignores files starting _)
      ignoreContentFile: /^_.*$/,

      // slug replacements
      slugReplace: new Map(),

      // front matter marker
      frontmatterDelimit: '---',

      // default indexing frequency
      indexFrequency: 'monthly',

      // default HTML template
      defaultHTMLTemplate: 'default.html',

      // markdown options
      markdownOptions: {
        core: {
          html: true,
          breaks: false,
          linkify: true,
          typographer: true
        },
        prism: {
          defaultLanguage: 'js',
          highlightInlineCode: true
        },
        use: new Set()
      },

      // heading anchors
      headingAnchor: {
        nolink: 'nolink',
        linkContent: '#',
        linkClass: 'headlink',
        nomenu: 'nomenu',
        navClass: 'contents',
        tag: 'nav-heading'
      },

      // directory page options
      dirPages: {
        size: 24,
        sortBy: 'priority',
        sortOrder: -1,
        template: 'default.html',
        index: 'monthly',
        dir: {} // custom directory sort
      },

      // tag page options
      tagPages: {
        root: 'tag',
        size: 24,
        sortBy: 'date',
        sortOrder: -1,
        template: 'default.html',
        menu: false,
        index: 'monthly'
      },

      // minify options
      minify: {
        enabled: false,
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        decodeEntities: false,
        minifyCSS: true,
        minifyJS: true,
        preventAttributesEscaping: false,
        removeAttributeQuotes: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      },

      // event functions to process incoming content files (filename, post data object)
      processContent: new Set(),

      // event functions to process incoming template files (filename, string)
      processTemplate: new Set(),

      // event functions called once before rendering (tacs object)
      processRenderStart: new Set(),

      // event functions to process content before rendering (post data object)
      processPreRender: new Set(),

      // event functions to process content after rendering (post data object, string output)
      processPostRender: new Set(),

      // event functions called once after rendering ([{slug,content}, {slug,content}, ...], tacs object)
      processRenderEnd: new Set(),

      // directory pass-through { from (relative to project), to (relative to dir.build) }
      passThrough: new Set(),

      // replacer
      replace: new Map(),

      // watch options
      watch: false,
      watchDebounce: 300,

      // output verbosity
      logLevel: 2,

    };

  }


  // clean build directory
  async clean() {

    try {
      await rm(this.config.dir.build, { recursive: true });
    }
    catch (e) {
      if (this.config.logLevel > 1) concol.warn(`unable to delete ${ this.config.dir.build } build directory\n${ e }`);
    }

  }


  // build site
  async build() {

    if (this.config.logLevel > 1) {

      concol.log([

        Publican.#logLine,
        '   ____        _     _ _',
        '  |  _ \\ _   _| |__ | (_) ___ __ _ _ __',
        '  | | ) | | | | \'_ \\| | |/ __/ _` | \'_ \\',
        '  | |/_/| |_| | |_) | | | (_| (_| | | | |',
        '  |_|    \\__,_|_.__/|_|_|\\___\\__,_|_| |_|',
        '  a simpler Node.js static site generator',
        '           https://publican.dev/',
        ''
      ]);

    }

    // pass template directory
    tacsConfig.dir.template = this.config.dir.template;

    perf.mark('read content files');

    // fetch and process content and template files
    const file = (await Promise.allSettled([
      this.#readFileContents(this.config.dir.content),
      this.#readFileContents(this.config.dir.template),
    ])).map(f => (f.status === 'fulfilled' ? f.value : new Map()));

    file[0].forEach((content, filename) => this.addContent(filename, content));
    file[1].forEach((content, filename) => this.addTemplate(filename, content));

    perf.mark('read content files');

    // render content
    const written = await this.#render();

    // copy passthrough files
    await this.#copyPassThrough();

    // output metrics
    this.#showMetrics(written, true);

    // watch for file changes
    if (this.config.watch) {

      if (this.config.logLevel) concol.info('watching for changes...');
      this.#watcher();

    }

  }

  #watcher() {

    // watch for content change
    const contentDir = this.config.dir.content, content = new Set();
    watch(contentDir, { recursive: true }, (event, fn) => {
      content.add(fn); wait();
    });

    // watch for template change
    const templateDir = this.config.dir.template, template = new Set();
    watch(templateDir, { recursive: true }, (event, fn) => {
      template.add(fn); wait();
    });

    // debounce events
    const wait = () => {

      clearTimeout(this.#watchDebounce);
      this.#watchDebounce = setTimeout(reRender, this.config.watchDebounce);

    };

    const reRender = async() => {

      // already rendering
      if (this.#reRendering) {
        wait();
        return;
      }

      this.#reRendering = true;

      perf.mark('TOTAL REBUILD TIME');

      const
        cFiles = [...content],
        tFiles = [...template];

      content.clear();
      template.clear();

      perf.mark('read content files');

      // process content changes
      await Promise.allSettled(
        cFiles.map(async f => {
          const m = await this.#readFileContents(contentDir, f);
          this.addContent(f, m.get(f));
        })
      );

      // process template changes
      await Promise.allSettled(
        tFiles.map(async f => {
          const m = await this.#readFileContents(templateDir, f);
          this.addTemplate(f, m.get(f));
        })
      );

      perf.mark('read content files');

      // render if no more changes
      if (!content.size && !template.size) {

        const written = await this.#render();
        perf.mark('TOTAL REBUILD TIME');
        this.#showMetrics(written);

      }

      // render complete
      this.#reRendering = false;

    };

  }


  // show performance metrics
  #showMetrics(written, initialBuild) {

    if (written && this.config.logLevel) {

      concol.log([ '', [ 'website files output', written ] ]);
      if (initialBuild) concol.log([ 'TOTAL PROCESSING TIME', perf.now(), ' ms' ]);

      if (this.config.logLevel > 1) {

        // show metrics
        concol.log([
          ...perf.allDurations().map(p => [ p.name, p.duration, ' ms']),
        ]);

      }

      if (initialBuild) concol.log(['', Publican.#logLine, '']);

      perf.clear();

    }

  }


  // read contents of all files into a map
  async #readFileContents(path, file) {

    const
      fileMap = new Map(),
      fileList = file ? [file] : await readdir(path, { recursive: true });

    // read and parse all files
    (await Promise.allSettled(
      fileList.map(f => readFile( join(path, f), { encoding: 'utf8' } ) )
    )).forEach((f, idx) => {

      fileMap.set(fileList[idx], f.status === 'fulfilled' ? f.value : undefined);

    });

    return fileMap;

  }


  // add and parse content
  addContent(filename, content) {

    // path error - cannot navigate to parent using '..'
    if (filename.includes('..')) {
      throw new Error('[Publican] content filename cannot include parent directory .. reference.');
    }

    // ignore files matching regex
    if (this.config.ignoreContentFile && basename(filename).match(this.config.ignoreContentFile)) {
      return;
    }

    // delete from Map
    if (content === undefined) {
      this.#contentMap.delete(filename);
      return;
    }

    const
      // extract front matter and content
      fData = extractFmContent(content, this.config.frontmatterDelimit),

      // parse front matter
      fInfo = parseFrontMatter( fData.fm );

    fInfo.filename = filename;
    fInfo.slug = fInfo.slug || slugify(filename, this.config.indexFilename, this.config.slugReplace);
    if (!fInfo.slug || typeof fInfo.slug !== 'string' || fInfo.slug.includes('..')) {
      throw new Error(`[Publican] invalid slug "${ fInfo.slug }" for file: ${ filename }`);
    }

    // get link (slug without index.html)
    const reIndexFn = new RegExp(this.config.indexFilename.replace(/\./g, '\\.') + '$');
    fInfo.link = join(this.config.root, fInfo.slug).replace(reIndexFn, '').replaceAll(sep, '/');

    fInfo.directory = dirname( fInfo.slug ).replaceAll(sep, '/').replace(/\/.*$/, '');
    fInfo.date = fInfo.date ? new Date(fInfo.date) : null;
    fInfo.priority = parseFloat(fInfo.priority) || 0.1;
    fInfo.isMD = extname(fInfo.filename)?.toLowerCase() === '.md';

    const ext = (extname(fInfo.slug) || '').toLowerCase();

    fInfo.isIndexPage = fInfo.slug.endsWith(this.config.indexFilename);
    fInfo.isHTML = ext.includes('htm');
    fInfo.isXML = ext === '.xml';
    fInfo.isCSS = ext === '.css';
    fInfo.isJS = ext === '.js' || ext === '.mjs' || ext === '.cjs';

    // format tags
    if (this.config.tagPages && fInfo.tags) {

      fInfo.tags = [
        ...new Set( (fInfo.tags).split(',')
          .map(v => v.trim().replace(/\s+/g, ' ')) )
      ];

      // create tag information
      fInfo.tags = fInfo.tags.map(tag => {

        const
          ref = normalize(tag),
          slug = join(this.config.tagPages.root || '', ref).replaceAll(sep, '/') + '/' + this.config.indexFilename,
          link = join(this.config.root, dirname(slug)).replaceAll(sep, '/') + '/';

        return { tag, ref, link, slug };

      });

    }
    else {
      fInfo.tags = null;
    }

    // publication
    if (fInfo.publish) {
      const p = fInfo.publish.toLowerCase();
      fInfo.publish = this.#isDev || !(p === 'draft' || p === 'false' || this.#now < new Date(p));
    }

    // menu
    if (!fInfo.menu) {
      fInfo.menu = (fInfo.isHTML || fInfo.isIndexPage) ? (fInfo.title || properCase(fInfo.directory) || '0') : '0';
    }
    if (fInfo.menu === '0' || fInfo.menu?.toLowerCase() === 'false') fInfo.menu = false;

    // index frequency
    fInfo.index = fInfo.index || (fInfo.isHTML || fInfo.isIndexPage ? this.config.indexFrequency : '0');
    if (fInfo.index === '0' || fInfo.index.toLowerCase() === 'false') fInfo.index = false;

    // word count
    fInfo.wordCount = 0;
    if (fInfo.isHTML) {
      fInfo.wordCount = 1 + ((fInfo.title || '') + ' ' + fData.content)
        .replace(/<[^<]+?>/g, '')
        .replace(/\W/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\S/g, '')
        .length;
    }

    // content - convert markdown to HTML if necessary
    fInfo.content = fInfo.isMD ? mdHTML(fData.content, this.config.markdownOptions) : fData.content;

    // convert CSS character entities from \XXXX to \uXXXX
    if (fInfo.isCSS) {
      fInfo.content = fInfo.content.replace(/\\([0-9A-Z]{4,})/gi, '\\u$1');
    }

    // escape JS backticks
    if (fInfo.isJS) {
      fInfo.content = fInfo.content.replaceAll('`', Publican.#jsBackTick);
    }

    // ensure pages using data.contentRendered are processed last
    fInfo.renderPriority = fInfo.content.includes('.contentRendered') ? -2 : 0;

    // debug flag
    fInfo.debug = fInfo.debug && String(fInfo.debug).trim().toLowerCase() !== 'false';

    // custom processing: processContent hook
    this.config.processContent.forEach(fn => fn(fInfo, filename));

    // store in Map
    this.#contentMap.set(filename, fInfo);

    // debug
    if (fInfo.debug) {
      concol.log([ Publican.#logLine, filename, Publican.#logLine ]);
      console.dir(fInfo, { depth: null, color: true });
      concol.log(Publican.#logLine);
    }

  }


  // add and parse template
  addTemplate(filename, content) {

    // delete from Map
    if (content === undefined) {
      templateMap.delete(filename);
      return;
    }

    // custom processing: processTemplate hook
    this.config.processTemplate.forEach(fn => { content = fn(content, filename); });

    // store in Map
    templateMap.set(filename, content);

  }


  // render and build site
  async #render() {

    perf.mark('render web files');

    // TACS global content
    tacs.root = this.config.root;
    tacs.all = new Map();
    tacs.dir = new Map();
    tacs.tag = new Map();
    tacs.tagList = [];

    // tag slug to name map
    const tagName = new Map();

    // initial pass
    this.#contentMap.forEach(data => {

      // is a draft page?
      if (data.publish === false) return;

      // handle directories
      const dir = data.directory;
      if (
        data.link !== '/' &&
        data.slug !== dir + '/' + this.config.indexFilename &&
        data.index !== false
      ) {

        const dirSet = tacs.dir.get( dir ) || [];
        dirSet.push( data );
        tacs.dir.set(dir, dirSet);

      }

      // handle tags
      if (this.config.tagPages && data.tags) data.tags.forEach(t => {

        const tagSet = tacs.tag.get( t.ref ) || [];
        tagSet.push( data );
        tacs.tag.set(t.ref, tagSet);

      });

      // pass to TACS
      if (tacs.all.has(data.slug)) {
        throw new Error(`[Publican] same slug used in multiple places: ${ data.slug }`);
      }

      tacs.all.set(data.slug, data);

    });

    // directory pages
    if (this.config.dirPages) {

      tacs.dir.forEach((list, dir) => {

        const
          sB = this.config.dirPages.dir?.[dir]?.sortBy || this.config.dirPages.sortBy || 'priority',
          sD = this.config.dirPages.dir?.[dir]?.sortOrder || this.config.dirPages.sortOrder || -1;

        // sort by factor then date
        list.sort( (a, b) => {
          let s = sD * (a[ sB ] == b[ sB ] ? 0 : a[ sB ] > b[ sB ] ? 1 : -1);
          if (!s) s = b.date - a.date;
          return s;
        } );

        tacs.dir.set(dir, list);

        // next and back articles
        for (let a = 0; a < list.length; a++) {
          const data = list[a];
          data.postback = a > 0 ? list[a - 1] : null;
          data.postnext = a < list.length - 1 ? list[a + 1] : null;
        }

      });

      // paginate
      this.#paginate(
        tacs.dir,
        this.config.dirPages.size || Infinity,
        this.config.dirPages.root || '',
        this.config.dirPages.template
      ).forEach((fInfo, slug) => {

        const rootPage = tacs.all.get( fInfo.directory + '/' + this.config.indexFilename );
        fInfo.isDirIndex = rootPage?.title || properCase(fInfo.directory);
        fInfo.title = fInfo.isDirIndex;
        fInfo.description = rootPage?.description || fInfo.title;
        fInfo.index = this.config.dirPages.index || false;

        tacs.all.set(slug, Object.assign(fInfo, tacs.all.get(slug) || {}));

      });

    }

    // tag pages
    if (this.config.tagPages) {

      const sB = this.config.tagPages.sortBy || 'date', sD = this.config.tagPages.sortOrder || -1;

      // sort pages
      tacs.tag.forEach((list, ref) => {

        list.sort( (a, b) => sD * (a[ sB ] - b[ sB ]) );
        tacs.tag.set(ref, list);

        // get top article information
        const t = list[0].tags.find(t => t.ref === ref);
        tacs.tagList.push({ tag: t.tag, ref, link: t.link, slug: t.slug, count: list.length });
        tagName.set(ref, t.tag);

      });

      // sort tag list by frequency
      tacs.tagList.sort((a, b) => b.count - a.count);

      // paginate
      this.#paginate(
        tacs.tag,
        this.config.tagPages.size || Infinity,
        this.config.tagPages.root || '',
        this.config.tagPages.template
      ).forEach((fInfo, slug) => {

        fInfo.isTagIndex = tagName.get( fInfo.name );
        fInfo.title = fInfo.isTagIndex;
        fInfo.description = fInfo.isTagIndex;
        fInfo.menu = this.config.tagPages.menu;
        fInfo.index = this.config.tagPages.index || false;

        tacs.all.set(slug, Object.assign(fInfo, tacs.all.get(slug) || {}));

      });

    }

    // create navigation menu object from slugs
    const nav = {};
    tacs.all.forEach(data => {

      if ((!data.isHTML && !data.isIndexPage) || data.pagination?.pageCurrent) return;

      const sPath = data.slug.split('/');
      if (sPath.length === 1) sPath.unshift('/');

      let navMap = nav;
      while (sPath.length) {

        const p = sPath.shift();

        if (p === this.config.indexFilename) {
          navMap.data = data;
        }

        if (sPath.length) {
          navMap[p] = navMap[p] || { data: {}, children: {} };
          navMap = navMap[p];
          navMap.data.title = navMap.data.title || properCase( p.replace(/\W/g, ' ').trim().replace(/\s+/g, ' ') );
          navMap.data.priority = navMap.data.priority || 0.1;
          navMap.data.date = navMap.data.date || this.#now;
          if (sPath.length > 1) {
            navMap = navMap.children;
          }
        }

      }

    });


    // convert nav objects to arrays and sort
    const dP = this.config.dirPages;

    tacs.nav = recurseNav(nav);
    function recurseNav(obj, dir) {

      const ret = Object.values(obj);

      // use first child filename if directory does not exist
      ret.forEach(d => {
        if (d.data.filename) return;

        const key = Object.keys(d.children);
        if (key.length) {
          d.data.filename = d.children[key[0]].data.filename;
        }

      });

      // sort menu items
      const
        sB = (dir && dP.dir?.[dir]?.sortBy) || dP?.sortBy || 'priority',
        sD = (dir && dP.dir?.[dir]?.sortOrder) || dP.sortOrder || -1;

      ret.sort( (a, b) => {
        let s = sD * (a.data[ sB ] == b.data[ sB ] ? 0 : a.data[ sB ] > b.data[ sB ] ? 1 : -1);
        if (!s) s = s = b.data.date - a.data.date;
        return s;
      });

      // recurse child pages
      ret.forEach(n => {
        n.children = recurseNav( n.children, n.data.directory );
      });

      return ret;
    }

    // render content in renderPriority order
    const
      write = [],
      navHeadingTag = '</' + (this.config?.headingAnchor?.tag || 'nav-heading') + '>',
      allByPriority = Array.from(tacs.all, ([, data]) => data).sort((a, b) => b.renderPriority - a.renderPriority);

    // custom processing: processRenderStart hook
    this.config.processRenderStart.forEach(fn => fn(tacs));

    allByPriority.forEach(data => {

      // custom processing: processPreRender hook
      this.config.processPreRender.forEach(fn => fn(data, tacs));

      // render content only
      let
        content = templateParse(data.content, data),
        contentNav = '';

      // content anchors
      if (this.config.headingAnchor && data.isHTML) {
        const nav = navHeading(content, this.config.headingAnchor);
        content = nav.content;
        contentNav = nav.navHeading;
      }

      // custom replacements
      content = strReplacer( content, this.config?.replace );

      // add !{ strings back
      const useTemplate = data.template || ((data.isIndexPage || data.isHTML) && this.config.defaultHTMLTemplate);
      if (useTemplate) {
        content = content.replace(/\$\{/g, '!{');
      }

      // store rendered content (for feeds)
      data.contentRendered = content;

      // render in template
      if (useTemplate) {

        const contentOrig = data.content;
        data.content = content;

        content = strReplacer(
          templateParse( templateMap.get(useTemplate), data ),
          this.config?.replace
        );

        data.content = contentOrig;

      }

      // replace navigation heading
      if (contentNav) {
        content = content.replaceAll(navHeadingTag, contentNav + navHeadingTag);
        data.contentRendered = data.contentRendered.replaceAll(navHeadingTag, contentNav + navHeadingTag);
      }

      // replace backticks in JS
      if (data.isJS) {
        content = content.replaceAll(Publican.#jsBackTick, '`');
        data.contentRendered = data.contentRendered.replaceAll(Publican.#jsBackTick, '`');
      }

      // custom processing: processPostRender hook
      this.config.processPostRender.forEach(fn => { content = fn(content, data, tacs); });

      // minify
      if (data.isXML) content = minifySimple(content);
      if (data.isHTML && this.config?.minify?.enabled) content = minifyFull(content, this.config.minify);

      // hash check and flag for file write
      const slug = data.slug, hash = strHash(content);

      // slug error - cannot navigate to parent using '..'
      if (slug.includes('..')) {
        throw new Error(`[Publican] slug cannot include parent directory .. reference: ${ slug }`);
      }

      if (this.#writeHash.get(slug) !== hash) {

        this.#writeHash.set(slug, hash);
        write.push({ slug, content });

      }

    });

    perf.mark('render web files');
    perf.mark('write web files');

    // write content to changed files
    await Promise.allSettled(
      write.map(async f => {

        const
          permaPath = join(this.config.dir.build, f.slug),
          permaDir = dirname(permaPath);

        // create files
        await mkdir(permaDir, { recursive: true });
        await writeFile(permaPath, f.content);

      })
    );

    // custom processing: processRenderEnd hook
    this.config.processRenderEnd.forEach(fn => fn(write, tacs));

    perf.mark('write web files');

    return write.length;

  }


  // copy pass-though files
  async #copyPassThrough() {

    perf.mark('copy passThrough files');

    await Promise.allSettled(
      [...this.config.passThrough].map( pt => cp(pt.from, join(this.config.dir.build, pt.to), { recursive: true, force: true } ))
    );

    perf.mark('copy passThrough files');

  }


  // paginate page lists
  #paginate(map, size, root, template) {

    const pages = new Map();

    map.forEach((list, name) => {

      const childPageTotal = list.length;
      if (!childPageTotal) return;

      const
        pageItem = chunk( list, size ),
        pageTotal = pageItem.length;

      for (let p = 0; p < pageTotal; p++) {

        const
          slug = join(root, name, String(p ? p : ''), '/' + this.config.indexFilename).replaceAll(sep, '/'),
          reIndexFn = new RegExp(this.config.indexFilename.replace(/\./g, '\\.') + '$');

        pages.set(slug, {
          name,
          slug,
          link: join(this.config.root, slug).replaceAll(sep, '/').replace(reIndexFn, ''),
          directory: dirname( slug ).replaceAll(sep, '/').replace(/\/.*$/, ''),
          date: this.#now,
          isIndexPage: true,
          isHTML: true,
          priority: 0.1,
          renderPriority: -1,
          template: template,
          childPageTotal,
          pagination: {
            page: pageItem[p],
            pageTotal,
            pageCurrent: p,
            pageCurrent1: p + 1,
            subpageFrom1: p * size + 1,
            subpageTo1: Math.min(childPageTotal, (p + 1) * size),
            hrefBack: p > 0 ? join(this.config.root, root, name, String(p > 1 ? p-1: ''), '/').replaceAll(sep, '/') : null,
            hrefNext: p+1 < pageTotal ? join(this.config.root, root, name, String(p+1), '/').replaceAll(sep, '/') : null,
            href: Array(pageTotal).fill(null).map((e, idx) => join(this.config.root, root, name, String(idx ? idx : ''), '/').replaceAll(sep, '/') )
          }
        });

      }

    });

    return pages;

  }

}

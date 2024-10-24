import { readdir, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { sep, join, dirname } from 'node:path';
import { performance } from 'perf_hooks';
import { watch } from 'node:fs';

import { slugify, normalize, extractFmContent, parseFrontMatter, mdHTML, navHeading, minifySimple, minifyFull, chunk, strReplacer, strHash } from './lib/lib.js';
import { tacsConfig, tacs, templateMap, templateParse } from 'jstacs';


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

  // set defaults
  constructor() {

    this.config = {

      // source and build directories
      dir: {
        content:  './src/content/',
        template: './src/template/',
        build:    './build/'
      },

      // default HTML template
      defaultHTMLTemplate: 'default.html',

      // domain
      domain: 'https://example.com',

      // root
      root: '/',

      // front matter marker
      frontmatterDelimit: '---',

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
        }
      },

      // heading anchors
      headingAnchor: {
        linkContent: '#',
        linkClass: 'headlink',
        navClass: 'contents',
        tag: 'nav-heading'
      },

      // directory page options
      dirPages: {
        size: 24,
        sortBy: 'priority',
        sortDir: -1,
        template: 'list.html'
      },

      // tag page options
      tagPages: {
        root: 'tag',
        size: 24,
        sortBy: 'date',
        sortDir: -1,
        template: 'list.html'
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

      // event functions to process incoming content files (slug, object)
      processContent: new Set(),

      // event functions to process incoming template files (slug, string)
      processTemplate: new Set(),

      // event content pre-render functions (slug, object)
      processPreRender: new Set(),

      // event functions to process rendered content (slug, string)
      processPostRender: new Set(),

      // directory pass-through { from (relative to project), to (relative to dir.build) }
      passThrough: new Set(),

      // replacer
      replace: new Map(),

      // watch options
      watch: false,
      watchDebounce: 300,

    };

  }


  // build site
  async build() {

    performance.mark('build:start');

    // pass template directory
    tacsConfig.dir.template = this.config.dir.template;

    performance.mark('processFiles:start');

    // fetch and process content and template files
    const file = (await Promise.allSettled([
      this.#readFileContents(this.config.dir.content),
      this.#readFileContents(this.config.dir.template),
    ])).map(f => (f.status === 'fulfilled' ? f.value : new Map()));

    file[0].forEach((content, filename) => this.addContent(filename, content));
    file[1].forEach((content, filename) => this.addTemplate(filename, content));

    performance.mark('processFiles:end');

    // render content
    const written = await this.#render();

    // copy passthrough files
    await this.#copyPassThrough();

    performance.mark('build:end');

    // output metrics
    this.#showMetrics(written, ['build', 'processFiles', 'render', 'writeFiles', 'passThrough']);

    // watch for file changes
    if (this.config.watch) {

      console.log('\nwatching for changes...');
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

      if (!performance.getEntriesByType('mark').length) {
        performance.mark('rebuild:start');
      }

      const
        cFiles = [...content],
        tFiles = [...template];

      content.clear();
      template.clear();

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
          const m = await this.#readFileContents(contentDir, f);
          this.addTemplate(f, m.get(f));
        })
      );

      // render if no more changes
      if (!content.size && !template.size) {

        const written = await this.#render();
        performance.mark('rebuild:end');
        this.#showMetrics(written, ['rebuild']);

      }

      // render complete
      this.#reRendering = false;

    };

  }


  // show performance metrics
  #showMetrics(written, metrics = []) {

    if (written) {

      console.log('   files output:' + String(written).padStart(5, ' '));

      metrics.forEach(m => {

        const p = Math.ceil( performance.measure(m, m + ':start', m + ':end').duration);
        console.log(m.padStart(15,' ') + ':' + String(p).padStart(5, ' ') + 'ms');

      });

    }

    performance.clearMarks();

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
      throw new Error('Content filename cannot include parent directory .. reference.');
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
    fInfo.slug = fInfo.slug || slugify(filename);
    fInfo.link = join(this.config.root, fInfo.slug).replace(/index\.html/, '').replaceAll(sep, '/');
    fInfo.directory = dirname( fInfo.slug ).replaceAll(sep, '/').replace(/\/.*$/, '');
    fInfo.date = fInfo.date ? new Date(fInfo.date) : this.#now;
    fInfo.priority = parseFloat(fInfo.priority) || 0.1;
    fInfo.isMD = fInfo.filename?.toLowerCase().endsWith('.md'),
    fInfo.isHTML = fInfo.slug.endsWith('.html'),
    fInfo.isXML = fInfo.slug.endsWith('.xml');

    // format tags
    if (fInfo.tags) {

      fInfo.tags = [
        ...new Set( (fInfo.tags).split(',')
          .map(v => v.trim().replace(/\s+/g, ' ')) )
      ];

      // create tag information
      if (this.config.tagPages) {

        fInfo.tags = fInfo.tags.map(tag => {

          const
            ref = normalize(tag),
            slug = join(this.config.tagPages.root || '', ref).replaceAll(sep, '/') + '/index.html',
            link = join(this.config.root, dirname(slug)).replaceAll(sep, '/') + '/';

          return { tag, ref, link, slug };

        });

      }

    }

    // publication
    if (fInfo.publish) {
      const p = fInfo.publish.toLowerCase();
      fInfo.publish = this.#isDev || !(p === 'draft' || p === 'false' || this.#now < new Date(p));
    }

    // index frequency
    fInfo.index = fInfo.index || 'monthly';
    if (fInfo.index.toLowerCase() === 'false') fInfo.index = false;

    // content - convert markdown to HTML if necessary
    fInfo.content = fInfo.isMD ? mdHTML(fData.content, this.config.markdownOptions) : fData.content;

    // ensure pages using data.contentRendered are processed last
    fInfo.renderPriority = fInfo.content.includes('.contentRendered') ? -2 : 0;

    // custom processing
    this.config.processContent.forEach(fn => fn(filename, fInfo));

    // store in Map
    this.#contentMap.set(filename, fInfo);

  }


  // add and parse template
  addTemplate(filename, content) {

    // delete from Map
    if (content === undefined) {
      templateMap.delete(filename);
      return;
    }

    // custom processing
    this.config.processTemplate.forEach(fn => { content = fn(filename, content); });

    // store in Map
    templateMap.set(filename, content);

  }


  // render and build site
  async #render() {

    performance.mark('render:start');

    // TACS global content
    tacs.config = {
      domain: this.config.domain,
      root: this.config.root,
    };
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
        data.slug !== dir + '/index.html' &&
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
      tacs.all.set(data.slug, data);

    });

    // directory pages
    if (this.config.dirPages) {

      const sB = this.config.dirPages.sortBy || 'priority', sD = this.config.dirPages.sortDir || -1;

      tacs.dir.forEach((list, dir) => {

        // sort by factor then date
        list.sort( (a, b) => {
          let s = sD * (a[ sB ] - b[ sB ]);
          if (!s) s = b.date - a.date;
          return s;
        } );

        tacs.dir.set(dir, list);

        // next and back articles
        for (let a = 0; a < list.length; a++) {
          const data = list[a];
          data.postnext = a > 0 ? list[a - 1] : null;
          data.postback = a < list.length - 1 ? list[a + 1] : null;
        }

      });

      // paginate
      this.#paginate(
        tacs.dir,
        this.config.dirPages.size || Infinity,
        this.config.dirPages.root || '',
        this.config.dirPages.template
      ).forEach((fInfo, slug) => {

        fInfo.title = fInfo.directory;
        tacs.all.set(slug, Object.assign(fInfo, tacs.all.get(slug) || {}));

      });

    }

    // tag pages
    if (this.config.tagPages) {

      const sB = this.config.tagPages.sortBy || 'date', sD = this.config.tagPages.sortDir || -1;

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

        fInfo.title = tagName.get( fInfo.name );
        tacs.all.set(slug, Object.assign(fInfo, tacs.all.get(slug) || {}));

      });

    }

    // render content in renderPriority order
    const
      write = [],
      navHeadingTag = '</' + (this.config?.headingAnchor?.tag || 'nav-heading') + '>',
      allByPriority = Array.from(tacs.all, ([, data]) => data).sort((a, b) => b.renderPriority - a.renderPriority);

    allByPriority.forEach(data => {

      // get slug
      const slug = data.slug;

      // custom pre-render processing
      this.config.processPreRender.forEach(fn => fn(slug, data));

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

      // store rendered content (for feeds)
      data.contentRendered = content.replace(/\$\{/g, '!{');

      // render in template
      const useTemplate = data.template || (data.isHTML && this.config.defaultHTMLTemplate);
      if (useTemplate) {

        content = strReplacer(
          templateParse( templateMap.get(useTemplate), data ),
          this.config?.replace
        );

      }

      // replace navigation heading
      if (contentNav) {
        content = content.replaceAll(navHeadingTag, contentNav + navHeadingTag);
      }

      // custom post-render processing
      this.config.processPostRender.forEach(fn => { content = fn(slug, content); });

      // minify
      if (data.isXML) content = minifySimple(content);
      if (data.isHTML && this.config?.minify?.enabled) content = minifyFull(content, this.config.minify);

      // hash check and flag for file write
      const hash = strHash(content);
      if (this.#writeHash.get(slug) !== hash) {

        this.#writeHash.set(slug, hash);
        write.push({ slug, content });

      }

    });

    performance.mark('render:end');
    performance.mark('writeFiles:start');

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

    performance.mark('writeFiles:end');

    return write.length;

  }


  // copy pass-though files
  async #copyPassThrough() {

    performance.mark('passThrough:start');

    await Promise.allSettled(
      [...this.config.passThrough].map( pt => cp(pt.from, join(this.config.dir.build, pt.to), { recursive: true, force: true } ))
    );

    performance.mark('passThrough:end');

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

        const slug = join(root, name, String(p ? p : ''), '/index.html').replaceAll(sep, '/');

        pages.set(slug, {
          name,
          slug,
          link: join(this.config.root, slug).replaceAll(sep, '/').replace(/index\.html/, ''),
          directory: dirname( slug ).replaceAll(sep, '/').replace(/\/.*$/, ''),
          date: this.#now,
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
            hrefBack: p > 0 ? join(this.config.root, root, name, String(p > 1 ? p-1: ''), '/') : null,
            hrefNext: p+1 < pageTotal ? join(this.config.root, root, name, String(p+1), '/') : null,
            href: Array(pageTotal).fill(null).map((e, idx) => join(this.config.root, root, name, String(idx ? idx : ''), '/') )
          }
        });

      }

    });

    return pages;

  }

}

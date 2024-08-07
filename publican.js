import { readdir, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'perf_hooks';
import { watch } from 'node:fs';

import { createSlug, extractFmContent, parseFrontMatter, mdHTML, minifySimple, minifyFull, chunk } from './lib/lib.js';
import { templateConfig, templateMap, parseTemplate, templateEngine } from './lib/tacs.js';


// export for Express
export { parseTemplate, templateEngine };


// main Publican class
export class Publican {

  // private members
  #isDev = (process.env.NODE_ENV === 'development');
  #contentMap = new Map();
  #tagMap = new Map();
  #now = new Date();

  // set defaults
  constructor() {

    this.config = {

      // source and build directories
      dir: {
        content:  './src/content/',
        template: './src/template/',
        build:    './build/'
      },

      // default template
      defaultTemplate: 'default.html',

      // root
      root: '/',

      // number of items per page
      pageListItems: 3,

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
        headingAnchor: {
          linkContent: '#',
          linkClass: 'headlink',
          headingnavClass: 'contents'
        },
        prism: {
          defaultLanguage: 'js',
          highlightInlineCode: true
        }
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

      // watch options
      watch: false,
      watchDebounce: 200,

      // functions to process incoming content files
      processContent: new Set(),

      // functions to process incoming template files
      processTemplate: new Set(),

      // content pre-render functions
      processPreRender: new Set(),

      // functions to process rendered content
      processRendered: new Set(),

      // directory pass-through { from (relative to project), to (relative to dir.build) }
      passThrough: new Set(),

    };

  }


  // build site
  async build() {

    performance.mark('build:start');

    performance.mark('getContent:start');

    // fetch content
    await this.#getFiles(this.#contentMap, this.config.dir.content, null, this.#processContent, this.config.processContent);

    performance.mark('getContent:end');
    performance.mark('getTemplates:start');

    // fetch templates
    templateConfig.dir.template = this.config.dir.template;
    await this.#getFiles(templateMap, this.config.dir.template, null, null, this.config.processTemplate);

    performance.mark('getTemplates:end');

    // render content
    const written = await this.#render();

    // copy passthrough files
    await this.#copyPassThrough();

    performance.mark('build:end');

    // output metrics
    this.#showMetrics(written, ['build', 'getContent', 'getTemplates', 'render', 'writeFiles', 'passThrough']);

    // console.dir(this.#contentMap, { depth: null, color: true });
    // console.dir(templateMap, { depth: null, color: true });
    // console.dir(this.#tagMap, { depth: null, color: true });

    // watch for file changes
    if (this.config.watch) {

      console.log('\nwatching for changes...');

      this.#watcher(this.#contentMap, this.config.dir.content, this.#rebuild.bind(this), this.#processContent, this.config.processContent );
      this.#watcher(templateMap, this.config.dir.template, this.#rebuild.bind(this), null, this.config.processTemplate );

    }

  }


  // debounced file watcher
  #watcher(map, path, callback, processInternal, processCustom) {

    let debounce;
    watch(path, { recursive: true }, (eventType, fn) => {

      clearTimeout(debounce);
      debounce = setTimeout(async () => await callback(map, path, fn, processInternal, processCustom), this.config.watchDebounce);

    });

  }


  // rebuild on file change
  async #rebuild(map, path, fn, processInternal, processCustom) {

    performance.mark('rebuild:start');

    // fetch files
    await this.#getFiles(map, path, fn, processInternal, processCustom);

    // render content
    const written = await this.#render();

    performance.mark('rebuild:end');

    // output metrics
    this.#showMetrics(written, ['rebuild']);

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


  // read and process files
  async #getFiles(map, srcPath, filePath, processInternal, processCustom) {

    // find all files
    const files = filePath ? [filePath] : await readdir(srcPath, { recursive: true });

    // get file content
    const fileCont = await Promise.allSettled(
      files.map(f => readFile( join(srcPath, f), { encoding: 'utf8' } ) )
    );

    // process file data and store in map
    fileCont.forEach((f, idx) => {

      const
        filename = files[idx],
        fileslug = srcPath === this.config.dir.template ? filename : createSlug(filename);

      if (f.status === 'fulfilled') {

        // internal processing
        let render = processInternal ? processInternal.bind(this)(filename, f.value) : f.value;

        // custom processing
        processCustom.forEach(fn => { render = fn(filename, render); });

        // store in Map
        map.set(fileslug, render);

        // content files
        if (render?.publish !== false) {

          // add directory to tag map
          if (render?.directory !== '.') {

            const
              tName = 'DIR:' + render.directory,
              dirList = this.#tagMap.get(tName) || new Set();

            dirList.add(fileslug);
            this.#tagMap.set(tName, dirList);

          }

          // add tags to tag map
          render?.tags?.forEach(tag => {

            const
              tName = 'TAG:' + tag,
              tagList = this.#tagMap.get(tName) || new Set();

            tagList.add(fileslug);
            this.#tagMap.set(tName, tagList);

          });

        }

      }
      else {

        // file not found - delete from Map
        map.delete(fileslug);

      }

    });

  }


  // process content files
  #processContent(fn, str) {

    const
      // extract front matter and content
      fData = extractFmContent(str, this.config.frontmatterDelimit),

      // parse front matter
      fInfo = parseFrontMatter( fData.fm );

    fInfo.slug = fInfo.slug || createSlug(fn);
    fInfo.link = dirname( join(this.config.root, fInfo.slug) ) + '/';
    fInfo.directory = dirname(fn),
    fInfo.date = fInfo.date ? new Date(fInfo.date) : this.#now;
    fInfo.priority = parseFloat(fInfo.priority) || 0.1;
    fInfo.headingnav = (fInfo.headingnav || 'false').toLowerCase();
    fInfo.headingnav = (fInfo.headingnav !== 'false');
    if (fInfo.tags) fInfo.tags = [
      ...new Set( (fInfo.tags).split(',')
        .map(v => v.trim().replace(/\s+/g, ' ')) )
    ];
    if (fInfo.publish) {
      const p = fInfo.publish.toLowerCase();
      fInfo.publish = this.#isDev || !(p === 'draft' || p === 'false' || this.#now < new Date(p));
    }

    // convert markdown content
    fInfo.content = fn.endsWith('.md') ? mdHTML(fData.content, this.config.markdownOptions, fInfo.headingnav) : fData.content;

    return fInfo;

  }


  // render and build site
  async #render() {

    performance.mark('render:start');

    // custom pre-render processing
    this.config.processPreRender.forEach(fn => fn());

    // render content
    const render = [];
    this.#contentMap.forEach((data, file) => {

      // draft page
      if (data.publish === false) return;

      // initial parse
      const slug = data.slug;
      let content = parseTemplate( templateMap.get(data.template || this.config.defaultTemplate), data );

      // custom render processing
      this.config.processRendered.forEach(fn => { content = fn(slug, content); });

      // minify
      const
        isHTML = slug.endsWith('.html'),
        isXML = slug.endsWith('.xml');

      if (isHTML || isXML) content = minifySimple(content);
      if (isHTML && this.config?.minify?.enabled) content = minifyFull(content, this.config.minify);

      // hash check
      const hash = createHash('sha1').update(content).digest('base64');

      if (hash !== data.hash) {

        data.hash = hash;
        this.#contentMap.set(file, data);
        render.push({ file, slug, content });

      }

    });

    performance.mark('render:end');
    performance.mark('writeFiles:start');

    // write content to changed files
    await Promise.allSettled(
      render.map(async f => {

        const
          permaPath = join(this.config.dir.build, f.slug),
          permaDir = dirname(permaPath);

        // create files
        await mkdir(permaDir, { recursive: true });
        await writeFile(permaPath, f.content);

      })
    );

    performance.mark('writeFiles:end');

    return render.length;

  }


  // copy pass-though files
  async #copyPassThrough() {

    performance.mark('passThrough:start');

    await Promise.allSettled(
      [...this.config.passThrough].map( pt => cp(pt.from, join(this.config.dir.build, pt.to), { recursive: true, force: true } ))
    );

    performance.mark('passThrough:end');

  }


  // create paginated pages
  processPreRenderPaginated(type, sortBy, sortDir = 1, root = '', template) {

    return () => {

      [...this.#tagMap.keys()]
        .filter(t => t.startsWith(type))
        .forEach(tag => {

          // sort pages for each tag
          const pageSet = [...this.#tagMap.get(tag)]
            .map(t => this.#contentMap.get(t))
            .sort((a, b) => {

              if (!sortBy) return 0;

              const
                pA = a?.[sortBy] || 0,
                pB = b?.[sortBy] || 0;

              let ret = 0;
              if (pA < pB) ret = -1;
              else if (pA > pB) ret = 1;

              return ret * sortDir;

            });

          const childPageTotal = pageSet.length;
          if (!childPageTotal) return;

          // new page data
          const
            tagName = tag.slice(4),
            tagLink = tagName.toLowerCase().replace(/\W/g, '-'),
            pageItem = chunk( pageSet, this.config.pageListItems ),
            pageTotal = pageItem.length;

          for (let p = 0; p < pageTotal; p++) {

            const slug = join(root, tagLink, String(p ? p : ''), '/index.html');

            // add/append page details
            const fInfo = this.#contentMap.get(slug) || {};
            fInfo.slug = slug;
            fInfo.link = dirname( join(this.config.root, fInfo.slug) ) + '/';
            fInfo.date = this.#now;
            fInfo.childPageTotal = childPageTotal;

            fInfo.title = fInfo.title || tagName;
            fInfo.tag = fInfo.tag || tagName;
            fInfo.template = fInfo.template || template || this.config.defaultTemplate;

            fInfo.pagination = {
              page: pageItem[p],
              pageTotal,
              pageCurrent: p,
              pageCurrent1: p + 1,
              subpageFrom1: p * this.config.pageListItems + 1,
              subpageTo1: Math.min(childPageTotal, (p + 1) * this.config.pageListItems),
              hrefBack: p > 0 ? join(this.config.root, root, tagLink, String(p > 1 ? p-1: ''), '/') : null,
              hrefNext: p+1 < pageTotal ? join(this.config.root, root, tagLink, String(p+1), '/') : null,
              href: Array(pageTotal).fill(null).map((e, idx) => join(this.config.root, root, tagLink, String(idx ? idx : ''), '/') )
            };

            this.#contentMap.set(slug, fInfo);

          }

        });


    };

  }


}

import { join, dirname } from 'node:path';
import { readdir, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'perf_hooks';
import { watch } from 'node:fs';

import markdownit from 'markdown-it';
import prism from 'markdown-it-prism';
import { minify } from 'html-minifier-security-fix';

import { createSlug, chunk } from './lib/lib.js';
import { templateConfig, templateMap, parseTemplate, templateEngine } from './lib/tacs.js';

// export for Express
export { parseTemplate, templateEngine };

export class Publican {

  // private members
  #isDev = (process.env.NODE_ENV === 'development');
  #md;
  #contentMap = new Map();
  #tagMap = new Map();

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

      // markdown options
      markdownit: {
        html: true,
        breaks: false,
        linkify: true,
        typographer: true
      },

      // markdown code block options
      prism: {
        enabled: true,
        defaultLanguage: 'js',
        highlightInlineCode: true
      },

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

      watch: false,
      watchDebounce: 200

    };

  }


  // build site
  async build() {

    performance.mark('build:start');

    // initialize markdown parsing function
    this.#md = markdownit(this.config.markdownit);
    if (this.config?.prism?.enabled) this.#md = this.#md.use(prism, this.config.prism);

    performance.mark('getContent:start');

    // fetch content
    await this.#getFiles(this.#contentMap, this.config.dir.content, null, this.#processContent, this.config.processContent);

    performance.mark('getContent:end');
    performance.mark('getTemplates:start');

    // fetch templates
    templateConfig.dir = templateConfig.dir || {};
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
        if (render?.publish) {

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

    // front matter delimiter
    const
      fmDelimit = '---',
      fInfo = {
        file: fn,
        slug: createSlug(fn),
        directory: dirname(fn),
        date: new Date(),
        publish: true
      };

    fInfo.link = dirname( join(this.config.root, fInfo.slug) ) + '/';

    str = str.trim();
    const fmP2 = str.indexOf(fmDelimit, fmDelimit.length);

    if (str.startsWith(fmDelimit) && fmP2 > 0) {

      // extract front matter
      str.substring(3, fmP2).trim().split(/\n/g).forEach(fm => {

        const fmParse = fm.split(/(^[a-z0-9-_]+):/i);

        if (fmParse.length === 3) {
          const key = fmParse[1];
          let value = fmParse[2].trim();

          if (!value) value = true;

          switch (key) {

            case 'date':
              value = new Date(value);
              break;

            case 'tags':
              value = [ ...new Set( value.split(',').map(v => v.trim().replace(/\s+/g, ' ')) ) ];
              break;

            case 'priority':
              value = parseFloat(value);
              break;

            case 'publish':
              value = value.toLowerCase();
              value = this.#isDev || !(value === 'draft' || value === 'false' || new Date() < new Date(value));
              break;

          }

          fInfo[ key ] = value;

        }

      });

      // remove front matter
      str = str.substring(fmP2 + 3).trim();

    }

    // convert markdown
    fInfo.content = fn.endsWith('.md') ? this.#md.render(str) : str;

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
      if (!data.publish) return;

      // initial parse
      const slug = data.slug;
      let content = parseTemplate( templateMap.get(data.template || this.config.defaultTemplate), data );

      // custom render processing
      this.config.processRendered.forEach(fn => { content = fn(slug, content); });

      // minify
      content = this.#minify(slug, content);

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


  // minify content
  #minify(fn, str) {

    const
      isHTML = fn.endsWith('.html'),
      isXML = fn.endsWith('.xml');

    if (!isHTML && !isXML) return str;

    // initial white space strip
    str = String(str || '')
      .replace(/[\u0085\u00a0\u1680\u180e\u2028\u2029\u202f\u205f\u3000]+/g, ' ')
      .replace(/[\u2000-\u200a]+/g, ' ')
      .replace(/\u2424/g, '\n')
      .replace(/\s*?\n/g, '\n')
      .trim();

    let oc;
    do {
      oc = str;
      str = str.replace(/\n\s*?\n\s*?\n/g, '\n\n');

      // strip XML comments and whitespace
      if (isXML) {
        str = str
          .replace(/<!--.*?-->/g, '')
          .replace(/\n\n/g, '\n')
          .replace(/\n\s+</g, '\n<');
      }

    } while (str !== oc);

    // XML or partial minify
    if (isXML || !this.config?.minify?.enabled) return str;

    // full HTML minify
    return minify(str, this.config.minify);

  }


  // copy pass-though files
  async #copyPassThrough() {

    performance.mark('passThrough:start');

    await Promise.allSettled(
      [...this.config.passThrough].map( pt => cp(pt.from, join(this.config.dir.build, pt.to), { recursive: true, force: true } ))
    );

    performance.mark('passThrough:end');

  }


  // create heading anchor and content list (processContent function)
  processContentHeadAnchor(fn, data) {

    if (data?.slug?.endsWith('.html')) {

      data.contentnav = [];

      data.content = data.content.replace(/<(h[1-6])(.?)>(.+)<\/h[1-6]>/gi,
        (m, p1, p2, p3) => {

          let id = p3
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase();

          const fc = id.slice(0, 1);
          if (fc < 'a' || fc > 'z') id = 'a-' + id;

          data.contentnav.push(`<a href="#${ id }" class="head-${ p1 }">${ p3 }</a>`);

          return `<${ p1 }${ p2 } id="${ id }" tabindex="-1">${ p3 } <a href="#${ id }" class="head-link">#</a></${ p1 }>`;
        }
      );

    }

    return data;

  }


  // create paginated pages
  processPreRenderPaginated(type, sortBy, sortDir = 1, root = '', template) {

    const now = new Date();

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
            fInfo.publish = true;
            fInfo.date = now;
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

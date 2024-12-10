// library functions
import { parse } from 'node:path';
import { createHash } from 'node:crypto';

import markdownit from 'markdown-it';
import prism from 'markdown-it-prism';
import { minify } from 'html-minifier-security-fix';


// create a slug from filename
export function slugify(filename, replaceMap) {

  let
    p = parse( filename.toLowerCase() ),
    slug = filename;

  if (p.ext === '.html' || p.ext === '.md') {

    p = parse( filename.replace(/#|!|$|^|~|\s/gi, '').replaceAll('\\', '/').toLowerCase() );
    slug = (p.dir ? p.dir + '/' : '') + p.name;
    slug += (slug === 'index' || slug.endsWith('/index') ? '' : '/index') + '.html';

  }

  return strReplacer( slug, replaceMap ).trim();

}


// make a string "Proper case" with an initial capital
export function properCase(str) {

  str = str
    .toLowerCase()
    .replace(/\W/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase();

}


// normalize a string - lower case alphanumerics with dash instead of spaces
export function normalize(str) {

  return str
    .toLowerCase()
    .replace(/\W/g, ' ')
    .trim()
    .replace(/\s+/g, '-');

}


// split a string into front matter and content
export function extractFmContent(str, fmDelimit = '---') {

  str = str.trim();

  const
    fmdLen = fmDelimit.length,
    fmP2 = str.indexOf(fmDelimit, fmdLen);

  let fm = '', content = '';

  if (str.startsWith(fmDelimit) && fmP2 > 0) {
    fm = str.substring(fmdLen, fmP2).trim();
    content = str.substring(fmP2 + fmdLen).trim();
  }
  else {
    content = str;
  }

  return { fm, content };

}


// parse front matter string into object with key/value pairs
export function parseFrontMatter(fm) {

  const fmObj = {};

  fm.split(/\n/g).forEach(fm => {

    const fmParse = fm.split(/(^[a-z0-9-_]+):/i);

    if (fmParse.length === 3) {
      fmObj[ fmParse[1] ] = fmParse[2].trim() || true;
    }

  });

  return fmObj;

}


// convert markdown to HTML
let md, mdConfig = null;
const expRe = /\$\{\{.*?\}\}/gms, expPH = '@##@@@##@';
export function mdHTML(str, mdOpts = mdConfig) {

  // initialize markdown parsing function
  if (!md || mdOpts !== mdConfig) {

    mdConfig = mdOpts;
    md = markdownit(mdConfig?.core || {});
    if (mdConfig.prism) md = md.use(prism, mdConfig.prism);

  }

  // comment out ${{ ... }} expression strings
  const expReplace = (str.match(expRe) || []).map(e => '$' + e.slice(2,-1));
  str = str.replace(expRe, expPH);

  // markdown to HTML conversion
  str = md.render(str);

  // initial code lines
  str = str
    .replace(/<p>(<nav-heading.*?<\/nav-heading>)<\/p>/gi, '$1')  // remove <nav-heading> paragraphs
    .replace(/(<span class="token[^>]*>)`/gi, '$1&#96;')          // escape code backticks
    .replace(/(<span class="token[^>]*>&#96;<\/span>)+/gi, '$1')  // replace multiple backticks
    .replace(/(<span class="token[^>]*>)\$\{/gi, '$1&#36;{');     // escape code ${ characters

  // multiple adjustments
  let oc;
  do {
    oc = str;
    str = str
      .replace(/(<code class="language-.+?)\$\{(.+?<\/code>)/gis, '$1&#36;{$2') // escape ${
      .replace(/(<code class="language-.+?)!\{(.+?<\/code>)/gis, '$1&#33;{$2'); // escape !{
  } while (str !== oc);

  // put expressions back in
  if (expReplace.length) {

    str = str
      .split(expPH)
      .reduce((acc, cur, idx) => acc + cur + (expReplace[idx] || ''), '');

  }

  return str;

}


// create heading anchors and content lists
export function navHeading(str, haOpt) {

  if (!haOpt) return { content: str, navHeading: '' };

  const idCount = {};
  let navHeading = '', clevel = 1;

  str = str.replace(/<(h[2-6])(.?)>(.+?)<\/h[2-6]>/gi,
    (m, p1, p2, p3) => {

      // generate ID
      let id = p3
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();

      // ensure ID starts with a letter
      const fc = id.slice(0, 1);
      if (fc < 'a' || fc > 'z') id = 'a-' + id;

      // handle duplicate IDs
      idCount[id] = (idCount[id] || 0) + 1;
      if (idCount[id] > 1) id += `-${ idCount[id ]}`;

      // update contents navigation
      const pl = parseFloat(p1.slice(-1));

      for (let p = pl; p > clevel; p--) navHeading += '\n<ol><li>\n';
      for (let p = pl; p < clevel; p++) navHeading += '\n</li></ol>\n';
      if (pl <= clevel) navHeading += '</li>\n<li>';

      navHeading += `<a href="#${ id }" class="head-${ p1 }">${ p3 }</a>`;
      clevel = pl;

      // update heading
      return `<${ p1 }${ p2 } id="${ id }" tabindex="-1">${ p3 } <a href="#${ id }" class="${ haOpt.linkClass }">${ haOpt.linkContent }</a></${ p1 }>`;
    }
  );

  if (navHeading) {
    navHeading = `<nav class="${ haOpt.navClass }">${ navHeading }\n${ '</li></ol>'.repeat(clevel - 1) }\n</nav>`;
  }

  return { content: str, navHeading };

}


// simple HTML/XML whitespace strip
export function minifySimple(str) {

  str = String(str || '')
    .replace(/[\u0085\u00a0\u1680\u180e\u2028\u2029\u202f\u205f\u3000]+/g, ' ')
    .replace(/[\u2000-\u200a]+/g, ' ')
    .replace(/\u2424/g, '\n')
    .replace(/\s*?\n/g, '\n')
    .trim();

  let oc;
  do {
    oc = str;
    str = str
      .replace(/\n\s*?\n\s*?\n/g, '\n\n')
      .replace(/\n\n/g, '\n')
      .replace(/\n\s+</g, '\n<');
  } while (str !== oc);

  return str;

}


// comprehensive HTML minification
export function minifyFull(str, minOpts) {

  return minify(str, minOpts);

}


// split array into chunks of chunkSize
export function chunk(array, chunkSize = 1) {

  if (chunkSize <= 0) return [];

  const
    chunked = [],
    aCopy = [...array];

  while (aCopy.length) chunked.push( aCopy.splice(0, chunkSize) );
  return chunked;

}


// string token replacer
// pass string and Map() object with search/replace values (can be strings, regular expressions, etc.)
export function strReplacer(str, map) {

  if (map?.size) {
    map.forEach((replace, search) => { str = str.replaceAll(search, replace); });
  }
  return str;

}


// create hash a string
export function strHash(str) {

  return createHash('sha1').update(str).digest('base64');

}

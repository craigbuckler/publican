// library functions
import { parse } from 'node:path';
import { createHash } from 'node:crypto';

import markdownit from 'markdown-it';
import prism from 'markdown-it-prism';
import { minify } from 'html-minifier-security-fix';


// create a slug from filename
export function slugify(fn) {

  let
    p = parse( fn.toLowerCase() ),
    slug = fn;

  if (p.ext === '.html' || p.ext === '.md') {

    p = parse( fn.replace(/#|!|$|^|~|\s/gi, '').toLowerCase() );
    slug = (p.dir ? p.dir + '/' : '') + p.name;
    slug += (slug.endsWith('index') ? '' : '/index') + '.html';

  }

  return slug;

}


// normalize a string - lower case alphanumerics with dash instead of spaces
export function normalize(tag) {

  return tag
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
export function mdHTML(str, mdOpts = mdConfig, headingNav = false) {

  // initialize markdown parsing function
  if (!md || mdOpts !== mdConfig) {

    mdConfig = mdOpts;
    md = markdownit(mdConfig?.core || {});
    if (mdConfig.prism) md = md.use(prism, mdConfig.prism);

  }

  // HTML conversion
  str = md.render(str);

  // apply heading anchors
  if (mdConfig.headingAnchor) str = headingAnchor(str, mdConfig.headingAnchor, headingNav);

  return str;

}


// create heading anchors and contents
// todo: headings could be in non-markdown content
function headingAnchor(str, haOpt, headingNav) {

  const idCount = {};
  let contentsList = '', clevel = 1;

  str = str.replace(/<(h[1-6])(.?)>(.+)<\/h[1-6]>/gi,
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
      if (headingNav) {
        const pl = parseFloat(p1.slice(-1));

        for (let p = pl; p > clevel; p--) contentsList += '\n<ol><li>\n';
        for (let p = pl; p < clevel; p++) contentsList += '\n</li></ol>\n';
        if (pl <= clevel) contentsList += '</li>\n<li>';

        contentsList += `<a href="#${ id }" class="head-${ p1 }">${ p3 }</a>`;
        clevel = pl;
      }

      // update heading
      return `<${ p1 }${ p2 } id="${ id }" tabindex="-1">${ p3 } <a href="#${ id }" class="${ haOpt.linkClass }">${ haOpt.linkContent }</a></${ p1 }>`;
    }
  );

  if (contentsList) {
    contentsList = `<nav class="${ haOpt.headingnavClass }">\n${ contentsList }\n${ '</li></ol>'.repeat(clevel - 1) }</nav>\n`;
  }

  return contentsList + str;

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


// create hash a string
export function strHash(str) {

  return createHash('sha1').update(str).digest('base64');

}

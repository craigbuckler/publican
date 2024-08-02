// assorted library functions
import markdownit from 'markdown-it';
import prism from 'markdown-it-prism';
import { minify } from 'html-minifier-security-fix';


// create a slug from an original filename
export function createSlug(fn) {

  fn = fn.replace(/#|!|$|^|~|\s/gi, '').toLowerCase();

  if (fn.endsWith('md')) {
    fn = fn.slice(0, -3);
    fn += (fn.endsWith('index') ? '' : '/index') + '.html';
  }

  return fn;

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
export function mdHTML(str, mdOpts = mdConfig) {

  // initialize markdown parsing function
  if (!md || mdOpts !== mdConfig) {

    mdConfig = mdOpts;
    md = markdownit(mdConfig?.core || {});
    if (mdConfig.prism) md = md.use(prism, mdConfig.prism);

  }

  return md.render(str);

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

// library functions
import { parse } from 'node:path';
import { createHash } from 'node:crypto';

import markdownit from 'markdown-it';
import prism from 'markdown-it-prism';
import Prism from 'prismjs';
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
const expressionPlaceholder = '🍺🍻🍷🫖🍷🍻🍺';

export function mdHTML(str, mdOpts = mdConfig) {

  // initialize markdown parsing function
  if (!md || mdOpts !== mdConfig) {

    mdConfig = mdOpts;
    md = markdownit(mdConfig?.core || {});
    if (mdConfig.prism) md = md.use(prism, mdConfig.prism);

  }

  const preparse = extractExpressions(str);

  // markdown to HTML conversion
  str = encodeExpressions(                                          // encode expression characters
    md.render( preparse.md.join(expressionPlaceholder) )            // render MD to HTML
      .replace(/<p>(<nav-heading.*?<\/nav-heading>)<\/p>/gis, '$1') // remove <nav-heading> paragraphs
  );

  str = str
    .split(expressionPlaceholder)
    .reduce((acc, cur, idx) => {

      acc += cur;
      let exp = preparse.exp[idx] || '', expDB = false;

      // remove double-bracket expressions
      if (exp.slice(1,3) === '{{') {
        expDB = true;
        exp = exp.replace(/^(\$|!)\{+(.+?)\}+$/s, '$1{$2}');
      }

      // highlight in <code> block
      if (acc.lastIndexOf('<code') > acc.lastIndexOf('</code') && !expDB) {

        exp = encodeExpressions(
          exp.at(0) + '{' +
          Prism.highlight(exp.slice(2,-1), Prism.languages.js) +
          '}'
        );

      }

      return acc + exp;
    }, '');

  return str;

}


// extract ${} and !{} expressions from a string
// returns two arrays: md - markdown (length L+1), exp - expressions (length L)
// order is: md[0] + exp[0] + md[1] + exp[1] +...
function extractExpressions(str) {

  const md = [], exp = [];
  const findExp = /[$|!]\{/g;

  let i = 0;
  while (i < str.length) {

    // find next expression
    findExp.lastIndex = i;
    const match = findExp.exec(str);
    if (!match) break;

    const start = findExp.lastIndex - 2;
    let
      end = -1,
      quote = null,
      bCount = 1;

    // store markdown
    md.push(str.slice(i, start));

    // find end of expression
    for (let j = start + 2; j < str.length; j++) {

      const c = str[j];

      if (quote) {
        if (c === quote && str[j - 1] !== '\\') quote = null;
      }
      else {

        if (c === '"' || c === '\'' || c === '`') quote = c;
        else if (c === '{') bCount++;
        else if (c === '}') {
          bCount--;
          if (!bCount) {
            end = j;
            break;
          }
        }

      }

    }

    // store expression
    if (end >= 0) {
      exp.push(str.slice(start, end + 1));
      i = end + 1;
    }
    else break;

  }

  // end of markdown
  md.push(str.slice(i));

  return { md, exp };

}


// convert expression strings
function encodeExpressions(str) {

  return str
    .replaceAll('!{', '&#33;{')
    .replaceAll('${', '&#36;{')
    .replaceAll('\\', '&#92;')
    .replaceAll('`', '&#96;');

}


// create heading anchors and content lists
export function navHeading(str, haOpt) {

  if (!haOpt) return { content: str, navHeading: '' };

  const idCount = {};
  let navHeading = '', clevel = 1;

  str = str.replace(/<(h[2-6])(.*?)>(.*?)<\/h[2-6]>/gis,
    (m, p1, p2, p3) => {

      // add heading link?
      const addLink = !haOpt.nolink || !p2.includes(haOpt.nolink);

      // add menu link?
      const addMenu = !haOpt.nomenu || !p2.includes(haOpt.nomenu);

      // add tabindex?
      const addTabindex = (addLink || addMenu) && !p2.includes('tabindex=');

      // ID set?
      let idUsed = p2.match(/id=(?:"|'){0,1}([^"|'|\s]+)(?:"|'|\s)/i);
      idUsed = idUsed && idUsed[1];
      let id = idUsed;

      if (!id && (addLink || addMenu)) {

        // generate ID
        id = p3
          .replace(/<.*?>/g, '')
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase();

        // ensure ID starts with a letter
        const fc = id.slice(0, 1);
        if (fc < 'a' || fc > 'z') id = 'a-' + id;

        // handle duplicate IDs
        idCount[id] = (idCount[id] || 0) + 1;
        if (idCount[id] > 1) id += `-${ idCount[id ]}`;

      }
      else idUsed = true;

      // update contents navigation
      const pl = parseFloat(p1.slice(-1));

      for (let p = pl; p > clevel; p--) navHeading += '\n<ol><li>\n';
      for (let p = pl; p < clevel; p++) navHeading += '\n</li></ol>\n';
      if (pl <= clevel) navHeading += '</li>\n<li>';

      if (addMenu) navHeading += `<a href="#${ id }" class="head-${ p1 }">${ p3 }</a>`;
      clevel = pl;

      // update heading
      return `<${ p1 }${ p2 }${ idUsed ? '' : ` id="${ id }"` }${ addTabindex ? ' tabindex="-1"' : '' }>${ p3 }${ addLink ? ` <a href="#${ id }" class="${ haOpt.linkClass }">${ haOpt.linkContent }</a>` : ''}</${ p1 }>`;
    }
  );

  if (navHeading) {
    navHeading = `<nav class="${ haOpt.navClass }">${ navHeading }\n${ '</li></ol>'
      .repeat(clevel - 1) }\n</nav>`
      .replace(/<li>\s*<\/li>/ig, '')
      .replace(/<ol>\s*<\/ol>/ig, '');
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

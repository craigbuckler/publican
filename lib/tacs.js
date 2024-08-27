// Templating and Caching System
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

// template configuration
export const tacsConfig = {
  dir: {
    template: ''
  }
};

// global values
export const tacs = {};

// map of template files
export const templateMap = new Map();


// get and store a template file
export function templateGet(file) {

  // get template from cache
  let content = templateMap.get(file);

  if (content === undefined) {

    // get and cache file content
    content = readFileSync(file);
    templateMap.set(file, content);

  }

  return content || '';

}


// parse template with data and return string
export function templateParse(template = '', data) {

  // prevents recursive includes
  let maxIterations = 50;

  // iteratively render template
  let olen = 0;
  while (template.length !== olen) {
    olen = template.length;
    template = parser(template);
  }

  // replace render-time values
  return template.replace(/!\{/g, '${');


  // template evaluation
  function parser(str) {
    maxIterations--;
    return maxIterations > 0 ? eval('html`' + str +  '`') : '';
  }


  // tagged template literal
  function html(str, ...value) {

    let ret = '';
    str.forEach((s, i) => {

      ret += s;
      if (i < value.length && value[i] !== undefined) {

        const v = value[i];
        if (typeof v === 'object') ret += String( toArray(v).join('') );
        else ret += String( v );

      }

    });

    return ret;

  };


  // include file content
  function include(file) {

    const content = templateGet( join(tacsConfig.dir.template, file) );
    return content ? parser(content) : '';

  }


  // convert any value to an array
  function toArray(obj) {

    if (Array.isArray(obj)) return obj;
    if (obj === null || obj === undefined) return [];
    if (obj instanceof Set) return [...obj];
    if (obj instanceof Map) return Array.from(obj, ([, value]) => value);
    return [obj];

  }

}


// Express-compatible rendering function
export function templateEngine(file, data, callback) {

  setImmediate( callback, null, templateParse( templateGet(file), data ) );

}

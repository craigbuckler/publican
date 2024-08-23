// Templating and Caching System
import { join } from 'node:path';
import { readFile, readFileSync } from 'node:fs';

// template configuration
export const templateConfig = {
  dir: {
    template: ''
  }
};

// map of template files
export const templateMap = new Map();


// global values
export const tacs = {};


// parse template with data and return string
export function parseTemplate(template = '', data) {

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

    let str = '';

    if (templateMap.has(file)) {

      // get template from cache
      str = templateMap.get(file);

    }
    else {

      // get template from file and cache
      str = readFileSync( join(templateConfig.dir.template, file) );
      templateMap.set(file, str);

    }

    return str ? parser(str) : '';

  }


  // convert anything to an array
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

  readFile(file, (err, content) => callback(err, parseTemplate(content, data)) );

}

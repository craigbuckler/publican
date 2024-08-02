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


// parse template with data and return string
export function parseTemplate(template, data) {

  // prevents recursive includes
  let maxIterations = 50;

  return parser( template )
    .replace(/!\{/g, '${'); // render-time values


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
      if (i < value.length && value[i] !== undefined) ret += String( value[i] );

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

  };

}


// Express-compatible rendering
export function templateEngine(file, data, callback) {

  readFile(file, (err, content) => callback(err, parseTemplate(content, data)) );

}

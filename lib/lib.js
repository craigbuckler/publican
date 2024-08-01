// assorted library functions

// create a slug from an original filename
export function createSlug(fn) {

  fn = fn.replace(/#|!|$|^|~|\s/gi, '').toLowerCase();

  if (fn.endsWith('md')) {
    fn = fn.slice(0, -3);
    fn += (fn.endsWith('index') ? '' : '/index') + '.html';
  }

  return fn;

}


// split array into chunks
export function chunk(array, chunkSize = 1) {

  if (chunkSize <= 0) return [];

  const
    chunked = [],
    aCopy = [...array];

  while (aCopy.length) chunked.push( aCopy.splice(0, chunkSize) );
  return chunked;

}

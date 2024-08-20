import { slugify, normalize, extractFmContent, parseFrontMatter, mdHTML, minifySimple, chunk, strHash } from '../lib/lib.js';

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('lib.js/slugify function', () => {

  const pad = 20;

  [

    ['index.html'],
    ['robots.txt'],
    ['index.md', 'index.html'],
    ['root/robots.txt'],
    ['article.html', 'article/index.html'],
    ['article.md', 'article/index.html'],
    ['article/!index.html', 'article/index.html'],
    ['article/#index.md', 'article/index.html'],
    ['tag/post.md', 'tag/post/index.html'],
    ['tag/post.html', 'tag/post/index.html'],
    ['tag/post.json', 'tag/post.json'],

  ].forEach(set => {

    const
      input = set[0],
      output = set[1] || set[0];

    it(
      `slugify ${ input.padEnd(pad) } => ${ output.padEnd(pad) }`,
      () => assert.strictEqual(slugify( input ), output)
    );

  });

});


describe('lib.js/normalize function', () => {

  const pad = 18;

  [

    ['html'],
    ['JavaScript', 'javascript'],
    ['New Post!', 'new-post'],
    ['-- TAG/123 --', 'tag-123'],

  ].forEach(set => {

    const
      input = set[0],
      output = set[1] || set[0];

    it(
      `normalize ${ input.padEnd(pad) } => ${ output.padEnd(pad) }`,
      () => assert.strictEqual(normalize( input ), output)
    );

  });

});


describe('lib.js/extractFmContent function', () => {

  [

    { fm: 'title: test 1', content: '' },
    { fm: 'title: test 2', content: 'The content.' },
    { fm: 'title: test 3\ndescription: information about test 3', content: 'test 2\ncontent' },

  ].forEach((output, idx) => {

    const input = `---\n${ output.fm }\n---\n${ output.content }\n`;

    it(
      `extractFmContent test ${ idx + 1 }`,
      () => assert.deepStrictEqual(extractFmContent( input ), output)
    );

  });

});



describe('lib.js/parseFrontMatter function', () => {

  [
    { title: 'title one', value: true },
    { title: 'title two', description: '"descriptive text"', date: '2030-01-01' },
    { title: 'title three', description: 'descriptive text', tags: 'a, b, c' },

  ].forEach((output, idx) => {

    let input = '';
    for (const prop in output) {
      input += `${ prop }: ${ output[prop] === true ? '' : output[prop] }\n`;
    }

    it(
      `parseFrontMatter test ${ idx + 1 }`,
      () => assert.deepStrictEqual(parseFrontMatter( input ), output)
    );

  });

});


describe('lib.js/mdHTML function', () => {

  const markdownOptions = {
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
  };

  [

    {
      md: '## Heading 2\n\nContent\n\n### Heading 3\n\ntext 123\n\ntext abc',
      headingNav: false,
      html: '<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h3 id="heading-3" tabindex="-1">Heading 3 <a href="#heading-3" class="headlink">#</a></h3>\n<p>text 123</p>\n<p>text abc</p>'
    },

    {
      md: '## Heading 2\n\nContent\n\n## Heading 2\n\ntext 123\n\ntext abc',
      headingNav: false,
      html: '<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h2 id="heading-2-2" tabindex="-1">Heading 2 <a href="#heading-2-2" class="headlink">#</a></h2>\n<p>text 123</p>\n<p>text abc</p>'
    },

    {
      md: '## Heading 2\n\nContent\n\n### Heading 3\n\ntext 123\n\n## Heading 2\n\ntext abc',
      headingNav: true,
      html: '<nav class="contents">\n<ol><li>\n<a href="#heading-2" class="head-h2">Heading 2</a>\n<ol><li>\n<a href="#heading-3" class="head-h3">Heading 3</a>\n</li></ol>\n</li>\n<li><a href="#heading-2-2" class="head-h2">Heading 2</a>\n</li></ol></nav>\n<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h3 id="heading-3" tabindex="-1">Heading 3 <a href="#heading-3" class="headlink">#</a></h3>\n<p>text 123</p>\n<h2 id="heading-2-2" tabindex="-1">Heading 2 <a href="#heading-2-2" class="headlink">#</a></h2>\n<p>text abc</p>'
    }


  ].forEach((set, idx) => {

    it(
      `mdHTML test ${ idx + 1 }`,
      () => assert.strictEqual(minifySimple( mdHTML( set.md, markdownOptions, set.headingNav )), set.html)
    );

  });

});



describe('lib.js/chunk function', () => {

  [

    {
      in: [1, 2, 3],
      chunkSize: 3,
      out: [[1, 2, 3]]
    },
    {
      in: [1, 2, 3],
      chunkSize: 2,
      out: [[1, 2], [3]]
    },
    {
      in: [1, 2, 3, 4, 5, 6, 7],
      chunkSize: 3,
      out: [[1, 2, 3], [4, 5, 6], [7]]
    },

  ].forEach((set, idx) => {

    it(
      `chunk test ${ idx + 1 }`,
      () => assert.deepStrictEqual(chunk( set.in, set.chunkSize ), set.out)
    );

  });

});


describe('lib.js/strHash function', () => {

  [
    ['abc123', 'Abc123'],
    ['abcdefgh123', 'abcdefgh124'],
    ['<p>test string</p>', '<p>test  string</p>'],
  ].forEach((set, idx) => {

    it(
      `strHash test ${ idx + 1 }`,
      () => assert.notEqual(strHash(set[0]), strHash(set[1]))
    );

  });

});

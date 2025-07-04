import { slugify, properCase, normalize, extractFmContent, parseFrontMatter, mdHTML, navHeading, minifySimple, chunk, strReplacer, strHash } from '../lib/lib.js';

import { describe, it } from 'node:test';
import assert from 'node:assert';

const padDefault = 40;

describe('lib.js/slugify function'.padEnd( 77 ), () => {

  const pad = 30;

  [

    ['index.html'],
    ['robots.txt'],
    ['index.md', 'index.html'],
    ['root/robots.txt'],
    ['article.html', 'article/index.html'],
    ['article.md', 'article/index.html'],
    ['article/!index.html', 'article/index.html'],
    ['article/Index.html', 'article/Index/index.html'],
    ['article/#index.md', 'article/index.html'],
    ['article/an-index.md', 'article/an-index/index.html'],
    ['tag/post.md', 'tag/post/index.html'],
    ['tag/post.html', 'tag/post/index.html'],
    ['tag/post.json', 'tag/post.json'],
    ['win\\dir\\index.md', 'win/dir/index.html'],
    ['01_post/00_index.md', 'post/index.html'],
    ['01_post/02_article.md', 'post/article/index.html'],
    ['article/Index.html', 'article/Index.HTM', 'Index.HTM'],
    ['#default.html', 'default.htm', 'default.htm'],
    ['Index.html', 'Index/default.htm', 'default.htm'],
    ['css/01_#main.css', 'css/#main.css'],
    ['js\\!01_main.js', 'js/!main.js'],

  ].forEach(set => {

    const
      input = set[0],
      output = set[1] || set[0],
      indexFn = set[2] || 'index.html';

    it(
      `slugify    ${ input.padEnd(pad) } => ${ output.padEnd(pad) }`,
      () => assert.strictEqual(slugify( input, indexFn, new Map([
        [/\d{2,}_/g, ''] // removes NN_ from slug
      ]) ), output)
    );

  });

});


describe('lib.js/properCase function'.padEnd( 77 ), () => {

  const pad = 30;

  [

    ['Already valid'],
    ['directory-name', 'Directory name'],
    ['postname-', 'Postname'],
    ['-- article --', 'Article'],

  ].forEach(set => {

    const
      input = set[0],
      output = set[1] || set[0];

    it(
      `properCase ${ input.padEnd(pad) } => ${ output.padEnd(pad) }`,
      () => assert.strictEqual(properCase( input ), output)
    );

  });

});


describe('lib.js/normalize function'.padEnd( 77 ), () => {

  const pad = 30;

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
      `normalize  ${ input.padEnd(pad) } => ${ output.padEnd(pad) }`,
      () => assert.strictEqual(normalize( input ), output)
    );

  });

});


describe('lib.js/extractFmContent function'.padEnd( padDefault + 2 ), () => {

  [

    { fm: 'title: test 1', content: '' },
    { fm: 'title: test 2', content: 'The content.' },
    { fm: 'title: test 3\ndescription: information about test 3', content: 'test 2\ncontent' },

  ].forEach((output, idx) => {

    const input = `---\n${ output.fm }\n---\n${ output.content }\n`;

    it(
      `extractFmContent test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.deepStrictEqual(extractFmContent( input ), output)
    );

  });

});


describe('lib.js/parseFrontMatter function'.padEnd( padDefault + 2 ), () => {

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
      `parseFrontMatter test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.deepStrictEqual(parseFrontMatter( input ), output)
    );

  });

});


describe('lib.js/mdHTML and navHeading functions'.padEnd( padDefault + 2 ), () => {

  const
    markdownOptions = {
      core: {
        html: true,
        breaks: false,
        linkify: true,
        typographer: true
      },
      prism: {
        defaultLanguage: 'js',
        highlightInlineCode: true
      }
    },
    headingAnchorOptions = {
      nolink: 'nolink',
      linkContent: '#',
      linkClass: 'headlink',
      nomenu: 'nomenu',
      navClass: 'contents'
    };

  [

    {
      md: '## Heading 2\n\nContent\n\n### Heading 3\n\ntext 123\n\ntext abc',
      out: {
        content: '<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h3 id="heading-3" tabindex="-1">Heading 3 <a href="#heading-3" class="headlink">#</a></h3>\n<p>text 123</p>\n<p>text abc</p>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#heading-2" class="head-h2">Heading 2</a>\n<ol><li>\n<a href="#heading-3" class="head-h3">Heading 3</a>\n</li></ol></li></ol>\n</nav>'
      }
    },

    {
      md: '## Heading 2\n\nContent\n\n## Heading 2\n\ntext 123\n\ntext abc',
      out: {
        content: '<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h2 id="heading-2-2" tabindex="-1">Heading 2 <a href="#heading-2-2" class="headlink">#</a></h2>\n<p>text 123</p>\n<p>text abc</p>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#heading-2" class="head-h2">Heading 2</a></li>\n<li><a href="#heading-2-2" class="head-h2">Heading 2</a>\n</li></ol>\n</nav>'
      }
    },

    {
      md: '# Main title\n\n## Heading 2\n\nContent\n\n### Heading 3\n\ntext 123\n\n## Heading 2\n\ntext abc',
      out: {
        content: '<h1>Main title</h1>\n<h2 id="heading-2" tabindex="-1">Heading 2 <a href="#heading-2" class="headlink">#</a></h2>\n<p>Content</p>\n<h3 id="heading-3" tabindex="-1">Heading 3 <a href="#heading-3" class="headlink">#</a></h3>\n<p>text 123</p>\n<h2 id="heading-2-2" tabindex="-1">Heading 2 <a href="#heading-2-2" class="headlink">#</a></h2>\n<p>text abc</p>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#heading-2" class="head-h2">Heading 2</a>\n<ol><li>\n<a href="#heading-3" class="head-h3">Heading 3</a>\n</li></ol>\n</li>\n<li><a href="#heading-2-2" class="head-h2">Heading 2</a>\n</li></ol>\n</nav>'
      }
    },

    {
      md: '## `HTML`\n\n```html\n<h1>${ data.title }</h1>\n```\n\nInline `${ data.title }`{language=html}\n\n${ data.title }\n\n${{ data.render }}\n\n!{ data.runtime }',
      out: {
        content: '<h2 id="html" tabindex="-1"><code class="language-js"><span class="token constant">HTML</span></code> <a href="#html" class="headlink">#</a></h2>\n<pre class="language-html"><code class="language-html"><span class="token tag"><span class="token tag"><span class="token punctuation">&lt;</span>h1</span><span class="token punctuation">></span></span>&#36;{ data<span class="token punctuation">.</span>title }<span class="token tag"><span class="token tag"><span class="token punctuation">&lt;/</span>h1</span><span class="token punctuation">></span></span>\n</code></pre>\n<p>Inline <code class="language-html">&#36;{ data<span class="token punctuation">.</span>title }</code></p>\n<p>${ data.title }</p>\n<p>${ data.render }</p>\n<p>!{ data.runtime }</p>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#html" class="head-h2"><code class="language-js"><span class="token constant">HTML</span></code></a>\n</li></ol>\n</nav>'
      }
    },

    {
      md: '<h1>Main title</h1>\n<h2 id="h2a">Heading 2a</h2>\n<h3 class="nolink">Heading 3a</h3>\n<h3 class="nolink nomenu">Heading 3b</h3>\n<h2>Heading 2b</h2>\n<h3 id="h3b" tabindex="10" class="link">Heading 3b</h3>',
      out: {
        content: '<h1>Main title</h1>\n<h2 id="h2a" tabindex="-1">Heading 2a <a href="#h2a" class="headlink">#</a></h2>\n<h3 class="nolink" id="heading-3a" tabindex="-1">Heading 3a</h3>\n<h3 class="nolink nomenu">Heading 3b</h3>\n<h2 id="heading-2b" tabindex="-1">Heading 2b <a href="#heading-2b" class="headlink">#</a></h2>\n<h3 id="h3b" tabindex="10" class="link">Heading 3b <a href="#h3b" class="headlink">#</a></h3>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#h2a" class="head-h2">Heading 2a</a>\n<ol><li>\n<a href="#heading-3a" class="head-h3">Heading 3a</a></li>\n</ol>\n</li>\n<li><a href="#heading-2b" class="head-h2">Heading 2b</a>\n<ol><li>\n<a href="#h3b" class="head-h3">Heading 3b</a>\n</li></ol></li></ol>\n</nav>'
      }
    },

    {
      md: '<h2>Heading 2a</h2>\n<h3 class="nolink nomenu">Heading 3a</h3>\n<h3 class="nomenu">Heading 3b</h3>\n<h3 class="nolink">Heading 3c</h3>\n<h2 class="nomenu">Heading 2b</h2>\n<h3>Heading 3d</h3>\n<h3>Heading 3e</h3>\n<h3 class="nomenu">Heading 3f</h3>',
      out: {
        content: '<h2 id="heading-2a" tabindex="-1">Heading 2a <a href="#heading-2a" class="headlink">#</a></h2>\n<h3 class="nolink nomenu">Heading 3a</h3>\n<h3 class="nomenu" id="heading-3b" tabindex="-1">Heading 3b <a href="#heading-3b" class="headlink">#</a></h3>\n<h3 class="nolink" id="heading-3c" tabindex="-1">Heading 3c</h3>\n<h2 class="nomenu" id="heading-2b" tabindex="-1">Heading 2b <a href="#heading-2b" class="headlink">#</a></h2>\n<h3 id="heading-3d" tabindex="-1">Heading 3d <a href="#heading-3d" class="headlink">#</a></h3>\n<h3 id="heading-3e" tabindex="-1">Heading 3e <a href="#heading-3e" class="headlink">#</a></h3>\n<h3 class="nomenu" id="heading-3f" tabindex="-1">Heading 3f <a href="#heading-3f" class="headlink">#</a></h3>',
        navHeading: '<nav class="contents">\n<ol><li>\n<a href="#heading-2a" class="head-h2">Heading 2a</a>\n<ol>\n<li><a href="#heading-3c" class="head-h3">Heading 3c</a>\n</li></ol>\n</li>\n<li>\n<ol><li>\n<a href="#heading-3d" class="head-h3">Heading 3d</a></li>\n<li><a href="#heading-3e" class="head-h3">Heading 3e</a></li>\n</ol></li></ol>\n</nav>'
      }
    },

    {
      md: '<h4>Heading 0-h4</h4>\n<h2 class="nomenu">Heading 1-h2</h2>\n<h4>Heading 2-h4</h4>\n<h3>Heading 3-h3</h3>\n<h3>Heading 4-h3</h3>\n<h2>Heading 5-h2</h2>\n<h4>Heading 6-h4</h3>\n<h3>Heading 7-h3</h3>',
      out: {
        content: '<h4 id="heading-0h4" tabindex="-1">Heading 0-h4 <a href="#heading-0h4" class="headlink">#</a></h4>\n<h2 class="nomenu" id="heading-1h2" tabindex="-1">Heading 1-h2 <a href="#heading-1h2" class="headlink">#</a></h2>\n<h4 id="heading-2h4" tabindex="-1">Heading 2-h4 <a href="#heading-2h4" class="headlink">#</a></h4>\n<h3 id="heading-3h3" tabindex="-1">Heading 3-h3 <a href="#heading-3h3" class="headlink">#</a></h3>\n<h3 id="heading-4h3" tabindex="-1">Heading 4-h3 <a href="#heading-4h3" class="headlink">#</a></h3>\n<h2 id="heading-5h2" tabindex="-1">Heading 5-h2 <a href="#heading-5h2" class="headlink">#</a></h2>\n<h4 id="heading-6h4" tabindex="-1">Heading 6-h4 <a href="#heading-6h4" class="headlink">#</a></h4>\n<h3 id="heading-7h3" tabindex="-1">Heading 7-h3 <a href="#heading-7h3" class="headlink">#</a></h3>',
        navHeading: '<nav class="contents">\n<ol><li>\n<ol><li>\n<ol><li>\n<a href="#heading-0h4" class="head-h4">Heading 0-h4</a>\n</li></ol>\n</li></ol>\n</li>\n<li>\n<ol><li>\n<ol><li>\n<a href="#heading-2h4" class="head-h4">Heading 2-h4</a>\n</li></ol>\n</li>\n<li><a href="#heading-3h3" class="head-h3">Heading 3-h3</a></li>\n<li><a href="#heading-4h3" class="head-h3">Heading 4-h3</a>\n</li></ol>\n</li>\n<li><a href="#heading-5h2" class="head-h2">Heading 5-h2</a>\n<ol><li>\n<ol><li>\n<a href="#heading-6h4" class="head-h4">Heading 6-h4</a>\n</li></ol>\n</li>\n<li><a href="#heading-7h3" class="head-h3">Heading 7-h3</a>\n</li></ol></li></ol>\n</nav>'
      }
    },

  ].forEach((set, idx) => {

    const result = navHeading( mdHTML( set.md, markdownOptions ), headingAnchorOptions );
    result.content = minifySimple(result.content);
    result.navHeading = minifySimple(result.navHeading);

    it(
      `mdHTML test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.deepStrictEqual(result, set.out)
    );

  });

});


describe('lib.js/chunk function'.padEnd( padDefault + 2 ), () => {

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
      `chunk test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.deepStrictEqual(chunk( set.in, set.chunkSize ), set.out)
    );

  });

});


describe('lib.js/strReplacer function'.padEnd( padDefault + 2 ), () => {

  // replacement map
  const map = new Map([
    ['__DATE__', '01-02-2030'],
    ['__ROOT__', '/root/'],
    [/cat/ig, 'dog'],
    [/<img src="(.+?)".*?>/ig, '<a href="$1"><img src="$1" width="100" height="100" /></a>']
  ]);

  [

    {
      str: 'Today\'s date is __DATE__',
      out: 'Today\'s date is 01-02-2030'
    },
    {
      str: '<a href="__ROOT____DATE__">__DATE__</a>',
      out: '<a href="/root/01-02-2030">01-02-2030</a>'
    },
    {
      str: 'My cat is cuter than your cat on __DATE__.',
      out: 'My dog is cuter than your dog on 01-02-2030.'
    },
    {
      str: '<img src="i1.jpg">\n<img src="i2.png">\n',
      out: '<a href="i1.jpg"><img src="i1.jpg" width="100" height="100" /></a>\n<a href="i2.png"><img src="i2.png" width="100" height="100" /></a>\n'
    },

  ].forEach((set, idx) => {

    it(
      `strReplacer test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.deepStrictEqual(strReplacer( set.str, map ), set.out)
    );

  });

});


describe('lib.js/strHash function'.padEnd( padDefault + 2 ), () => {

  [
    ['abc123', 'Abc123'],
    ['abcdefgh123', 'abcdefgh124'],
    ['<p>test string</p>', '<p>test  string</p>'],
  ].forEach((set, idx) => {

    it(
      `strHash test ${ idx + 1 }`.padEnd( padDefault ),
      () => assert.notEqual(strHash(set[0]), strHash(set[1]))
    );

  });

});

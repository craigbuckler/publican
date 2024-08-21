# Publican

A tiny, simple, and very fast static site generator.

*Still very much an alpha product! Use at your peril.*

Features:

- uses lightweight ESM
- standard JavaScript backtick templating
- processes `${ expression }` at build time and `!{ expression }` at runtime so it's possible to pre-build Express.js templates

To do:

- plugins for sitemaps


## Front matter

You can add any front matter but the following values control publication:

|name|description|
|-|-|
|`date`|date of post (defaults to now if not set)|
|`publish`|date of publication or `draft` determine whether post is published|
|`priority`|post priority from 0 - 1 (most important)|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` to not index|
|`headingnav`|set `true` to define the article's table of contents|
|`tags`|comma-delimited list of tags|


## Post properties

Posts have the following properties in the `data` object:

|name|description|
|-|-|
|`filename`|original name of data file|
|`slug`|rendered file name|
|`link`|link to post|
|`directory`|top-level directory name|
|`date`|date of post|
|`publish`|false if the post is not to published|
|`priority`|post priority from 0 - 1|
|`index`|indexing frequency (daily, weekly, monthly, yearly) or `false` if not indexed|
|`tags`|array of tag objects: { tag, ref, link, slug }|


## Notes

Avoid JavaScript expressions within markdown content. Simple expressions are generally fine, e.g. `${ data.title }` but complex expressions such as `${ data.all.map(i => i.title).join() }` can be altered by the markdown processor. To work around this, you can:

1. Move the expressions into a template file.
1. Create a tacs function to simplify the expression.
1. Change the `.md` file to `.html` and edit accordingly.

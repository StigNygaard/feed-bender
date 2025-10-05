# feed-bender

*Feed-bender* is a project where I create, tweak or combine various news feeds (RSS etc.) for convenience or special purposes. Either to be served for my newsreader — or as a "preburner API" for other (future planned) projects/ideas.

My first "custom feeds" are all Canon related, including two for the [Canon Rumors](https://canonrumors.com/) site.
One feed is based on Canon Rumors' own main site RSS news feed, but filtered down to only having "essential posts" by ignoring posts in some categories.
My other custom feed for Canon Rumors, keeps track of *new threads* (topics) in the forum of the site, except it tries to ignore threads created to be a "comment-section" to one of the posts on the main-site.

Feed-bender uses [*Feedsmith* by *Maciej Lamberski*](https://github.com/macieklamberski/feedsmith) ([MIT](https://github.com/macieklamberski/feedsmith/blob/main/LICENSE) licensed) and [*domparser* by *thednp*](https://github.com/thednp/domparser) ([MIT](https://github.com/thednp/domparser/blob/master/LICENSE) licensed).

This is a *Deno Deploy project* deployed at https://feed-bender.deno.dev/. 
While source-code of _Feed-bender_ has home in a _public_ repository, it is still a "personalized" project. If you fork/copy it, please remember to remove any personal references, for example in the HTML pages.

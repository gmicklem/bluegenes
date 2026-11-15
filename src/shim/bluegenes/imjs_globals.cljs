(ns bluegenes.imjs-globals
  "Sets js/imjs, the InterMine JavaScript client. BlueGenes tools (npm packages
  loaded at run time from /tools/) use it as the default value of a parameter of
  their main function (`imjsClient = imjs`). Until October 2024 index.clj loaded it
  from cdn.intermine.org with a script tag; it is now bundled from the npm package.
  The package's `main` is a Node build (build/service); dist/im.js is its
  browser build (a browserify bundle of the same code), required by path so that
  the Node polyfills are not pulled in whatever the resolver does with the
  package's `browser` field."
  (:require ["imjs/dist/im.js" :as imjs]))

(js/goog.exportSymbol "imjs" imjs)

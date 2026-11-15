(ns cljsjs.highlight
  "Stand-in for cljsjs/highlight (npm highlight.js 11): sets js/hljs to the highlight.js core
  without languages; the cljsjs.highlight.langs.* namespaces register them."
  (:require ["highlight.js/lib/core" :as hljs]))

(js/goog.exportSymbol "hljs" hljs)

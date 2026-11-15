(ns cljsjs.highlight
  "Stand-in for cljsjs/highlight 9.12.0-2: sets js/hljs to the highlight.js core
  without languages; the cljsjs.highlight.langs.* namespaces register them."
  (:require ["highlight.js/lib/highlight" :as hljs]))

(js/goog.exportSymbol "hljs" hljs)

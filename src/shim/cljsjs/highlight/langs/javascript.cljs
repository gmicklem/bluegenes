(ns cljsjs.highlight.langs.javascript
  "Stand-in for cljsjs/highlight's langs.javascript: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/core" :as hljs]
            ["highlight.js/lib/languages/javascript" :as lang]))

(.registerLanguage hljs "javascript" lang)

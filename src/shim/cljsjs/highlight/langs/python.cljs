(ns cljsjs.highlight.langs.python
  "Stand-in for cljsjs/highlight's langs.python: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/highlight" :as hljs]
            ["highlight.js/lib/languages/python" :as lang]))

(.registerLanguage hljs "python" lang)

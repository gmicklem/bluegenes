(ns cljsjs.highlight.langs.xml
  "Stand-in for cljsjs/highlight's langs.xml: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/core" :as hljs]
            ["highlight.js/lib/languages/xml" :as lang]))

(.registerLanguage hljs "xml" lang)

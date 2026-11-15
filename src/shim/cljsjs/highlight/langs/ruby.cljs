(ns cljsjs.highlight.langs.ruby
  "Stand-in for cljsjs/highlight's langs.ruby: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/highlight" :as hljs]
            ["highlight.js/lib/languages/ruby" :as lang]))

(.registerLanguage hljs "ruby" lang)

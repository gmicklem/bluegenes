(ns cljsjs.highlight.langs.java
  "Stand-in for cljsjs/highlight's langs.java: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/core" :as hljs]
            ["highlight.js/lib/languages/java" :as lang]))

(.registerLanguage hljs "java" lang)

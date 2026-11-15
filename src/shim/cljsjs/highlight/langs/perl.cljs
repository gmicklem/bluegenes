(ns cljsjs.highlight.langs.perl
  "Stand-in for cljsjs/highlight's langs.perl: registers the language with js/hljs."
  (:require [cljsjs.highlight]
            ["highlight.js/lib/highlight" :as hljs]
            ["highlight.js/lib/languages/perl" :as lang]))

(.registerLanguage hljs "perl" lang)

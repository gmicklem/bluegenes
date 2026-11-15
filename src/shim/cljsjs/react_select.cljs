(ns cljsjs.react-select
  "Stand-in for cljsjs/react-select: sets js/Select like its UMD build did (the
  default export), with the creatable variant attached as js/Select.Creatable.
  Since react-select 3 that variant is a separate entry point,
  react-select/creatable."
  (:require ["react-select" :as rs]
            ["react-select/creatable" :as rs-creatable]))

(def ^:private select (.-default rs))

(aset select "Creatable" (.-default rs-creatable))

(doseq [k ["components" "createFilter" "mergeStyles" "defaultTheme"]]
  (aset select k (aget rs k)))

(js/goog.exportSymbol "Select" select)

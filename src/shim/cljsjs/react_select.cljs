(ns cljsjs.react-select
  "Stand-in for cljsjs/react-select 2.4.4-0: sets js/Select like its UMD build
  (the default export, with the other entry points attached as properties)."
  (:require ["react-select" :as rs]))

(def ^:private select (.-default rs))

(doseq [k ["Async" "AsyncCreatable" "Creatable" "SelectBase" "createFilter"
           "components" "mergeStyles" "defaultTheme"]]
  (aset select k (aget rs k)))

(js/goog.exportSymbol "Select" select)

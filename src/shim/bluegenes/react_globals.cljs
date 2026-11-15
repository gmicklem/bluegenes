(ns bluegenes.react-globals
  "Sets js/React and js/ReactDOM, as the cljsjs/react and cljsjs/react-dom jars did
  until the npm migration. BlueGenes tools (npm packages loaded at run time from
  /tools/, such as the protein visualizer) are built against the host page's
  window.React and window.ReactDOM, so they get the React version that BlueGenes
  itself uses (React 18). It is not a cljsjs.* name on purpose: shadow-cljs
  resolves those itself as aliases of the npm package."
  (:require ["react" :as react]
            ["react-dom" :as react-dom]))

(js/goog.exportSymbol "React" react)
(js/goog.exportSymbol "ReactDOM" react-dom)

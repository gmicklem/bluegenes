(ns cljsjs.react-transition-group
  "Stand-in for cljsjs/react-transition-group 1.2.0-0: sets
  js/ReactTransitionGroup (CSSTransitionGroup and TransitionGroup)."
  (:require ["react-transition-group" :as rtg]))

(js/goog.exportSymbol "ReactTransitionGroup" rtg)

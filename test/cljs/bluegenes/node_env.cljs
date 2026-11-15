(ns bluegenes.node-env
  "Preload for the shadow-cljs :test build (:node-test), run before any test
  namespace loads.

  Node has no DOM, but two libraries touch DOM globals as soon as they load:
  clojure.data.xml (DOMParser, XMLSerializer; bluegenes.utils parses template
  XML with it) and hickory, via markdown-to-hiccup (Node, NodeList,
  NamedNodeMap). These come from @xmldom/xmldom (an npm devDependency, only
  used here).

  Application code calls timers through js/window (e.g. the :retry effect), so
  window is node's global object.

  Tests stub the :local-store/:persist effects, but an event that a test left
  queued can still run after its stubs are removed, so there is also a
  minimal in-memory localStorage (in a browser it would hit the real one).

  serverVars and initVars are normally written into the page by
  bluegenes.index; bluegenes.route reads serverVars when it loads. Defining
  them as null makes bluegenes.config fall back to its defaults."
  (:require ["@xmldom/xmldom" :as xmldom]))

(when-not (exists? js/window)
  (set! js/window js/globalThis))

(doseq [k ["DOMParser" "XMLSerializer" "Node" "NodeList" "NamedNodeMap"]]
  (when-not (aget js/globalThis k)
    (aset js/globalThis k (aget xmldom k))))

(doseq [k ["serverVars" "initVars"]]
  (when-not (js-in k js/globalThis)
    (aset js/globalThis k nil)))

(when-not (exists? js/localStorage)
  (let [store (atom {})]
    (set! js/localStorage
          #js {:getItem (fn [k] (get @store (str k)))
               :setItem (fn [k v] (swap! store assoc (str k) (str v)) nil)
               :removeItem (fn [k] (swap! store dissoc (str k)) nil)
               :clear (fn [] (reset! store {}) nil)})))

(ns bluegenes.core
  ;; The cljsjs namespaces set JS globals that later namespaces read when they
  ;; load, so they come first (shadow-cljs.edn also lists them as entries).
  (:require [bluegenes.react-globals]
            [bluegenes.imjs-globals]
            [cljsjs.react-select]
            [reagent.dom.client :as rdc]
            [bluegenes.reagent-inputs :as reagent-inputs]
            [re-frame.core :as re-frame]
            [bluegenes.utils]
            [im-tables.core]
            [bluegenes.events]
            [bluegenes.subs]
            [bluegenes.route]
            [bluegenes.views :as views]
            [bluegenes.config]
            [bluegenes.pages.templates.core]
            [bluegenes.specs]
            [oops.core :refer [ocall]]))

;(defn dev-setup []
;  (when config/debug?
;    (devtools/install!)
;    (println "dev mode")))

;; React 18 root, created on first mount; hot reloads render into it again.
(defonce root (delay (rdc/create-root (ocall js/document "getElementById" "app"))))

(defn mount-root []
  (re-frame/clear-subscription-cache!)
  (rdc/render @root [views/main-panel])
  ;; Development mode helper code snippet
  ;; Uncomment this code to keep modals open after shadow-cljs hot reloads.
  #_(-> (js/$ "#myModalsID") ; Replace with your modal id.
        (.addClass "in")
        (.css "display" "block")))

(defn ^:export init []
  ;; Before the first render: text inputs that keep every keystroke under createRoot.
  (reagent-inputs/install!)
  (re-frame/dispatch-sync [:boot])
  ;(dev-setup)
  ; Initialize our bootstrap dropdowns
  (ocall (js/$ ".dropdown-toggle") :dropdown)
  (mount-root))

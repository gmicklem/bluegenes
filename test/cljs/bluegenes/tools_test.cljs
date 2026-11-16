(ns bluegenes.tools-test
  (:require [cljs.test :refer-macros [deftest is testing use-fixtures]]
            [bluegenes.test-utils :as utils]
            [re-frame.core :as rf]
            [day8.re-frame.test :refer-macros [run-test-sync]]
            [bluegenes.crud.tools :as crud]
            [bluegenes.components.tools.subs :as tools-subs]))

(use-fixtures :each utils/fixtures)

(def go-tool {:names {:cljs "bluegenesGoTermVisualizer"}
              :package {:name "@intermine/bluegenes-go-term-visualizer"}
              :config {:accepts ["ids"] :classes ["Gene"] :version 2}})
(def pathway-tool {:names {:cljs "bluegenesPathwayVisualizer"}
                   :package {:name "@intermine/bluegenes-pathway-visualizer"}
                   :config {:accepts ["ids"] :classes ["Gene"] :version 2}})

(def network-tool {:names {:cljs "bluegenesInteractionsNetwork"}
                   :package {:name "@intermine/bluegenes-interaction-network"}
                   :config {:accepts ["ids"] :classes ["Gene"] :depends ["Gene"] :version 2}})

(deftest add-tool-requirements
  (is (= ["go_enrichment_for_gene"]
         (get-in (crud/add-tool-requirements go-tool) [:config :widgets]))
      "The Go term visualizer is known to request go_enrichment_for_gene")
  (is (= ["Gene" "Interaction"]
         (get-in (crud/add-tool-requirements network-tool) [:config :depends]))
      "The interaction network needs the Interaction class next to what its config says")
  (is (= pathway-tool (crud/add-tool-requirements pathway-tool))
      "Other tools are left alone")
  (is (= ["own" "go_enrichment_for_gene"]
         (get-in (crud/add-tool-requirements (assoc-in go-tool [:config :widgets] ["own"]))
                 [:config :widgets]))
      "What a tool's own config lists is kept")
  (is (= 3 (count (get-in (crud/update-installed-tools {} [go-tool pathway-tool network-tool])
                          [:tools :installed])))))

(deftest mine-widget-names
  (run-test-sync
   (reset! re-frame.db/app-db {:current-mine :demo})
   (is (nil? @(rf/subscribe [::tools-subs/mine-widget-names]))
       "nil until the widgets are fetched")
   (swap! re-frame.db/app-db assoc-in [:assets :widgets :demo]
          [{:name "pathway_enrichment"} {:name "publication_enrichment"}])
   (is (= #{"pathway_enrichment" "publication_enrichment"}
          @(rf/subscribe [::tools-subs/mine-widget-names])))))

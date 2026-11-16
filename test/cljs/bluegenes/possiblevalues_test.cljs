(ns bluegenes.possiblevalues-test
  "The query builder asks the server for the possible values of an attribute
  when a constraint is added (:cache/fetch-possible-values, up to 7000 values,
  for the constraint input; :qb/fetch-possible-values, 100 values, for the
  enhanced query). It must not do so for Date and ClobAccess attributes, whose
  inputs ignore them (im-7os.60)."
  (:require [cljs.test :refer-macros [deftest is testing use-fixtures]]
            [bluegenes.test-utils :as utils]
            [re-frame.core :as rf]
            [re-frame.db :as db]
            [day8.re-frame.test :refer-macros [run-test-sync]]
            [bluegenes.events]
            [bluegenes.pages.querybuilder.events]))

(use-fixtures :each utils/fixtures)

(def model
  {:classes {:Gene {:name "Gene"
                    :attributes {:symbol {:name "symbol" :type "java.lang.String"}
                                 :created {:name "created" :type "java.util.Date"}}
                    :references {:sequence {:name "sequence" :referencedType "Sequence"}}}
             :Sequence {:name "Sequence"
                        :attributes {:residues {:name "residues" :type "org.intermine.objectstore.query.ClobAccess"}}}}})

(defn init-db! []
  (reset! db/app-db {:current-mine :demo
                     :mines {:demo {:id :demo
                                    :service {:root "http://demo" :model model}}}}))

(defn run-event
  "Dispatch `event` with the effects that call imcljs.fetch/unique-values and
  the :dispatch effect replaced by recorders. Returns a map of :requests (the
  [summary-path size] pairs that would be requested) and :dispatched (the
  events the handler asked to dispatch)."
  [event]
  (let [requests (atom [])
        dispatched (atom [])
        restore (rf/make-restore-fn)]
    (try
      (rf/reg-fx :cache/fetch-possible-values-fx
                 (fn [{:keys [summary-path]}] (swap! requests conj [summary-path 7000])))
      (rf/reg-fx :qb/pv
                 (fn [{:keys [summary-path]}] (swap! requests conj [summary-path 100])))
      (rf/reg-fx :dispatch (fn [ev] (swap! dispatched conj ev)))
      (init-db!)
      (rf/dispatch-sync event)
      (finally (restore)))
    {:requests @requests :dispatched @dispatched}))

(defn requests-for [event]
  (:requests (run-event event)))

(deftest cache-fetch-possible-values
  (run-test-sync
   (testing "a String attribute is requested, up to 7000 values"
     (is (= [["Gene.symbol" 7000]]
            (requests-for [:cache/fetch-possible-values "Gene.symbol" model []]))))
   (testing "a Date attribute sends no request and is marked as having no values"
     (is (= {:requests []
             :dispatched [[:cache/store-possible-values :demo "Gene.created" false]]}
            (run-event [:cache/fetch-possible-values "Gene.created" model []]))))
   (testing "a ClobAccess attribute sends no request"
     (is (= [] (requests-for [:cache/fetch-possible-values "Gene.sequence.residues" model []]))))
   (testing "a class sends no request"
     (is (= [] (requests-for [:cache/fetch-possible-values "Gene.sequence" model []]))))))

(deftest qb-fetch-possible-values
  (run-test-sync
   (testing "a String attribute is requested"
     (is (= [["Gene.symbol" 100]]
            (requests-for [:qb/fetch-possible-values ["Gene" "symbol"]]))))
   (testing "a Date attribute sends no request; the enhanced query is told there are no values"
     (is (= {:requests []
             :dispatched [[:qb/store-possible-values ["Gene" "created"] false]]}
            (run-event [:qb/fetch-possible-values ["Gene" "created"]]))))
   (testing "a ClobAccess attribute sends no request"
     (is (= [] (requests-for [:qb/fetch-possible-values ["Gene" "sequence" "residues"]]))))))

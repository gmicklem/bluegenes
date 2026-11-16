(ns bluegenes.widgets-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [clojure.walk :as walk]
            [bluegenes.pages.results.widgets.views :as views]))

(defn- hiccup-contains? [hiccup x]
  (let [found (atom false)]
    (walk/postwalk (fn [e] (when (= e x) (reset! found true)) e) hiccup)
    @found))

(deftest widget-empty-state
  (let [child [:div.the-chart]]
    (testing "a widget without rows shows the empty state and not the chart"
      (let [hiccup (views/widget :title "Chromosome Distribution" :type "Gene" :notAnalysed 0
                                 :values [] :child child)]
        (is (hiccup-contains? hiccup [:p.failure "No results."]))
        (is (not (hiccup-contains? hiccup child)))))
    (testing "a widget with rows shows the chart"
      (let [hiccup (views/widget :title "Chromosome Distribution" :type "Gene" :notAnalysed 0
                                 :values [{:domain "1" :type "Actual" :value 3}] :child child)]
        (is (hiccup-contains? hiccup child))
        (is (not (hiccup-contains? hiccup [:p.failure "No results."])))))))

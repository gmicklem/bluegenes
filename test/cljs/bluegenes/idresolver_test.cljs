(ns bluegenes.idresolver-test
  (:require [cljs.test :refer-macros [deftest is testing use-fixtures]]
            [bluegenes.test-utils :as utils]
            [re-frame.core :as rf]
            [day8.re-frame.test :refer-macros [run-test-sync]]
            [bluegenes.components.idresolver.events :as evts]))

(use-fixtures :each utils/fixtures)

;; The demo mine's organism had no name and no short name until im-ore.16.
(def organisms-without-names [{:taxonId "9606" :name nil :shortName nil}])
(def organisms [{:taxonId "9606" :name "Homo sapiens" :shortName "H. sapiens"}
                {:taxonId "7227" :name "Drosophila melanogaster" :shortName "D. melanogaster"}])

(defn db-with-organisms [organisms]
  {:cache {:organisms organisms}})

(deftest validate-default-organism
  (testing "the default is returned as the short name, the value the dropdown offers"
    (is (= "H. sapiens" (evts/validate-default-organism (db-with-organisms organisms) "Homo sapiens")))
    (is (= "H. sapiens" (evts/validate-default-organism (db-with-organisms organisms) "H. sapiens"))))
  (testing "a default that is not in the list gives Any, the blank value"
    (is (= "" (evts/validate-default-organism (db-with-organisms organisms) "Mus musculus")))
    (is (= "" (evts/validate-default-organism (db-with-organisms []) "Homo sapiens")))
    (is (= "" (evts/validate-default-organism {} "Homo sapiens"))))
  (testing "organisms without names are never chosen, even for a blank default"
    (is (= "" (evts/validate-default-organism (db-with-organisms organisms-without-names) "Homo sapiens")))
    (is (= "" (evts/validate-default-organism (db-with-organisms organisms-without-names) nil)))
    (is (= "" (evts/validate-default-organism (db-with-organisms organisms-without-names) "")))
    (is (= "" (evts/validate-default-organism (db-with-organisms organisms) nil)))))

(def model {:classes {:Gene {:name "Gene"
                             :references {:organism {:name "organism" :referencedType "Organism"}}}
                      :Chromosome {:name "Chromosome"
                                   :references {}}}})

(defn organism-after-type-switch [organisms]
  (reset! re-frame.db/app-db
          {:current-mine :demo
           :mines {:demo {:default-organism "Homo sapiens"}}
           :cache {:organisms organisms}
           :idresolver {:stage {:options {:type "Gene" :organism ""}}}})
  ;; a type without an organism disables the dropdown and clears the state ...
  (rf/dispatch-sync [::evts/update-type model "Chromosome"])
  (let [disabled (get-in @re-frame.db/app-db [:idresolver :stage :options])]
    (rf/dispatch-sync [::evts/update-type model "Gene"])
    [disabled (get-in @re-frame.db/app-db [:idresolver :stage :options])]))

(deftest update-type-organism-agrees-with-dropdown
  (run-test-sync
   (testing "default organism in the list: the state holds the option's value"
     (let [[disabled enabled] (organism-after-type-switch organisms)]
       (is (true? (:disable-organism? disabled)))
       (is (nil? (:organism disabled)))
       (is (false? (:disable-organism? enabled)))
       (is (= "H. sapiens" (:organism enabled)))))
   (testing "default organism missing from the list: the state is Any"
     (let [[_ enabled] (organism-after-type-switch organisms-without-names)]
       (is (= "" (:organism enabled)))))))

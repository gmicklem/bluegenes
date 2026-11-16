(ns bluegenes.idresolver-test
  (:require [cljs.test :refer-macros [deftest is testing use-fixtures]]
            [bluegenes.test-utils :as utils]
            [re-frame.core :as rf]
            [day8.re-frame.test :refer-macros [run-test-sync]]
            [cljs-time.core :as time]
            [bluegenes.events.boot :as boot]
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

(deftest default-list-name-is-unique-within-a-second
  (let [t1 (time/date-time 2026 11 16 10 20 31 120)
        t2 (time/date-time 2026 11 16 10 20 31 480)]
    (testing "the name has the type, the organism and the time to the millisecond"
      (is (= "Gene list for H. sapiens 16 Nov 2026 10:20:31.120"
             (evts/default-list-name "Gene" "H. sapiens" t1)))
      (is (= "Protein list for all organisms 16 Nov 2026 10:20:31.480"
             (evts/default-list-name "Protein" "" t2))))
    (testing "two lists saved in the same second get different names"
      (is (not= (evts/default-list-name "Gene" "H. sapiens" t1)
                (evts/default-list-name "Gene" "H. sapiens" t2))))))

(deftest save-list-failure-shows-the-mines-error
  (testing "the 400 for a name that is taken: the list name and the mine's reason"
    (is (= [:span [:strong "Failed to save list dup test: "]
            [:code "Attempting to rename a bag to a new name that already exists: dup test"]]
           (boot/save-list-failure-markup
            {:status 400
             :body {:listName "dup test"
                    :wasSuccessful false
                    :error "Attempting to rename a bag to a new name that already exists: dup test"
                    :statusCode 400}}))))
  (testing "no body from the mine: a generic reason instead of an empty message"
    (is (= [:span [:strong "Failed to save list: "]
            [:code "Please check your connection and try again later."]]
           (boot/save-list-failure-markup {:status 0 :body ""})))
    (is (= [:span [:strong "Failed to save list: "]
            [:code "Please check your connection and try again later."]]
           (boot/save-list-failure-markup nil)))))

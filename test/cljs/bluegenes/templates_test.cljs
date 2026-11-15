(ns bluegenes.templates-test
  (:require [cljs.test :refer-macros [deftest is are testing]]
            [bluegenes.pages.templates.helpers :as helpers]))

(comment
  "Use this to get current template to add more tests."
  (require '[re-frame.core :refer [subscribe]])
  (select-keys @(subscribe [:selected-template]) [:name :where]))

;; Pure string tests: nothing here contacts a mine. The templates are copies of two
;; HumanMine templates (https://www.humanmine.org/humanmine/service/templates).
(deftest web-service-url
  (let [service {:root "https://www.humanmine.org/humanmine"}]
    (are [tmpl url] (= (helpers/web-service-url service tmpl) url)
      {:name "Gene_Pathway",
       :where [{:path "Gene",
                :op "LOOKUP",
                :code "A",
                :editable true,
                :switchable false,
                :switched "LOCKED",
                :value "pparg"}
               {:path "Gene.organism.name",
                :op "=",
                :code "B",
                :editable true,
                :switchable false,
                :switched "LOCKED",
                :value "Homo sapiens"}]}
      "https://www.humanmine.org/humanmine/service/template/results?name=Gene_Pathway&constraint1=Gene&op1=LOOKUP&value1=pparg&extra1=&constraint2=Gene.organism.name&op2=eq&value2=Homo+sapiens&format=tab&size=10"
      {:name "Gene_inGWAS",
       :where [{:path "GWAS.results.associatedGenes",
                :op "LOOKUP",
                :code "D",
                :editable true,
                :switchable false,
                :switched "LOCKED",
                :value "PPARG",
                :extraValue "H. sapiens"}
               {:path "GWAS.results.pValue",
                :op "<=",
                :code "B",
                :editable true,
                :switchable true,
                :switched "ON",
                :value "1e-04"}
               {:path "GWAS.results.phenotype",
                :op "=",
                :code "C",
                :editable true,
                :switchable true,
                :switched "OFF",
                :value "*Diabetes*"}]}
      "https://www.humanmine.org/humanmine/service/template/results?name=Gene_inGWAS&constraint1=GWAS.results.associatedGenes&op1=LOOKUP&value1=PPARG&extra1=H.+sapiens&constraint2=GWAS.results.pValue&op2=le&value2=1e-04&format=tab&size=10")))

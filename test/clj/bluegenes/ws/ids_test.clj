(ns bluegenes.ws.ids-test
  (:require [clojure.test :refer [deftest is testing]]
            [bluegenes.ws.ids :as ids]))

(deftest parse-identifiers-test
  (is (= ["P37231" "HFE" "a b" "c"]
         (ids/parse-identifiers "P37231, HFE\n\"a b\" c")))
  (is (nil? (ids/parse-identifiers nil)))
  (testing "the quotes of a quoted identifier are removed, single or double"
    (is (= ["c"] (ids/parse-identifiers "'c'")))
    (is (= ["a b"] (ids/parse-identifiers "\"a b\"")))
    (is (= ["a b" "c d" "e" "f"]
           (ids/parse-identifiers "'a b', \"c d\"\ne 'f'"))))
  (testing "a single-quoted identifier may contain a double quote and the other way round"
    (is (= ["a\"b" "c'd"] (ids/parse-identifiers "'a\"b' \"c'd\"")))))

(deftest distinct-identifiers-test
  (testing "case sensitive identifiers keep their case"
    (is (= ["P37231" "p37231" "HFE"]
           (ids/distinct-identifiers ["P37231" "p37231" "HFE" "HFE"] true))))
  (testing "case insensitive identifiers are lower-cased and de-duplicated"
    (is (= ["p37231" "hfe"]
           (ids/distinct-identifiers ["P37231" "p37231" "HFE" "hfe"] false)))))

(deftest parse-request-for-ids-test
  (let [request (fn [case-sensitive]
                  {:multipart-params {"text" "P37231 p37231 HFE"
                                      "caseSensitive" case-sensitive}})]
    (testing "caseSensitive=true: UniProt accessions are not lower-cased"
      (is (= {:identifiers ["P37231" "p37231" "HFE"] :total 3}
             (ids/parse-request-for-ids (request "true")))))
    (testing "caseSensitive=false: identifiers are lower-cased"
      (is (= {:identifiers ["p37231" "hfe"] :total 2}
             (ids/parse-request-for-ids (request "false")))))
    (testing "no caseSensitive option: not case sensitive"
      (is (= {:identifiers ["p37231" "hfe"] :total 2}
             (ids/parse-request-for-ids {:multipart-params {"text" "P37231 p37231 HFE"}}))))))

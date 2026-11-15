(ns bluegenes.test-runner
  "Runs the Clojure (server side) tests: clojure -M:test-clj"
  (:require [clojure.test :as t]))

(def test-namespaces
  '[bluegenes.ws.ids-test])

(defn -main [& _]
  (apply require test-namespaces)
  (let [{:keys [fail error] :as summary} (apply t/run-tests test-namespaces)]
    (shutdown-agents)
    (System/exit (if (zero? (+ fail error)) 0 1))))

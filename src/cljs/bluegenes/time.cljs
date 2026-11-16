(ns bluegenes.time
  (:require [cljs-time.format :as time-format]
            [cljs-time.coerce :as time-coerce]))

(def query-formatter (time-format/formatter "d MMM, HH:mm"))

(defn format-query [{:keys [last-executed] :as _query}]
  (time-format/unparse query-formatter (time-coerce/from-long last-executed)))

;; Milliseconds as well: a mine refuses a second list with the same name (400), and two
;; lists saved in the same second used to get the same default name.
(def list-name-formatter (time-format/formatter "dd MMM yyyy HH:mm:ss.SSS"))

(defn format-list-date [datetime]
  (time-format/unparse list-name-formatter datetime))

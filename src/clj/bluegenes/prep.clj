(ns bluegenes.prep
  "Build-time preparation tasks, run by build.clj (`clojure -T:build assets`,
  `clojure -T:build fingerprint-css`) in a JVM with the :cljs classpath.
  Do not require this namespace and use it from the rest of the project!"
  (:require [clojure.java.io :as io]
            [taoensso.timbre :refer [error]]
            [bluegenes.utils :as utils]))

(def bluegenes-css "public/css/site.css")
(def im-tables-css "public/css/im-tables.css")

(defn resource-path [path]
  (str "resources/" path))

(defn- im-tables-less
  "less/im-tables.less of an im-tables source tree on the classpath: a git or
  :local/root dependency, which (unlike the Clojars jar) has no compiled CSS,
  as that is build output. nil when im-tables comes from a jar."
  []
  (when-let [url (io/resource "im_tables/core.cljs")]
    (when (= "file" (.getProtocol url))
      ;; <root>/src/im_tables/core.cljs -> <root>/less/im-tables.less
      (let [root (-> (io/file (.toURI url)) .getParentFile .getParentFile .getParentFile)
            less (io/file root "less" "im-tables.less")]
        (when (.exists less) less)))))

(defn copy-im-tables-css []
  (let [source-file im-tables-css
        target-file (resource-path im-tables-css)]
    ;; css dir is missing after `clojure -T:build clean`.
    (io/make-parents target-file)
    (if-let [less (and (nil? (io/resource source-file)) (im-tables-less))]
      ;; Same lessc options as im-tables' own build (clojure -T:build css there).
      (let [cmd ["npx" "lessc" "--math=always" "--quiet-deprecations" "-x" (str less) target-file]
            exit (.waitFor (.start (.inheritIO (ProcessBuilder. ^java.util.List cmd))))]
        (when-not (zero? exit)
          (throw (ex-info (str "lessc failed (exit " exit ") on " less) {:command cmd}))))
      (try
        (->> (io/resource source-file)
             (slurp)
             (spit target-file))
        (catch IllegalArgumentException _
          (error "Failed to read CSS from im-tables dependency. You are likely trying to use an older im-tables version which requires manual copying of its CSS into BlueGenes. If you don't do this now, im-tables will look weird!"))))))

(defn prepare-assets [& _]
  (copy-im-tables-css))

;; Below is called directly as they depend on files that come later in the
;; build process.
(defn fingerprint-css [& _]
  (let [fingerprint (utils/read-bundle-hash)]
    ;; Assertion can also fail if you don't include "resources" in :resource-paths.
    (assert (not= fingerprint "dev") "fingerprint-css should only be run for a production build")
    (doseq [css-file [bluegenes-css im-tables-css]]
      (let [css-file (resource-path css-file)]
        (io/copy (io/file css-file)
                 (io/file (utils/insert-filename-css css-file fingerprint)))))))


(ns build
  "tools.build tasks for BlueGenes (replaces the project.clj aliases).

    clojure -T:build clean            ; delete target/ and the compiled assets
    clojure -T:build assets           ; copy im-tables CSS from its jar (was `lein assets`)
    clojure -T:build css              ; lessc -x less/site.less -> resources/public/css/site.css
    clojure -T:build cljs             ; shadow-cljs release app (advanced), named
                                      ; app.<hash of the build inputs>.js
    clojure -T:build fingerprint-css  ; site.css -> site-<hash>.css (was `lein fingerprint-css`)
    clojure -T:build release          ; all of the above in order (was `lein build`)
    clojure -T:build uber             ; release, then target/bluegenes.jar with every
                                      ; dependency (was `lein uberjar`; add :prod true
                                      ; to bundle config/prod/config.edn)
    clojure -T:build jar              ; release, then target/bluegenes-<version>.jar + pom
                                      ; (the Clojars artifact)
    clojure -T:build install          ; jar, then install it into ~/.m2
    clojure -T:build:deploy deploy    ; jar, then deploy to Clojars (human step; needs
                                      ; CLOJARS_USERNAME and CLOJARS_PASSWORD)

  Needs node_modules (npm ci) for lessc and shadow-cljs. The release version
  shown in the UI (bluegenes.version/release) is $BLUEGENES_VERSION, else
  `git describe --always`, else \"dev\"."
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.tools.build.api :as b])
  (:import [java.nio.file Files]
           [java.security MessageDigest]))

(def lib 'org.intermine/bluegenes)
(def version "1.5.0-SNAPSHOT")
(def class-dir "target/classes")
(def jar-file (format "target/%s-%s.jar" (name lib) version))
(def uber-file "target/bluegenes.jar")

;; :user nil: the result must not depend on the builder's ~/.clojure/deps.edn.
(defn- basis
  ([] (basis nil))
  ([aliases] (b/create-basis {:project "deps.edn" :user nil :aliases aliases})))

(defn- sh!
  "Runs a command (vector of strings), printing it first (without the long
  -cp argument of a java command); throws on failure."
  [command]
  (println "+" (str/join " " (remove #(str/includes? % ".jar:") command)))
  (let [{:keys [exit]} (b/process {:command-args command})]
    (when-not (zero? exit)
      (throw (ex-info (str "Command failed (exit " exit "): " (str/join " " command)) {:exit exit})))))

(defn- run-clj!
  "Evaluates expr in a JVM with the classpath of the given deps.edn aliases."
  [aliases expr]
  (let [cmd (b/java-command {:basis (basis aliases)
                             :main 'clojure.main
                             :main-args ["-e" expr]})]
    (sh! (:command-args cmd))))

(defn- git-describe
  "The release version shown in the UI: $BLUEGENES_VERSION if set (Docker
  builds without .git), else `git describe --always`, else \"dev\"."
  []
  (if-let [v (not-empty (System/getenv "BLUEGENES_VERSION"))]
    v
    (let [{:keys [exit out]} (b/process {:command-args ["git" "describe" "--always"]
                                         :out :capture :err :ignore})]
      (if (and (zero? exit) (not (str/blank? out))) (str/trim out) "dev"))))

(defn- files-under [dir]
  (->> (file-seq (io/file dir)) (filter #(.isFile %)) (map #(.getPath %))))

(defn- bundle-hash
  "7 hex digits identifying the front end: SHA-256 over the release version
  string, every file the release JS and CSS are built from (src/cljs,
  src/shim, less, shadow-cljs.edn, deps.edn, package-lock.json) and the
  contents of every jar on the :cljs classpath (so a new SNAPSHOT counts).
  It names app.<hash>.js and site-/im-tables-<hash>.css and is the key that
  resets the state saved in users' browsers, so it must only change when
  the front end does. shadow-cljs' own :module-hash-names hashes the output,
  which is not reproducible: gensym'd symbol names (p1__50613#) inside
  quoted spec forms depend on compilation order and the cache."
  [version]
  (let [md (MessageDigest/getInstance "SHA-256")
        add! (fn [^String label ^bytes content]
               (.update md (.getBytes (str label "\n") "UTF-8"))
               (.update md content))
        files (sort (concat (mapcat files-under ["src/cljs" "src/shim" "less"])
                            ["shadow-cljs.edn" "deps.edn" "package-lock.json"]))
        jars (->> (:classpath-roots (basis [:cljs]))
                  (filter #(str/ends-with? % ".jar"))
                  (sort-by #(.getName (io/file %))))]
    (add! "version" (.getBytes ^String version "UTF-8"))
    (doseq [f files] (add! f (Files/readAllBytes (.toPath (io/file f)))))
    (doseq [j jars] (add! (.getName (io/file j)) (Files/readAllBytes (.toPath (io/file j)))))
    (subs (apply str (map #(format "%02x" (bit-and % 0xff)) (.digest md))) 0 7)))

(def ^:private compiled-dir "resources/public/js/compiled")

(defn- hash-bundle-name!
  "Renames the release app.js to app.<hash>.js and records the new name in
  manifest.edn, which bluegenes.utils reads to find the file."
  [hash]
  (let [manifest (io/file compiled-dir "manifest.edn")
        modules (edn/read-string (slurp manifest))
        out-name (str "app." hash ".js")]
    (when-not (some #(= "app.js" (:output-name %)) modules)
      (throw (ex-info "manifest.edn has no :output-name \"app.js\"" {:modules (map :output-name modules)})))
    (Files/move (.toPath (io/file compiled-dir "app.js"))
                (.toPath (io/file compiled-dir out-name))
                (make-array java.nio.file.CopyOption 0))
    (spit manifest (pr-str (mapv #(cond-> % (= "app.js" (:output-name %)) (assoc :output-name out-name))
                                 modules)))
    (println "Release bundle" (str compiled-dir "/" out-name))))

(defn- clean-release
  "Deletes the compiled assets and target/classes, keeping any jars built
  before (so `uber` and `jar` can run one after the other)."
  []
  (doseq [path [class-dir "resources/public/js/compiled" "resources/public/css"]]
    (b/delete {:path path})))

(defn clean [_]
  (clean-release)
  (b/delete {:path "target"}))

(defn assets [_]
  (run-clj! [:cljs] "(require 'bluegenes.prep) (bluegenes.prep/prepare-assets) (shutdown-agents)")
  (when-not (.exists (io/file "resources/public/css/im-tables.css"))
    (throw (ex-info "resources/public/css/im-tables.css was not created (im-tables jar without CSS?)" {}))))

(defn css [_]
  (sh! ["npx" "lessc" "--math=always" "--quiet-deprecations" "-x"
        "less/site.less" "resources/public/css/site.css"]))

(defn cljs
  "shadow-cljs release app, run in a JVM with only the :cljs classpath
  (`npx shadow-cljs` would use shadow-cljs.edn's :deps aliases, which add the
  dev tooling and the test libraries)."
  [_]
  (let [version (git-describe)
        hash (bundle-hash version)
        cmd (b/java-command {:basis (basis [:cljs])
                             :main 'clojure.main
                             :main-args ["-m" "shadow.cljs.devtools.cli" "release" "app" "--config-merge"
                                         (pr-str {:closure-defines {'bluegenes.version/release version}})]})]
    (b/delete {:path compiled-dir})
    (sh! (:command-args cmd))
    (hash-bundle-name! hash)))

(defn fingerprint-css [_]
  (run-clj! [:cljs] "(require 'bluegenes.prep) (bluegenes.prep/fingerprint-css) (shutdown-agents)"))

(defn release
  "The production front end: compiled, hashed JS and CSS under resources/public."
  [_]
  (clean-release)
  (assets nil)
  (css nil)
  (cljs nil)
  (fingerprint-css nil))

(defn- copy-runtime-files
  "Server sources, config/defaults (as config.edn at the jar root) and the
  resources/ tree including the release assets. With prod, config/prod's
  config.edn replaces the default one (was `lein with-profile prod uberjar`)."
  [dir prod]
  (b/copy-dir {:src-dirs ["src/clj" "config/defaults" "resources"]
               :target-dir dir})
  (when prod
    (when-not (.exists (io/file "config/prod/config.edn"))
      (throw (ex-info ":prod true needs config/prod/config.edn" {})))
    (b/copy-file {:src "config/prod/config.edn" :target (str dir "/config.edn")})))

(defn- compile-main
  "AOT-compiles bluegenes.core (it has :gen-class, so `java -cp ...
  bluegenes.core` and `java -jar` work) and keeps only its own classes; every
  other namespace loads from source at start-up (about 9 s instead of 5 s).
  Keeping all classes, as `lein uberjar` (:aot :all) did, is not portable:
  - classes compiled on JDK 21 fail on JDK 17 (instaparse, compiled
    transitively, then needs java.util.SequencedCollection), and rdfc2im runs
    the Clojars jar on JDK 17;
  - keeping just the bluegenes.* classes breaks too: AOT-compiled compojure
    routes embed clout.core.CompiledRoute records, a class that only exists
    once clout.core is loaded."
  [basis]
  (b/compile-clj {:basis basis
                  :ns-compile '[bluegenes.core]
                  :filter-nses '[bluegenes.core]
                  :class-dir class-dir}))

(defn uber
  "target/bluegenes.jar, run with `java -jar target/bluegenes.jar`.
  `clojure -T:build uber :prod true` bundles config/prod/config.edn instead
  of config/defaults/config.edn."
  [{:keys [prod]}]
  (release nil)
  (let [basis (basis)]
    (copy-runtime-files class-dir prod)
    (compile-main basis)
    (b/uber {:class-dir class-dir
             :uber-file uber-file
             :basis basis
             :main 'bluegenes.core})
    (println "Created" uber-file)))

(defn jar
  "The library jar published to Clojars: the server sources with an
  AOT-compiled bluegenes.core (so that `java -cp <this jar and its
  dependencies> bluegenes.core` works, as rdfc2im does), the release assets
  and a pom listing the server dependencies."
  [_]
  (release nil)
  (let [basis (basis)]
    (b/write-pom {:class-dir class-dir
                  :lib lib
                  :version version
                  :basis basis
                  :src-dirs ["src/clj"]
                  :resource-dirs ["config/defaults" "resources"]
                  :scm {:url "https://github.com/intermine/bluegenes"
                        :connection "scm:git:git://github.com/intermine/bluegenes.git"
                        :developerConnection "scm:git:ssh://git@github.com/intermine/bluegenes.git"
                        ;; a release is tagged v<version>; a SNAPSHOT never is
                        :tag (if (str/ends-with? version "-SNAPSHOT") "HEAD" (str "v" version))}
                  :pom-data [[:description "Bluegenes is a Clojure-powered user interface for InterMine, the biological data warehouse"]
                             [:url "http://www.intermine.org"]
                             [:licenses
                              [:license
                               [:name "LGPL-2.1-only"]
                               [:url "https://spdx.org/licenses/LGPL-2.1-only.html"]]]]})
    (copy-runtime-files class-dir false)
    (compile-main basis)
    (b/jar {:class-dir class-dir
            :jar-file jar-file
            :main 'bluegenes.core})
    (println "Created" jar-file)))

(defn install [_]
  (jar nil)
  (b/install {:basis (basis)
              :lib lib
              :version version
              :jar-file jar-file
              :class-dir class-dir})
  (println "Installed" (str lib " {:mvn/version \"" version "\"}") "into ~/.m2"))

(defn deploy [_]
  (jar nil)
  ((requiring-resolve 'deps-deploy.deps-deploy/deploy)
   {:installer :remote
    :artifact jar-file
    :pom-file (b/pom-path {:lib lib :class-dir class-dir})}))

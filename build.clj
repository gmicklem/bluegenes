(ns build
  "tools.build tasks for BlueGenes (replaces the project.clj aliases).

    clojure -T:build clean            ; delete target/ and the compiled assets
    clojure -T:build assets           ; copy im-tables CSS from its jar (was `lein assets`)
    clojure -T:build css              ; lessc -x less/site.less -> resources/public/css/site.css
    clojure -T:build cljs             ; shadow-cljs release app (advanced, hashed file name)
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
  shown in the UI (bluegenes.version/release) is `git describe --always`, or
  \"dev\" outside a git checkout."
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.tools.build.api :as b]))

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

(defn- git-describe []
  (let [{:keys [exit out]} (b/process {:command-args ["git" "describe" "--always"]
                                       :out :capture :err :ignore})]
    (if (and (zero? exit) (not (str/blank? out))) (str/trim out) "dev")))

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
  (let [cmd (b/java-command {:basis (basis [:cljs])
                             :main 'clojure.main
                             :main-args ["-m" "shadow.cljs.devtools.cli" "release" "app" "--config-merge"
                                         (pr-str {:closure-defines {'bluegenes.version/release (git-describe)}})]})]
    (sh! (:command-args cmd))))

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
                        :tag (str "v" version)}
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

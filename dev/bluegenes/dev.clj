(ns bluegenes.dev
  "Development entry point, replacing `lein dev`/`lein repl` (figwheel, lein-pdo
  and dev/user.clj):

    npm run dev      (= clojure -M:dev:cljs:cljs-dev -m bluegenes.dev)

  In one JVM it copies the im-tables CSS, starts the Less watcher
  (`npm run less:watch`, as a child process), starts the shadow-cljs server
  (UI on http://localhost:9630, nREPL on 8777) with a hot-reloading watch of
  the :app build, then starts BlueGenes itself on http://localhost:5000 with
  :development true (server code reloads on each request).
  With a deploy path (BLUEGENES_DEPLOY_PATH or :bluegenes-deploy-path in
  config/dev/config.edn) the dev build loads its files from under that path.
  For a ClojureScript REPL, connect to nREPL and run (shadow/repl :app)."
  (:require [bluegenes.prep :as prep]
            [config.core :refer [env]]
            [shadow.cljs.devtools.api :as shadow]
            [shadow.cljs.devtools.server :as shadow-server]))

(defn- start-less-watcher!
  "Runs `npm run less:watch` with this JVM's stdout/stderr, and stops it (with
  the node processes it spawned) when the JVM exits."
  []
  (let [process (-> (ProcessBuilder. ["npm" "run" "--silent" "less:watch"])
                    (.inheritIO)
                    (.start))]
    (.addShutdownHook (Runtime/getRuntime)
                      (Thread. (fn []
                                 (doseq [p (iterator-seq (.iterator (.descendants process)))]
                                   (.destroy p))
                                 (.destroy process))))
    process))

(defn -main [& _]
  (prep/prepare-assets)
  (start-less-watcher!)
  (shadow-server/start!)
  (shadow/watch :app (if-let [path (not-empty (:bluegenes-deploy-path env))]
                       {:config-merge [{:asset-path (str path "/js/compiled")}]}
                       {}))
  ((requiring-resolve 'bluegenes.core/-main)))

(ns bluegenes.utils
  (:require [clojure.string :as str]
            [clojure.java.io :as io]
            [clojure.edn :as edn]))

(defn read-fingerprints
  "Reads public/js/compiled/manifest.edn, which shadow-cljs writes for every
  build of :app. It is a vector with one map per module, e.g.
  [{:module-id :app :output-name \"app.1a2b3c4.js\" ...}]; a release build
  (:module-hash-names) puts the content hash in :output-name, a dev build
  writes plain \"app.js\". Returns nil when there is no readable manifest."
  []
  (try (some->> "public/js/compiled/manifest.edn"
                io/resource
                slurp
                edn/read-string)
       (catch Exception _)))

(defn get-bundle-path
  "Uses the (hashed) file name of the :app module from the manifest if
  available, and otherwise falls back to the default."
  [fingerprints]
  (or (when (sequential? fingerprints)
        (some (fn [{:keys [module-id output-name]}]
                (when (and (= module-id :app) output-name)
                  (str "/js/compiled/" output-name)))
              fingerprints))
      "/js/compiled/app.js"))

(defn parse-bundle-hash
  "Extracts the hash string from a bundle-path (app.<hash>.js), or \"dev\"
  if it has none (app.js)."
  [bundle-path]
  (or (second (re-find #"/app\.([^/]+)\.js$" bundle-path))
      "dev"))

(defn read-bundle-hash
  "Wrapper function for read-fingerprints, get-bundle-path and parse-bundle-hash."
  []
  (-> (read-fingerprints)
      (get-bundle-path)
      (parse-bundle-hash)))

(defn insert-filename-css
  "Rename a path ending with filename 'foo.css' to 'foo-<fingerprint>.css'"
  [file-path fingerprint]
  (str/replace file-path #"\.css$" (str "-" fingerprint ".css")))

(defn get-service-root [env]
  (or (not-empty (:bluegenes-backend-service-root env))
      (:bluegenes-default-service-root env)))

(defn env->mines
  "Parses env to return a vector of configured mines.
  Guarantees first mine to always be default."
  [env]
  (concat [{:root (get-service-root env)
            :name (:bluegenes-default-mine-name env)
            :namespace (:bluegenes-default-namespace env)}]
          (:bluegenes-additional-mines env)))

(defn- timeout
  [req]
  (assoc req
         :socket-timeout 3000
         :connection-timeout 3000))

(defn wrap-timeout
  "Middleware which adds a short timeout to the request."
  [client]
  (fn
    ([req]
     (client (timeout req)))
    ([req respond raise]
     (client (timeout req) respond raise))))

(defn- accept-all
  [req]
  (-> req
      (dissoc :as)
      (assoc :accept "*/*")))

(defn wrap-accept-all
  "Middleware setting the accept header in a request to allow all responses
  and disable output coercion."
  [client]
  (fn
    ([req]
     (client (accept-all req)))
    ([req respond raise]
     (client (accept-all req) respond raise))))

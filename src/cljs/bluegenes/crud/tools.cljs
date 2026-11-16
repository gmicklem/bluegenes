(ns bluegenes.crud.tools)

(defn normalize-installed-tools
  "Return a map keyed by each tool's `[:names :cljs]`."
  [tools]
  (reduce (fn [m tool]
            (assoc m (get-in tool [:names :cljs]) tool))
          {}
          tools))

(def tool-requirements
  "What installed tools need from the mine, for the tools whose config.json does
  not say so. BlueGenes only shows a tool when the mine's model has every class
  in the config's `:depends` and the mine's /service/widgets has every widget
  in its `:widgets`. These tools query a mine without checking and, when the mine
  answers 400 or 404, reject a promise nobody catches (\"No data found!\"):
  - the Go term visualizer asks for the widget go_enrichment_for_gene,
  - the interaction network queries Gene.interactions, which needs the
    Interaction class."
  {"@intermine/bluegenes-go-term-visualizer" {:widgets ["go_enrichment_for_gene"]}
   "@intermine/bluegenes-interaction-network" {:depends ["Interaction"]}})

(defn add-tool-requirements
  "Adds the `:widgets` and `:depends` a tool is known to need (see
  `tool-requirements`) to its config. What the tool's own config lists is kept."
  [tool]
  (let [requirements (get tool-requirements (get-in tool [:package :name]))]
    (cond-> tool
      requirements
      (update :config
              (fn [config]
                (reduce (fn [config [k required]]
                          (assoc config k (vec (distinct (concat (get config k) required)))))
                        config
                        requirements))))))

(defn update-installed-tools
  [db tools]
  (-> db
      (assoc-in [:tools :installed] (mapv add-tool-requirements tools))))

(ns bluegenes.components.ui.inputs
  (:require [reagent.core :as reagent]
            [oops.core :refer [oget oset!]]))

;; Why text-input exists
;;
;; Reagent wraps every <input> and <textarea> that has both :value and :on-change
;; ("controlled" inputs): it takes :value away from React and, once the next
;; render has happened (reagent.core/after-render), writes the value that was
;; rendered into the DOM node. That assumes that the render has really been done
;; when the after-render callbacks run. With React 18's createRoot (see core.cljs)
;; it has not: reagent only queues the update with forceUpdate and React renders
;; it a moment later. In between, reagent resets the node to the previous value,
;; and a key pressed in that gap lands on the old text, so letters vanish
;; ("PPARG" became "PARG", "cypress" became "cypres"). A ratom does not help,
;; since the render is late either way, and a re-frame subscription (the event
;; that sets it is dispatched asynchronously) makes the gap longer.
;;
;; text-input is not controlled in that sense: the browser owns the text while the
;; user types, so there is nothing for reagent to reset. The :value prop (from a
;; ratom or a subscription) is the initial text. When it changes later, it is
;; written into the node only if the change did not come from the user, that is,
;; if it is not the echo of text the user has typed (a Reset button, a route that
;; sets the search term and the like are such changes). That also keeps working
;; while the state is a few keystrokes behind the node. Event handlers should read
;; the text from the event target, not from the state, for the same reason.

(defn text-input
  "An <input> (or <textarea>, with :textarea? true) that shows :value without
  dropping keystrokes. Takes the props of the element: :on-change, :placeholder,
  :class and so on; :ref may be given as a function."
  [_props]
  (let [node (atom nil)
        user-ref (atom nil)
        ;; The texts the user has typed that :value has not caught up with yet.
        typed (atom [])
        ;; One function for the life of the component, so that React calls it only
        ;; when the node is mounted or unmounted, not on every render.
        ref-fn (fn [el]
                 (reset! node el)
                 (when-let [f @user-ref] (f el)))
        ->text (fn [value] (if (nil? value) "" (str value)))]
    (reagent/create-class
     {:display-name "text-input"
      :component-did-update
      (fn [this [_ old-props]]
        (let [value (->text (:value (reagent/props this)))]
          (when (not= value (->text (:value old-props)))
            (if-let [i (first (keep-indexed (fn [i text] (when (= text value) i)) @typed))]
              ;; The state is catching up with what the user typed.
              (swap! typed subvec (inc i))
              (let [el @node]
                (reset! typed [])
                (when (and el (not= (oget el :value) value))
                  (oset! el :value value)))))))
      :reagent-render
      (fn [{:keys [value textarea? on-change ref] :as props}]
        (reset! user-ref (when (fn? ref) ref))
        [(if textarea? :textarea :input)
         (-> props
             (dissoc :value :textarea?)
             (assoc :default-value (->text value)
                    :on-change (fn [e]
                                 (swap! typed #(conj (vec (take-last 100 %)) (oget e :target :value)))
                                 (when on-change (on-change e)))
                    :ref ref-fn))])})))

(defn password-input []
  (let [show-password? (reagent/atom false)]
    (fn [{:keys [value on-change on-submit container-class new-password? label disabled]}]
      [:div.form-group.toggle-show-password
       {:class container-class}
       [:label (or label "Password")]
       [text-input
        (merge {:class "form-control"
                :type (if @show-password? "text" "password")
                :value value
                :on-change on-change
                :on-key-up #(when (= 13 (oget % :keyCode))
                              (on-submit))
                :disabled disabled}
               (when new-password?
                 {:autoComplete "new-password"}))]
       (let [icon (str "icon-eye" (when @show-password? "-blocked"))]
         [:a {:role "button"
              :on-click #(swap! show-password? not)
              :title (str (if @show-password? "Hide" "Show") " password")}
          [:svg.icon {:class icon}
           [:use {:xlinkHref (str "#" icon)}]]])])))

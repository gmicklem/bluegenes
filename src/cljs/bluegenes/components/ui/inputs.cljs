(ns bluegenes.components.ui.inputs
  (:require [reagent.core :as reagent]
            [reagent.impl.input :as input]
            [oops.core :refer [oget oset!]]))

;; Text inputs are plain reagent [:input {:value .. :on-change ..}] elements;
;; bluegenes.reagent-inputs makes them keep every keystroke under React 18. The
;; state can be a keystroke behind the input, so handlers that need the current
;; text (Enter submits, say) read it from the event target.

(defn reject-input!
  "For an :on-change that ignores what was typed (a character a number field
  does not take, say): puts `text`, the text the state still has, back in the
  input of event `e`, keeping the cursor where it was relative to the end.
  Reagent did that by itself before bluegenes.reagent-inputs."
  [e text]
  (let [node (oget e :target)
        old (oget node :value)
        text (if (nil? text) "" (str text))]
    (when (not= old text)
      (if (input/has-selection-api? (oget node :type))
        (let [from-end (- (count old) (oget node :selectionStart))
              cursor (max 0 (- (count text) from-end))]
          (oset! node :value text)
          (oset! node :selectionStart cursor)
          (oset! node :selectionEnd cursor))
        (oset! node :value text)))))

(defn password-input []
  (let [show-password? (reagent/atom false)]
    (fn [{:keys [value on-change on-submit container-class new-password? label disabled]}]
      [:div.form-group.toggle-show-password
       {:class container-class}
       [:label (or label "Password")]
       [:input.form-control
        (merge {:type (if @show-password? "text" "password")
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

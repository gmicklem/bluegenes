(ns bluegenes.reagent-inputs
  "Makes reagent's controlled text inputs keep every keystroke under React 18's
  createRoot. Installed once by bluegenes.core, before the first render.

  Reagent (1.2.0; 2.0.1 has the same logic in reagent.impl.input) wraps every
  <input> and <textarea> that has both :value and :on-change: it takes :value
  away from React and writes the rendered value into the DOM node itself
  (reagent.impl.input/input-component-set-value). It does so

  - in an after-render callback queued by every keystroke, which assumes that the
    render of the new state is done when the callback runs. With createRoot it is
    not: reagent only asks React for the render (forceUpdate) and React does it a
    moment later. The callback then puts the previous text back in the node.
  - after every render of the input, which assumes that the rendered value is at
    least as new as the text in the node. When :on-change dispatches a re-frame
    event, the state lags the node by the keystrokes whose events have not been
    handled yet, so a render puts an older text back.

  A key pressed after the old text is put back and before the new one is written
  lands on the old text, so letters vanish (\"PPARG\" typed fast became \"PARG\").
  Rendering synchronously (reagent.dom/render, or react-dom/flushSync around
  reagent's render queue as reagent 2.0 does) removes the first gap but not the
  second; measured with Cypress on the demo mine, it dropped more keys in the
  query builder's constraint input, not fewer.

  The patch keeps reagent's wrapper and changes what it writes: the node is the
  truth while the user types. A rendered value that is one of the texts the user
  has typed is the state catching up and is not written; any other new rendered
  value (a Reset button, a route that sets a search term, text the state
  transformed) is written as before, with reagent's cursor handling. A render
  whose value has not changed writes nothing, so an :on-change that ignores a key
  no longer takes it back by itself: such an :on-change sets the text of the
  event target back itself (see bluegenes.components.ui.inputs/reject-input!).
  Handlers that need the current text (Enter submits, say) should read it from
  the event target, as the state may be a keystroke behind.

  reagent.impl.input is not public API. test/cljs/bluegenes/reagent_inputs_test
  checks that reagent's wrapper is still the one this was written for, so that a
  reagent upgrade that changes it fails the tests instead of the patch silently
  doing nothing."
  (:require [reagent.impl.input :as input]))

(defn- ->text [value]
  (if (nil? value) "" (str value)))

(defn remember-typed!
  "Notes text the user has typed into the input of component `this`."
  [^js this text]
  (let [typed (or (.-bgTyped this) (set! (.-bgTyped this) #js []))]
    (.push typed text)
    ;; Only the texts the state has not caught up with are needed.
    (when (> (alength typed) 100)
      (.shift typed))))

(defn echo!
  "True if `value` is a text the user has typed, that is, the state catching up
  with the input. Forgets that text and the ones typed before it."
  [^js this value]
  (let [typed (.-bgTyped this)
        i (if typed (.indexOf typed (->text value)) -1)]
    (when (>= i 0)
      (.splice typed 0 (inc i))
      true)))

(defn- forget-typed! [^js this]
  (some-> (.-bgTyped this) (.splice 0)))

(defn handle-change
  "Replaces reagent.impl.input/input-handle-change: notes the text and calls
  :on-change, without queueing reagent's after-render reset."
  [^js this on-change e]
  (let [target (.-target e)
        text (.-value target)]
    (set! (.-cljsDOMValue this) text)
    (remember-typed! this text)
    (on-change e)
    ;; :on-change may have put the text back (bluegenes.components.ui.inputs/reject-input!).
    (let [after (.-value target)]
      (when (not= after text)
        (set! (.-cljsDOMValue this) after)
        (remember-typed! this after)))))

(defn did-mount
  "Added to reagent's wrapper: the value of the first render."
  [^js this]
  (set! (.-bgRenderedValue this) (.-cljsRenderedValue this)))

(defn did-update
  "Replaces reagent.impl.input/input-component-set-value after a render."
  [^js this]
  (when (.-cljsInputLive this)
    (let [rendered (.-cljsRenderedValue this)]
      (when (not= rendered (.-bgRenderedValue this))
        (set! (.-bgRenderedValue this) rendered)
        (when-not (echo! this rendered)
          (forget-typed! this)
          (when (not= (->text rendered) (.-cljsDOMValue this))
            (input/input-node-set-value (.-inputEl this) rendered (.-cljsDOMValue this) this {})))))))

(defn reagent-wrapper-unchanged?
  "True if reagent's input wrapper is the one this namespace was written for."
  []
  (and (= input/input-component-set-value (:component-did-update input/input-spec))
       (nil? (:component-did-mount input/input-spec))
       (fn? input/input-handle-change)
       (fn? input/input-node-set-value)))

(defn install!
  "Patches reagent's input wrapper. Must run before the first input is rendered:
  reagent makes the wrapper class from input-spec on first use and keeps it."
  []
  (set! input/input-handle-change handle-change)
  (set! input/input-spec (assoc input/input-spec
                                :component-did-mount did-mount
                                :component-did-update did-update)))

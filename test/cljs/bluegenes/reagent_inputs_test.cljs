(ns bluegenes.reagent-inputs-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [bluegenes.reagent-inputs :as ri]))

(deftest reagent-wrapper-is-the-patched-one
  ;; If this fails after a reagent upgrade, reagent.impl.input has changed: check
  ;; that bluegenes.reagent-inputs still fits it before changing this test.
  (is (ri/reagent-wrapper-unchanged?)))

;; A stand-in for reagent's wrapper component and its DOM node, with the fields
;; reagent.impl.input sets (cljsInputLive, cljsRenderedValue, inputEl), and the
;; node as the focused element, as when the user types into it.
(defn- wrapper [value]
  (let [node #js {:value value :type "text" :selectionStart 0 :selectionEnd 0}
        this #js {:cljsInputLive true :cljsRenderedValue value :cljsDOMValue value
                  :inputEl node}]
    (ri/did-mount this)
    this))

(defn- type! [^js this text & [on-change]]
  (let [node (.-inputEl this)]
    (set! (.-value node) text)
    (ri/handle-change this (or on-change identity) #js {:target node})))

(defn- render! [^js this value]
  (set! (.-cljsRenderedValue this) value)
  (ri/did-update this))

(defn- node-value [^js this]
  (.. this -inputEl -value))

(deftest keeps-every-keystroke
  ;; Node has no document; reagent's cursor handling asks it for the focused element.
  (let [had-document? (js-in "document" js/globalThis)
        saved (aget js/globalThis "document")]
    (try
      (let [this (wrapper "")]
        (aset js/globalThis "document" #js {:activeElement (.-inputEl this)})
        (testing "renders of a state that lags the input do not put old text back"
          (type! this "P")
          (type! this "PP")
          (render! this "P")
          (is (= "PP" (node-value this)))
          (type! this "PPA")
          (render! this "PP")
          (render! this "PPA")
          (is (= "PPA" (node-value this))))
        (testing "a render that changes nothing writes nothing"
          (type! this "PPAR")
          (render! this "PPA")
          (is (= "PPAR" (node-value this))))
        (testing "a value the user did not type is written (a Reset, say)"
          (render! this "")
          (is (= "" (node-value this)))
          (type! this "x")
          (render! this "X")
          (is (= "X" (node-value this))))
        (testing "numbers in the state match the text typed"
          (type! this "5")
          (type! this "50")
          (render! this 5)
          (is (= "50" (node-value this)))
          (render! this 50)
          (is (= "50" (node-value this))))
        (testing "an :on-change that puts the text back"
          (type! this "50a" (fn [e] (set! (.. e -target -value) "50")))
          (is (= "50" (node-value this)))
          (is (= "50" (.-cljsDOMValue this)))))
      (finally
        (if had-document?
          (aset js/globalThis "document" saved)
          (js-delete js/globalThis "document"))))))

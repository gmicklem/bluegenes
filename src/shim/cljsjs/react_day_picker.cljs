(ns cljsjs.react-day-picker
  "Stand-in for cljsjs/react-day-picker 7.3.0-1: sets js/DayPicker like its UMD
  build (DayPicker, with DayPickerInput attached as DayPicker.Input)."
  (:require ["react-day-picker" :as rdp]
            ["react-day-picker/DayPickerInput" :as rdpi]))

(def ^:private day-picker (.-default rdp))

(aset day-picker "Input" (.-default rdpi))

(js/goog.exportSymbol "DayPicker" day-picker)

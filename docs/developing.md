## Tools

BlueGenes tools are npm packages (for example `@intermine/bluegenes-protein-visualizer`) that bluegenes-tool-store installs under `BLUEGENES_TOOL_PATH` and that the report page loads at run time from `/tools/`. They are built against page globals, so BlueGenes sets `window.React`, `window.ReactDOM` (`src/shim/bluegenes/react_globals.cljs`) and `window.imjs` (`src/shim/bluegenes/imjs_globals.cljs`), both loaded first by the `:app` module. Tools therefore get the React version that BlueGenes itself uses, currently React 18, and have to work with it (`ReactDOM.render` still works in React 18 but warns; prefer `ReactDOM.createRoot`). `window.imjs` is the InterMine JavaScript client, [imjs](https://github.com/intermine/imjs) 4.0.0 from npm (its browser build `dist/im.js`); tools use it as the default of a parameter of `main` (`imjsClient = imjs`). It used to be loaded from the InterMine CDN with a script tag, which was removed in October 2024 without a replacement, so every tool that relied on it failed with `ReferenceError: imjs is not defined` until it was bundled again. `window.ReactDOMServer` is not set, and jQuery (`window.$`) still comes from a script tag in `src/clj/bluegenes/index.clj`. `script/ci/bluegenes-runbundle.js` fails the build check if `React`, `ReactDOM` or `imjs` is missing from the compiled bundle, and the `@external` report page Cypress test checks that some tool draws something (a tool that throws leaves its container empty; `run-script!` catches the error).

imjs 4.0.0 depends on the unmaintained `xmldom` 0.1, which has critical advisories but is only used by imjs's Node build, never by `dist/im.js`. `package.json` therefore declares `xmldom` as an alias of `@xmldom/xmldom` and overrides imjs's dependency with it (`"$xmldom"`), so `npm audit --omit=dev` stays clean. npm 9.2 (Debian's package) cannot read that override ("Invalid comparator"); use the npm that ships with Node 22 (npm 10).

## Styling

BlueGenes uses the [Less](http://lesscss.org/) CSS preprocessor, along with [Bootstrap 3](https://getbootstrap.com/docs/3.3/) and a fork of [Bootstrap Material Design](https://github.com/intermine/bootstrap-material-design). We recommend referencing existing markup and the following resources.

- https://cdn.rawgit.com/mdbootstrap/bootstrap-material-design/gh-pages-v3/index.html
- https://cdn.rawgit.com/mdbootstrap/bootstrap-material-design/gh-pages-v3/bootstrap-elements.html
- https://getbootstrap.com/docs/3.3/css/
- https://getbootstrap.com/docs/3.3/javascript/

## Writing ClojureScript unit tests

The unit tests live in `test/cljs` (namespaces ending in `-test`) and run under node: `npm run test:unit` (see [building.md](building.md#unit-tests)). There is no DOM: `bluegenes.node-env` (a preload of the `:test` build) supplies `window`, `localStorage`, `DOMParser`/`XMLSerializer` and DOM node types (from `@xmldom/xmldom`), and sets `serverVars`/`initVars` to null. A test that needs more of the browser should stub it there or with `with-redefs`.

### re-frame.test macros

There are some things you need to pay extra attention to when writing ClojureScript unit tests for re-frame. Firstly, you'd want to wrap the body of a `deftest` with one of the following:

- `run-test-sync`: Use this when you wish to `dispatch` events sequentially, and do not need to wait for a chain of events to finish.
- `run-test-async`: This is so you can use `wait-for` to block until specific event handlers are run. Make sure you're using `dispatch-sync` instead of the regular async dispatch.

The two macros above also make sure to revert any effects, coeffects, event handlers, etc. that are registered inside their body, to keep re-frame clean for the next unit test to run.

### Redefs and stubs

The `(with-redefs <bindings> ...)` form is invaluable for stubbing arbitrary functions. Most of the time, you'll be using this for `imcljs.fetch`. Note that this only applies to variables inside the calling scope of `with-redefs` (i.e. it won't apply to an event handler dispatched by an event handler you dispatched; it only applies to the first in the chain).

If you need to stub a variable that isn't in your calling scope, you'll need to resort to `set!`.

    (let [orig-fn fetch/session]
      (set! fetch/session (stub-fetch-fn "anon-token"))
      (swap! stubbed-variables conj #(set! fetch/session orig-fn)))

This should do the trick but could cause problems depending on the asynchronicity of your code. (We'd love to wrap this inside a utility function or macro but haven't been successful due to how `set!` works in JavaScript.)

### Documenting assertions

To improve documentation, put your `is` assertions (which optionally take a message as their second argument) inside the body of `(testing "message" ...)` forms. Calls to `testing` may be nested, and all of the strings will be joined together with spaces in the final report.

### Resources

- https://github.com/Day8/re-frame-test
- https://juxt.pro/blog/posts/cljs-apps.html
- https://clojurescript.org/tools/testing
- https://clojure.github.io/clojure/clojure.test-api.html

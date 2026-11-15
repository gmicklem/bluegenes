// Cypress 13 configuration (migrated from cypress.json and plugins/index.js).
//
// Everything that depends on the environment can be overridden without editing
// this file:
//   CYPRESS_BASE_URL       BlueGenes under test (default http://localhost:5000)
//   CYPRESS_MINE_URL       InterMine webapp the BlueGenes instance uses as its
//                          default mine; its web service is MINE_URL/service
//                          (default http://localhost:9999/biotestmine)
//   CYPRESS_MINE_NAMESPACE BlueGenes namespace of that mine, the first path
//                          segment of BlueGenes routes such as /<ns>/search
//                          (default: the last path segment of MINE_URL)
//   CYPRESS_MINE_NAME      mine name BlueGenes shows, e.g. "Login to <name>": the
//                          mine's project.title web property (default BioTestMine)
//   CYPRESS_EXTERNAL       set to true to also run the tests tagged @external
//                          (itExternal in support/mine.js), which need live
//                          FlyMine next to the default mine (default false)
//   CYPRESS_EXTERNAL_ONLY  with CYPRESS_EXTERNAL=true, run only those tests of
//                          the spec files you select (default false)
// The same keys can be passed as `npx cypress run --env MINE_URL=...`.
// See docs/building.md, section "Cypress integration tests".
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "5mvk44",
  reporter: "junit",
  reporterOptions: {
    // one file per spec; Cypress 10+ runs each spec separately
    mochaFile: "cypress/results/output-[hash].xml",
    toConsole: true,
  },
  defaultCommandTimeout: 30000,
  retries: {
    runMode: 2,
    openMode: 2,
  },
  env: {
    MINE_URL: "http://localhost:9999/biotestmine",
    MINE_NAME: "BioTestMine",
    EXTERNAL: false,
  },
  e2e: {
    baseUrl: "http://localhost:5000",
    // The specs keep their pre-Cypress-10 location and names.
    specPattern: ["cypress/integration/**/*.js", "cypress/e2e/**/*.cy.js"],
    supportFile: "cypress/support/e2e.js",
    // Cypress 12+ clears the page, cookies and storage before every test.
    // These specs were written for Cypress 6, where state carried over from
    // one `it` to the next (a login in one test used by the next), so keep the
    // old behaviour until each spec is made independent.
    testIsolation: false,
    setupNodeEvents(on, config) {
      const env = config.env;
      env.MINE_URL = String(env.MINE_URL).replace(/\/+$/, "");
      if (!env.MINE_NAMESPACE) {
        env.MINE_NAMESPACE = new URL(env.MINE_URL).pathname
          .split("/")
          .filter(Boolean)
          .pop();
      }
      env.EXTERNAL = env.EXTERNAL === true || env.EXTERNAL === "true";
      on("task", {
        // Used by the `before` hook in support/e2e.js. Resolves (never
        // rejects) so the spec can fail with its own message.
        async checkMine(url) {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            const body = (await res.text()).trim();
            if (res.ok && /^\d+$/.test(body)) {
              return { ok: true, version: body };
            }
            return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 80)}` };
          } catch (e) {
            const cause = e.cause && (e.cause.code || e.cause.message);
            return { ok: false, error: cause ? `${e.message} (${cause})` : e.message };
          }
        },
      });
      return config;
    },
  },
});

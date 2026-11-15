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
//   CYPRESS_MINE_NAME      mine name BlueGenes shows, e.g. "Login to <name>"
//                          (default BioTestMine)
//   CYPRESS_EXTERNAL       set to true to also run the tests tagged @external,
//                          which need live FlyMine (default false)
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
      return config;
    },
  },
});

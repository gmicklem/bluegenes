// Cypress 13 configuration (migrated from cypress.json and plugins/index.js).
//
// Everything that depends on the environment can be overridden without editing
// this file:
//   CYPRESS_BASE_URL       BlueGenes under test (default http://localhost:5000)
//   CYPRESS_MINE_URL       InterMine webapp the BlueGenes instance uses as its
//                          default mine; its web service is MINE_URL/service
//                          (default http://localhost:8090/humanmine, the rdfc2im demo mine)
//   CYPRESS_MINE_NAMESPACE BlueGenes namespace of that mine, the first path
//                          segment of BlueGenes routes such as /<ns>/search
//                          (default: the last path segment of MINE_URL)
//   CYPRESS_MINE_NAME      mine name BlueGenes shows, e.g. "Login to <name>": the
//                          mine's project.title web property (default
//                          "rdfc2im: 114 gene food/drug-metabolism panel", the title of
//                          the demo mine)
//   CYPRESS_EXTERNAL       set to true to also run the tests tagged @external
//                          (itExternal in support/mine.js), which need live
//                          FlyMine next to the default mine (default false)
//   CYPRESS_EXTERNAL_ONLY  with CYPRESS_EXTERNAL=true, run only those tests of
//                          the spec files you select (default false)
//   CYPRESS_ADMIN_USER     user name and password of a superuser of the mine
//   CYPRESS_ADMIN_PASSWORD (its superuser.account in the mine's properties); the
//                          specs that need an admin account are skipped when unset
// The same keys can be passed as `npx cypress run --env MINE_URL=...`.
// See docs/building.md, section "Cypress integration tests".
const { defineConfig } = require("cypress");

// Test accounts: the specs that need a logged-in user ask for a fresh account on the mine
// under test (task createTestAccount), so no seeded user is needed. The accounts are
// deregistered when the run ends (after:run), which also deletes their lists, tags and
// saved queries. A run that is killed leaves its accounts behind: they are called
// cypress-<run id>-<label>@example.org, so they are easy to recognise.
const RUN_ID = Date.now().toString(36);
const TEST_PASSWORD = "cypress-test-password";
const accounts = [];

// InterMine web service call; resolves to {status, json, text}, never rejects.
async function webService(mineUrl, method, path, { auth, token, form } = {}) {
  const headers = {};
  if (auth) headers.Authorization = "Basic " + Buffer.from(auth).toString("base64");
  if (token) headers.Authorization = "Token " + token;
  let body;
  if (form) {
    body = new URLSearchParams(form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  try {
    const res = await fetch(`${mineUrl}/service/${path}`, {
      method, headers, body, signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* the export of a deleted user is XML */ }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e) };
  }
}

// Deletes the lists of a user. InterMine cannot deregister a user who owns a list that has
// no description: the export of the user profile (InterMineBagBinding.marshal) throws a
// NullPointerException and the mine answers "500 Service failed". Lists made through the
// upload page have no description, so they are deleted first.
async function deleteLists(mineUrl, token) {
  const lists = await webService(mineUrl, "GET", "lists", { token });
  for (const list of (lists.json && lists.json.lists) || []) {
    await webService(mineUrl, "DELETE", `lists?name=${encodeURIComponent(list.name)}`, { token });
  }
}

// Deletes a user and everything the user owns (InterMine "deregistration": a short-lived
// token from POST user/deregistration, then DELETE user).
async function deleteAccount(mineUrl, { username, password }) {
  const auth = `${username}:${password}`;
  const t = await webService(mineUrl, "GET", "user/token", { auth });
  const token = t.json && t.json.token;
  if (!token) return false;
  await deleteLists(mineUrl, token);
  const d = await webService(mineUrl, "POST", "user/deregistration", { token, form: { validity: "300" } });
  const uuid = d.json && d.json.token && d.json.token.uuid;
  if (!uuid) return false;
  const res = await webService(mineUrl, "DELETE", `user?deregistrationToken=${uuid}&format=xml`, { token });
  return res.status === 200;
}

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
    // The rdfc2im demo mine (HumanMine's model, 114 genes). MINE_NAMESPACE, the route
    // prefix BlueGenes uses for it, comes from the last path segment: "humanmine".
    MINE_URL: "http://localhost:8090/humanmine",
    MINE_NAME: "rdfc2im: 114 gene food/drug-metabolism panel",
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
      on("after:run", async () => {
        for (const account of accounts.splice(0)) {
          const ok = await deleteAccount(env.MINE_URL, account);
          console.log(`test account ${account.username}: ${ok ? "deleted" : "could NOT be deleted"}`);
        }
      });
      on("task", {
        // Registers a new account on the mine and returns {username, password}; it is
        // deleted at the end of the run. `label` tells the specs' accounts apart.
        async createTestAccount(label) {
          const username = `cypress-${RUN_ID}-${label}-${accounts.length}@example.org`;
          const res = await webService(env.MINE_URL, "POST", "users", {
            form: { name: username, password: TEST_PASSWORD },
          });
          if (res.status !== 200) {
            throw new Error(`could not register ${username} on ${env.MINE_URL}: HTTP ${res.status} ${res.text.slice(0, 200)}`);
          }
          const account = { username, password: TEST_PASSWORD };
          accounts.push(account);
          return account;
        },
        // Deletes the lists of an account (see deleteLists), for the test that deletes
        // an account through the BlueGenes profile page. Resolves to true.
        async deleteAccountLists({ username, password }) {
          const t = await webService(env.MINE_URL, "GET", "user/token", { auth: `${username}:${password}` });
          if (t.json && t.json.token) await deleteLists(env.MINE_URL, t.json.token);
          return true;
        },
        // For accounts a spec registers through the BlueGenes UI (the account deleted
        // by its own test is simply not found). Resolves to true when deleted.
        async deleteAccount(account) {
          const ok = await deleteAccount(env.MINE_URL, account);
          const i = accounts.findIndex((a) => a.username === account.username);
          if (i >= 0) accounts.splice(i, 1);
          return ok;
        },
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

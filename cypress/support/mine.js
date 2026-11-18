// The mine under test, from the env keys set in cypress.config.js
// (MINE_URL, MINE_NAMESPACE, MINE_NAME). Specs and commands use these instead
// of hard-coding Biotestmine.

// InterMine webapp root, e.g. http://localhost:8090/humanmine
export const mineUrl = () => Cypress.env("MINE_URL");

// Full URL of a web service endpoint, for cy.intercept and cy.request,
// e.g. mineService("query/results")
export const mineService = (path) => `${mineUrl()}/service/${path}`;

// BlueGenes route of the default mine, e.g. minePage("/search") -> /humanmine/search
export const minePage = (path = "") => `/${Cypress.env("MINE_NAMESPACE")}${path}`;

// Name BlueGenes shows for the mine ("Login to rdfc2im: 114 gene food/drug-metabolism panel")
export const mineName = () => Cypress.env("MINE_NAME");

// A test that needs a second, live mine next to the default one: FlyMine, because
// these tests are about switching between mines (BlueGenes started with FlyMine in
// BLUEGENES_ADDITIONAL_MINES, plus internet access). The default mine for them is the
// public HumanMine or the local demo mine. Its title gets an "@external" tag, and it
// is skipped unless EXTERNAL=true (CYPRESS_EXTERNAL). With EXTERNAL_ONLY=true as well,
// only the @external tests of the spec files run (Mocha's it.only), which is the way to
// run them against a public mine without the other tests of those files.
export const itExternal = (title, fn) => {
  const only = String(Cypress.env("EXTERNAL_ONLY")) === "true";
  return (Cypress.env("EXTERNAL") ? (only ? it.only : it) : it.skip)(`${title} @external`, fn);
};

// Specs that need a superuser of the mine (the home page notice, the report page
// layout, tagging lists im:public) use describeAdmin, which skips the whole block,
// with the reason in its title, unless CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASSWORD
// are set (the superuser.account of the mine's properties and its password).
export const adminCredentials = () => {
  const username = Cypress.env("ADMIN_USER");
  const password = Cypress.env("ADMIN_PASSWORD");
  return username && password ? { username, password } : null;
};

export const describeAdmin = (title, fn) =>
  adminCredentials()
    ? describe(title, fn)
    : describe.skip(`${title} (skipped: needs CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASSWORD)`, fn);

// A fresh account on the mine for the whole spec file: registered through the web
// service before the spec starts, deleted (with its lists) when the run ends. Call
// it inside a describe; the credentials are then testAccount() and
// cy.loginToTestAccount() logs in with them.
export const useTestAccount = (label) =>
  before(function () {
    cy.task("createTestAccount", label).then((account) => {
      Cypress.env("TEST_ACCOUNT", account);
    });
  });

export const testAccount = () => Cypress.env("TEST_ACCOUNT");

// Skips the running test (call it with `this` from a function(){} test or hook) when the mine
// has no objects of the given class: a capability check against the mine's own data, so the
// same specs run unchanged against a mine that has them. Pass a reason for the skip.
export const requireMineData = (ctx, className, reason) =>
  cy
    .request({
      url: mineService("query/results"),
      qs: { query: `<query model="genomic" view="${className}.id"></query>`, format: "count" },
      failOnStatusCode: false, // a model without the class answers with an error
    })
    .then(({ status, body }) => {
      if (status !== 200 || Number(body) === 0) {
        cy.log(`skipped: the mine has no ${className} objects (${reason})`);
        ctx.skip();
      }
    });

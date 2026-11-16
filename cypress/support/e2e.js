// ***********************************************************
// This support file (support/e2e.js since Cypress 10) is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';
import { mineService } from './mine';

// Specs that need no mine (matched against Cypress.spec.relative).
const NO_MINE_SPECS = /(^|\/)smoke_[^/]*$/;

// Fail fast, with a readable message, when the mine under test does not
// answer: otherwise every test in the suite times out one element at a time.
// Runs once per spec file; a failing `before` skips the rest of that spec.
before(function () {
  if (NO_MINE_SPECS.test(Cypress.spec.relative)) {
    return;
  }
  const url = mineService("version");
  cy.task("checkMine", url, { log: false }).then((result) => {
    if (!result.ok) {
      throw new Error(
        `The mine under test is not reachable: GET ${url} -> ${result.error}. ` +
          `Start the mine (and a BlueGenes at ${Cypress.config("baseUrl")} that uses it), ` +
          `or point the suite at a running one with CYPRESS_MINE_URL=<webapp root> ` +
          `(see docs/building.md, "Cypress integration tests").`
      );
    }
    cy.log(`mine ${Cypress.env("MINE_URL")}: web service version ${result.version}`);
  });
});

// Cypress 6 cleared cookies and local storage before every test but kept the
// page; Cypress 12+ with testIsolation: true would also blank the page, and
// with testIsolation: false (set in cypress.config.js) clears nothing. These
// two calls restore the Cypress 6 behaviour the specs were written for:
// BlueGenes keeps the login in local storage, so without them a user
// registered or logged in by one test is still logged in in the next.
beforeEach(function () {
  cy.clearAllCookies();
  cy.clearAllLocalStorage();
});

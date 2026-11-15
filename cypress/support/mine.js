// The mine under test, from the env keys set in cypress.config.js
// (MINE_URL, MINE_NAMESPACE, MINE_NAME). Specs and commands use these instead
// of hard-coding Biotestmine.

// InterMine webapp root, e.g. http://localhost:9999/biotestmine
export const mineUrl = () => Cypress.env("MINE_URL");

// Full URL of a web service endpoint, for cy.intercept and cy.request,
// e.g. mineService("query/results")
export const mineService = (path) => `${mineUrl()}/service/${path}`;

// BlueGenes route of the default mine, e.g. minePage("/search") -> /biotestmine/search
export const minePage = (path = "") => `/${Cypress.env("MINE_NAMESPACE")}${path}`;

// Name BlueGenes shows for the mine ("Login to BioTestMine")
export const mineName = () => Cypress.env("MINE_NAME");

// Smoke test of the Cypress runtime and configuration: needs only a BlueGenes
// server at baseUrl, not a mine (the mine connectivity check in
// support/e2e.js is skipped for this spec). It checks that the server-rendered
// page shell arrives and that the configured mine settings reach the browser.
describe("Cypress runtime smoke test (no mine needed)", function () {
  it("loads the BlueGenes page shell from baseUrl", function () {
    // The app itself may fail to boot here (no mine, or blocked CDN scripts);
    // that is not what this spec tests.
    cy.on("uncaught:exception", () => false);
    cy.request("/version").its("status").should("eq", 200);
    cy.visit("/");
    cy.title().should("contain", "BlueGenes");
    cy.get("#app").should("exist");
    cy.window().its("serverVars").should("be.a", "string").and("contain", "bluegenes-default-service-root");
  });

  it("resolves the mine settings", function () {
    expect(Cypress.env("MINE_URL")).to.match(/^https?:\/\/[^/]+\/.+[^/]$/);
    expect(Cypress.env("MINE_NAMESPACE")).to.be.a("string").and.not.be.empty;
    expect(Cypress.env("EXTERNAL")).to.be.a("boolean");
  });
});

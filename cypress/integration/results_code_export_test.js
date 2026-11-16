import { minePage, mineUrl } from "../support/mine";

// im-28e.11: the results table's "Generate Code" (im-tables, JavaScript with Include HTML) used to
// load im-tables from cdn.intermine.org, a host that no longer exists. It now points at the
// im-tables 2.x bundle the mine's own webapp serves under <mine>/vendor/js/intermine/im-tables.
const IM_TABLES_VENDOR = "/vendor/js/intermine/im-tables/2.2.0-beta";

describe("Results table code export", function () {
  it("generates JavaScript with HTML that loads im-tables from the mine, not cdn.intermine.org", () => {
    cy.visit(minePage("/querybuilder"));
    cy.get(".model-browser-root").within(() => {
      cy.selectFromDropdown("Gene");
      cy.get("select").should("have.value", "Gene");
      cy.contains("Add summary").click();
    });
    cy.contains("button", "Show All").click();
    cy.url().should("include", "/results");
    cy.contains("Showing 1 to");
    cy.get(".im-table").trigger("mouseover"); // im-tables renders static HTML until hovered

    // The code generator's split button: pick JavaScript from its language menu
    cy.get(".im-table .btn-group").filter(":has(> button > .fa-code)").within(() => {
      cy.get("button.dropdown-toggle").click();
      cy.contains("li a", "JavaScript").click();
    });
    cy.get(".im-modal").should("be.visible").within(() => {
      cy.contains("h3", "Generate Code");
      cy.contains("label", "Include HTML").find("input[type=checkbox]").check({ force: true });
      cy.get("pre").invoke("text").should("include", mineUrl() + IM_TABLES_VENDOR);
      cy.get("pre").invoke("text").should("not.include", "cdn.intermine.org");
      // the HTML is what Include HTML adds: a page that loads the bundle with a script tag
      cy.get("pre").invoke("text").should("match", /<script[^>]*src="[^"]*im-tables/);
    });
  });
});

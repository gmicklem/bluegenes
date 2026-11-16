import { minePage } from "../support/mine";

// Regression test for decision 0007 (im-7os.35): text inputs keep every keystroke at
// Cypress's default typing speed. Reagent's controlled <input> and <textarea> dropped
// keys under React 18's createRoot ("PPARG" arrived as "PARG") until
// src/cljs/bluegenes/reagent_inputs.cljs patched reagent's input wrapper. Each test types
// 40 keys, REPS times, into one of 8 inputs of the different kinds BlueGenes has (reagent
// ratom, re-frame controlled, the text-input control, the search typeahead, the query
// builder's textarea and constraint input, and im-tables' export file name), waits for
// the renders to settle, and requires the input to hold exactly the text typed: a lost
// key, an extra one, or an older text put back by a late render fails the test.
const TEXT = "abcdefghijklmnopqrstuvwxyz0123456789ABCD"; // 40 keys
const REPS = Number(Cypress.env("KEYSTROKE_REPS") || 5);

// Types TEXT into the input REPS times (cy.clear first) and checks its value each time.
function typesEveryKey(getEl) {
  for (let r = 0; r < REPS; r++) {
    getEl().clear().type(TEXT);
    cy.wait(400);
    getEl().should("have.value", TEXT);
  }
}

describe("Keystrokes: every typed key arrives in the text inputs", function () {
  it("home page feedback email and textarea (reagent ratom, controlled)", () => {
    cy.visit(minePage(""));
    typesEveryKey(() => cy.get(".feedback input[type=email]"));
    typesEveryKey(() => cy.get("textarea#feedbackform"));
  });

  it("lists keyword filter (controlled)", () => {
    cy.visit(minePage("/lists"));
    typesEveryKey(() => cy.get("#lists-keyword-filter"));
  });

  it("templates text filter (text-input control)", () => {
    cy.visit(minePage("/templates"));
    typesEveryKey(() => cy.get("#template-text-filter"));
  });

  it("query builder XML textarea (controlled)", () => {
    cy.visit(minePage("/querybuilder"));
    cy.get(".query-view-column").within(() => {
      cy.contains("Import from XML").click();
    });
    typesEveryKey(() => cy.get(".query-view-column textarea.form-control"));
  });

  it("query builder constraint input (controlled)", () => {
    cy.visit(minePage("/querybuilder"));
    cy.get(".model-browser-root").within(() => {
      cy.selectFromDropdown("Gene");
      cy.get("select").should("have.value", "Gene");
      cy.contains("Add summary").click();
    });
    cy.get(".query-view-column").within(() => {
      cy.contains("Primary Identifier").parentsUntil(".lab qb-class").children(".icon.icon-filter").click();
      cy.get("select").last().select("Contains");
    });
    typesEveryKey(() => cy.get(".query-view-column input.form-control").first());
  });

  it("im-tables export file name (re-frame, controlled, im-tables)", () => {
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
    cy.contains("button", "Export").click();
    typesEveryKey(() => cy.get(".exporttable-body input.form-control").first());
  });

  it("search typeahead (text-input control)", () => {
    cy.visit(minePage("/templates"));
    typesEveryKey(() => cy.get(".typeahead-search"));
  });
});

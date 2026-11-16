import { requireMineData } from "../support/mine";

describe("UI Test", function() {
  beforeEach(function() {
    cy.visit("/");
  });

  it("Upload page resolved IDs as expected", function() {
    cy.intercept("POST", /\/service\/ids(\?|$)/).as("uploadData");
    cy.contains("Upload").click();
    cy.url().should("include", "/upload/input");
    cy.contains("Show example").click();
    cy.get("button")
      .contains("Continue")
      .click();
    cy.url().should("include", "/upload/save");
    cy.wait("@uploadData").its("response.statusCode").should("eq", 200);
  });

  it("Templates execute and show results", function() {
    cy.get("#bluegenes-main-nav").within(() => {
      cy.contains("Templates").click();
    });
    cy.url().should("include", "/templates");
    cy.get("div[class=template-list]").first().within(() => {
      cy.get(":nth-child(n) > .col")
        .its("length")
        .should("be.gt", 0);
    });
  });

  it("Templates allow you to select lists and type in identifiers", function() {
    cy.intercept("POST", /\/service\/query\/results\/tablerows(\?|$)/).as("getData");
    cy.get("#bluegenes-main-nav").within(() => {
      cy.contains("Templates").click();
    });
    cy.url().should("include", "/templates");
    cy.get("div[class=template-list]").first().within(() => {
      cy.get(":nth-child(n) > .col")
        .its("length")
        .should("be.gt", 0);
    });
    // a template whose first constraint is an organism (an operator dropdown), not a gene lookup
    cy.get("#All_Proteins_In_Organism_To_Publications")
      .find("button")
      .contains("View >>")
      .click({ force: true });
    cy.wait("@getData").its("response.statusCode").should("eq", 200);
    cy.get(".template-constraint-container:nth-child(1) select.constraint-chooser")
      .select("!=");
  });

  it("Gives suggestion results when typing in search", function() {
    cy.get(".home .search").within(() => {
      cy.get("input[class=typeahead-search]").type("mal*");
      cy.get(".quicksearch-result").its('length').should("be.gt", 0);
    });
  });

  it("Opens the search page to show search results", function() {
    cy.get(".home .search").within(() => {
      cy.get("input[class=typeahead-search]").type("mal*{enter}");
    });
    cy.url().should("include", "/search");

    cy.get(".results").within(() => {
      cy.get(".result").should("have.length.of.at.least", 10)
    });
  });

  // TODO: Uncomment this when webservice supports updating description when not logged in.
  // it("Saves the list from an upload, updates the description and deletes it", function() {
  //   // Upload list

  //   var listName = "Automated CI test list ".concat(Number(new Date()));

  //   cy.contains("Upload").click();
  //   cy.contains("Show example").click();
  //   cy.get("textarea").type(",ABRA,GBP,RIF,SERA,OAT,PCNA");
  //   cy.get("button")
  //     .contains("Continue")
  //     .click();
  //   cy.get(".save-list input")
  //     .clear()
  //     .type(listName);

  //   cy.server();
  //   cy.route("POST", "*/service/query/tolist").as("tolist");

  //   cy.get("button")
  //     .contains("Save List")
  //     .click();

  //   cy.wait(1000);
  //   cy.wait("@tolist");

  //   // Add description to list

  //   cy.contains("Add description").click();
  //   cy.get("textarea").type("My description");
  //   cy.get(".controls button")
  //     .contains("Save")
  //     .click();
  //   // Update description to list
  //   cy.contains("Edit description").click();
  //   cy.get("textarea").type(" new");
  //   cy.get(".controls button")
  //     .contains("Save")
  //     .click();
  //   cy.get(".description").contains("My description new");

  //   // Delete list

  //   cy.contains("Data") .click();
  //   cy.contains(listName);
  //   cy.contains(listName).parent().within(() => {
  //     cy.get("input[type=checkbox]").check();
  //   });

  //   cy.route("DELETE", "*/service/lists*").as("deletelist");

  //   cy.contains("Delete").click();

  //   cy.wait(1000);
  //   cy.wait("@deletelist");

  //   cy.contains(listName).should("not.exist");
  // });

  it("Perform a region search using existing example", function() {
    requireMineData(this, "Location", "the region search needs features with chromosome locations");
    cy.intercept("POST", /\/service\/query\/results(\?|$)/).as("getData");
    cy.contains("Regions").click();
    cy.contains("Show Example").click();
    cy.get(".region-text > .form-control").should("not.be.empty");
    cy.get("button")
      .contains("Search")
      .click();
    cy.wait("@getData").its("response.statusCode").should("eq", 200);
    cy.get(".results-body .single-feature")
      .its('length')
      .should("be.gt", 0);
  });

  it("Successfully clears invalid anonymous token using dialog", function() {
    cy.intercept("POST", /\/service\/query\/results(\?|$)/).as("queryOrganisms");

    cy.wait(1000);
    // This request is run when Bluegenes has finished loading.
    cy.wait("@queryOrganisms")

    cy.window().then(win => {
      win.bluegenes.events.scrambleTokens();
    });

    cy.intercept("GET", /\/service\/search\?/).as("getSearch");

    cy.get(".home .search").within(() => {
      cy.get("input[class=typeahead-search]").type("gene{enter}");
    });

    cy.wait("@getSearch").its("response.statusCode").should("eq", 401);

    cy.intercept("GET", /\/service\/session\?/).as("getSession");

    cy.contains("Refresh").click();

    cy.wait(1000);
    cy.wait("@getSession");

    cy.intercept("GET", /\/service\/search\?/).as("getSecondSearch");

    cy.contains("Home").click();
    cy.get(".home .search").within(() => {
      cy.get("input[class=typeahead-search]").clear().type("gene{enter}");
    });

    cy.wait("@getSecondSearch").its("response.statusCode").should("eq", 200);
  });
});

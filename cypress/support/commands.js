// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
import { adminCredentials, mineName, minePage, mineService, testAccount } from './mine';

// Picks (or creates) an option of the index-th react-select (a combobox input) inside the
// current subject or `within`. The specs used the generated class names of react-select
// (".css-1hwfws3"), which change with every react-select version.
Cypress.Commands.add("reactSelect", (index, text) => {
    cy.get('input[role="combobox"]').eq(index).click({ force: true }).type(`${text}{enter}`, { delay: 50, force: true });
})

// Compares `actual` (the text of a file the app exported) with cypress/fixtures/<fixture>.
// With CYPRESS_RECORD_FIXTURES=true the fixture is written from `actual` instead, which is
// how the expected exports are recorded again for another mine (docs/building.md).
Cypress.Commands.add("expectFixture", (fixture, actual) => {
    if (String(Cypress.env("RECORD_FIXTURES")) === "true") {
        cy.writeFile("cypress/fixtures/" + fixture, actual);
    } else {
        cy.readFile("cypress/fixtures/" + fixture).should("eq", actual);
    }
})

Cypress.Commands.add("openLoginDialogue", () => {
    cy.visit(minePage());
    cy.get('.dropdown-toggle').should("exist").contains('Login').click();
})

Cypress.Commands.add("openRegisterDialogue", () => {
    cy.visit(minePage());
    cy.get('.dropdown-toggle').contains('Login').click();
    cy.get('a.btn-block').contains('Create new account').click();
})

Cypress.Commands.add("openListsTab", () => {
    cy.get("#bluegenes-main-nav").within(() => {
        cy.contains("Lists").click();
    });
})

Cypress.Commands.add("searchKeyword", (keyword) => {
    cy.visit(minePage("/search"));
    cy.get(".searchform > input").clear().type(keyword.replace(/\{enter\}$/, "") + "{enter}");
})

Cypress.Commands.add("selectFromDropdown", (keyword) => {
    cy.get('select').then($option => {$option.val(keyword)}).parent().trigger('change');
})

// listName is optional: BlueGenes names the list "Gene list for all organisms <date and time to
// the second>", so two lists saved within one second need names of their own (the mine refuses
// the second one with a 400).
Cypress.Commands.add("createGeneList", (geneList, listName) => {
    cy.contains("Upload").click();
    cy.get(".wizard textarea").type(geneList);
    cy.contains("Continue").click();
    //Assertion
    cy.get('.title').should("exist");
    cy.url().should("include","/save");
    if (listName) {
        cy.get(".save-list > label > input").clear().type(listName);
    }
    cy.contains("Save List").click();
    cy.url().should("include","/results")
    cy.contains("Lists").click();
})

Cypress.Commands.add("createProteinList", (proteinList) => {
    cy.contains("Upload").click();
    cy.contains("List type").parent().find("select").select("Protein");
    // Choosing a list type makes BlueGenes use the mine's default organism ("Homo sapiens"),
    // which the demo mine's organism list does not contain (its Organism has no name), while
    // the dropdown shows "Any". Selecting the shown option fires no change event, so trigger
    // one to make the state agree with what is shown.
    cy.get(".select-organism-and-list-type").find("select").eq(1).select("Any").trigger("change");
    cy.get(".wizard textarea").type(proteinList);
    cy.contains("Continue").click();
    cy.contains("Save List").click();
    cy.url().should("include","/results")
    cy.contains("Lists").click();
})

//The commands isInViewport and isNotInViewport are taken directly from
//https://github.com/cypress-io/cypress/issues/877#issuecomment-490504922.

Cypress.Commands.add('isInViewport', element => {
    cy.get(element).then($el => {
      const bottom = Cypress.$($el[0].ownerDocument.defaultView).height() // was cy.state('window'), an internal API
      const rect = $el[0].getBoundingClientRect()
  
      expect(rect.top).not.to.be.greaterThan(bottom)
      expect(rect.bottom).not.to.be.greaterThan(bottom)
      expect(rect.top).not.to.be.greaterThan(bottom)
      expect(rect.bottom).not.to.be.greaterThan(bottom)
    })
  })

  Cypress.Commands.add('isNotInViewport', element => {
    cy.get(element).then($el => {
      const bottom = Cypress.$($el[0].ownerDocument.defaultView).height() // was cy.state('window'), an internal API
      const rect = $el[0].getBoundingClientRect()
  
      expect(rect.top).to.be.greaterThan(bottom)
      expect(rect.bottom).to.be.greaterThan(bottom)
      expect(rect.top).to.be.greaterThan(bottom)
      expect(rect.bottom).to.be.greaterThan(bottom)
    })
  })

  // Logs in through the BlueGenes login dialogue and checks that the user name shows.
  Cypress.Commands.add('loginToUserAccount', (email,password) => {
    cy.openLoginDialogue();
		cy.get(".login-form").should("contain", "Login to " + mineName());
		cy.get("input#email").type(email);
		cy.get("input[type='password']").type(password);
    cy.intercept('POST', '/api/auth/login').as('login');
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();
    cy.wait('@login');
    cy.get(".logon.dropdown.success").should("exist").click();
    cy.get(".logon.dropdown.success").should("contain", email); //flaky
  })

  // The account registered for this spec file by useTestAccount().
  Cypress.Commands.add('loginToTestAccount', () => {
    const { username, password } = testAccount();
    cy.loginToUserAccount(username, password);
  })

  // The superuser given by CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASSWORD.
  Cypress.Commands.add('loginToAdminAccount', () => {
    const { username, password } = adminCredentials();
    cy.loginToUserAccount(username, password);
  })

  Cypress.Commands.add('createListFromFile', (filePath,listName) => {
    cy.contains("Upload").click();
    cy.contains("File Upload").click();
    cy.contains("Browse").click();
    // attachFile (cypress-file-upload) took a fixtures-relative path and ignored
    // visibility; selectFile wants a project-relative path and force for a hidden input
    cy.get('input[type="file"]').selectFile("cypress/fixtures/" + filePath, { force: true });
    cy.intercept("POST","/api/ids/parse").as("listParse");
    cy.contains("Continue").click();
    cy.wait("@listParse");
    cy.get('.title').should("exist");
    cy.url().should("include","/save");
    // the input is prefilled with a default name
    cy.get(".save-list > label > input").clear().type(listName);
    // register the intercept before the click that causes the request
    cy.intercept("POST",mineService("query/results")).as("resultsLoad");
    cy.contains("Save List").click();
    cy.url().should("include","/results");
    cy.wait("@resultsLoad");
  })

// Cypress.Commands.add("openTemplatesTab", () => {
//     cy.get("#bluegenes-main-nav").within(() => {
//         cy.contains("Templates").click();
//     });
// })

// Cypress.Commands.add("openRegionsTab", () => {
//     cy.get("#bluegenes-main-nav").within(() => {
//         cy.contains("Regions").click();
//     });
// })

// Cypress.Commands.add("openQueryBuilderTab", () => {
//     cy.get("#bluegenes-main-nav").within(() => {
//         cy.contains("Query Builder").click();
//     });
// })

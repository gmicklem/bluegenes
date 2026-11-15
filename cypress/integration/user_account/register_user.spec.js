import { testAccount, useTestAccount } from "../../support/mine";

// A user name that has not been registered on the mine before.
function getDummyEmail() {
  return "cypress-register-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "@example.org";
}

// The accounts the tests register through the UI, deleted again in the after hook.
const registered = [];

describe(__filename, function () {

  // a fresh account to test that user names are unique
  useTestAccount("register");

  after(function () {
    registered.forEach((username) => {
      cy.task("deleteAccount", { username, password: "test_password" });
    });
  });

  it("it ensures a new user is registered successfully", () => {
    cy.openRegisterDialogue();
    const username = getDummyEmail();
    registered.push(username);
    cy.typeSlowly("input#email", username);
    cy.typeSlowly("input[type='password']", "test_password");
    cy.get("button").contains("Register").click();

    cy.get(".logon.dropdown").click();
    cy.get(".logon.dropdown").should('to.contain', username);
  });

  it("it ensures that email is always required", () => {
    cy.openRegisterDialogue();
    cy.typeSlowly("input[type='password']", "test_password");
    cy.get("button").contains("Register").click();

    cy.get(".error-box")
    .should('to.contain', "missing parameters. name and password required"); 
  });

  it("it ensures that password is always required", () => {
    cy.openRegisterDialogue();
    const username = getDummyEmail();
    cy.typeSlowly("input#email", username);
    cy.get("button").contains("Register").click();

    cy.get(".error-box")
    .should('to.contain', "missing parameters. name and password required"); 
  });

  it("it ensures that user email is always unique", () => {
    cy.openRegisterDialogue();
    cy.typeSlowly("input#email", testAccount().username);
    cy.typeSlowly("input[type='password']", "test_password");
    cy.get("button").contains("Register").click();

    cy.get(".error-box")
    .should('to.contain', "There is already a user with that name"); 
  });

});

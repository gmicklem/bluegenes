import { mineName, minePage, mineService } from "../../support/mine";
import { GENES_A, PROTEINS } from "../../support/data";

// The account the tests create through the UI, use, and delete in the last test. It is
// unique per run, because the mine keeps accounts between runs.
const username = "cypress-useraccount-" + Date.now().toString(36) + "@example.org";
let password = "password";

describe("User Account Test", function() {
    beforeEach(function() {
      cy.visit(minePage());
    });

    // when a test failed before "can delete an account", do not leave the account behind
    after(function() {
      cy.task("deleteAccount", { username, password });
    });

    it("can create a new user account", function(){
        cy.openRegisterDialogue();
        cy.get(".login-form").should("exist");
        cy.get("input#email").type(username);
		cy.get("input[type='password']").type(password);
        cy.intercept('POST', '/api/auth/register').as('register');
        cy.get("button").contains("Register").click();
        cy.wait("@register");
        cy.get(".logon.dropdown.success").should("exist").click();
        cy.get(".logon.dropdown.success").should("contain", username);
    })

    it("can set user preferences", function(){
        cy.loginToUserAccount(username,password);
        cy.intercept('GET', mineService("user/preferences*")).as('getPreferences');
        cy.visit(minePage("/profile"));
        cy.wait('@getPreferences');
        cy.get('.profile-page > ').eq(0).as("userPreferences").within(() => {
            cy.get('[type="checkbox"]').first().uncheck({force:true}); //still flaky
            cy.contains("Save changes").should("not.be.disabled").click(); 
            cy.get(".success").should("have.text","Updated preferences have been saved.");
            cy.get('[type="checkbox"]').first().should("not.be.checked");
        })
    })

    it("can generate API access key", function(){
        cy.loginToUserAccount(username,password);
        cy.visit(minePage("/profile"));
        cy.get('.profile-page > ').eq(1).as("generateAPI").within(() => {
            cy.contains("Generate a new API key").click();
            cy.get(".success").should("include.text","New API key successfully generated.");
        })
    })

    it("can add tags to list", function(){
        cy.loginToUserAccount(username,password);
        cy.createGeneList(GENES_A);
        cy.contains("Lists").click();
        cy.url().should("include","/lists");
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.get(".lists-item").first().within(() => {
            cy.get("button").find('svg[class="icon icon-list-more"]')
            .should("be.visible")
            .click();

            cy.get("button").find('svg[class="icon icon-list-edit"]')
            .should("be.visible")
            .first()
            .click();
        });

        cy.get(".modal-body").within(()=>{
            cy.contains("Tags").parent().find("input").type("Algae genes{enter}",{delay:100});
        })
        cy.get('.modal-footer').within(()=>{
            cy.contains("Save").click();
        })
        cy.get(".lists-table").within(()=>{
            cy.get(".tag").should("contain","Algae genes");
        })
    })

    it("can add lists to folders", function(){
        cy.loginToUserAccount(username,password);
        cy.contains("Lists").click();
        cy.url().should("include","/lists");
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.get('.lists-headers').within(() => {
            cy.get('[type="checkbox"]').check();
        })
        cy.get('.bottom-controls').within(() => {
            cy.contains("Move all").click();
        })
        cy.reactSelect(0, "List of common genes");
        cy.get(".modal-footer").within(() => {
            cy.contains("Move list(s)").click();
        })
        cy.get('.list-title').should("contain","List of common genes");
    })

    it("can filter lists by tags", function(){
        cy.loginToUserAccount(username,password);
        cy.createProteinList(PROTEINS);
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.contains("Tags").parent().find(".icon-selection").click();
        cy.get(".dropdown").find("li").filter(':contains("Algae genes")').click();
        cy.get('.lists-item').should('have.length',1);
        cy.get('.lists-item').find(".list-title").should("include.text","List of common genes");
    })

    it("can build and save a query", function(){
        cy.loginToUserAccount(username,password);
        cy.visit(minePage("/querybuilder"));
        cy.get(".model-browser-root").within(() => {
            cy.selectFromDropdown("Protein");        
            cy.contains("Add summary").click();
          });
    
          cy.get("div.panel-body").first().as("queryEditorTab").within(()=>{
            cy.contains("Save Query").click();
            cy.get("div.input-group").type("Protein summary", {delay:100});
            cy.contains("Save Query").click();
          });
          cy.visit(minePage("/querybuilder"));
          cy.get("div.panel-body").last().as("savedQueriesTab").within(()=>{
            cy.contains("Saved Queries").click();
            cy.get('table').contains('td','Protein summary');
          });
    })

    

    it("can change user password", function(){
        cy.loginToUserAccount(username,password)
        cy.visit(minePage("/profile"));
        cy.get('.profile-page > ').eq(2).as("changePassword").within(() => {
            cy.contains("Old password").siblings(".form-control").type("password", {delay:50}).should("have.value", "password");
            cy.contains("New password").siblings(".form-control").type("newpassword", {delay:50}).should("have.value", "newpassword");
            cy.intercept("POST",mineService("user")).as("waitPasswordChange");
            cy.get("button").contains("Save password").click();
            cy.wait("@waitPasswordChange");
            // cy.wait(500); //change?
            cy.get(".success").should("include.text","Password changed successfully.")
        })
        cy.then(() => { password = "newpassword"; });
        
    })

    it("can delete an account", function(){
        // InterMine cannot delete an account that owns lists without a description (500),
        // and the lists made by the earlier tests have none: delete them first.
        cy.task("deleteAccountLists", { username, password });
        cy.loginToUserAccount(username,password)
        cy.visit(minePage("/profile"));
        cy.get(".settings-group").eq(3).as("deleteAccountSection").within(() => {
            cy.contains("Start account deletion").click();
            cy.get("code").then(($code) => {
                const deletionCode = $code.text();
                cy.get("input").type(deletionCode);
            })
            cy.intercept({ method: "DELETE", url: /\/service\/user(\?|$)/ }).as("deleteAccount");
            cy.get("button").contains("Delete account").click();
            cy.wait("@deleteAccount").its("response.statusCode").should("eq", 200);
        })
        // BlueGenes logs the user out once the mine has deleted the account
        cy.get(".logon.dropdown.warning").should("exist");
        cy.openLoginDialogue();
        cy.get(".login-form").should("contain", "Login to " + mineName());
        cy.get("input#email").type(username);
        cy.get("input[type='password']").type(password);
        cy.intercept('POST', '/api/auth/login').as('login');
        cy.get(".login-form")
          .find("button")
          .contains('Login')
          .click();
        cy.wait('@login');
        cy.get(".error-box")
          .should('to.contain', 'Unknown username: ' + username);
    })
});

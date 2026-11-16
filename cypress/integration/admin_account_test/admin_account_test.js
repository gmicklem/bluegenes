import { describeAdmin, mineName, minePage, mineService } from "../../support/mine";

// needs a superuser: CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASSWORD
describeAdmin("Admin Account Test", function(){
    beforeEach(function(){
        cy.loginToAdminAccount();
    });

    it("can set user preferences in profile page",function(){
        cy.intercept('GET', mineService("user/preferences*")).as('getPreferences');
        cy.visit(minePage("/profile"));
        cy.wait('@getPreferences');
        cy.get('.profile-page > ').first().should("exist").within(() => {
            // The page replaces its inputs with the saved preferences when the response is
            // handled, which is after the request has finished; the inputs are disabled
            // until then.
            cy.get('[type="checkbox"]').first().should("be.enabled").uncheck({force:true});
            // cy.get('[type="checkbox"]').first().should("not.be.checked"); //flaky
            cy.contains("Public name").type("{selectall}Admin{enter}",{delay:100});
            cy.contains("Save changes").should("not.be.disabled").click(); //flaky {force:true} needed?
            cy.get(".success").should("have.text","Updated preferences have been saved.");
        })
    })

    after(function(){
        // restore the preferences changed by the first test
        cy.intercept('GET', mineService("user/preferences*")).as('getPreferences');
        cy.visit(minePage("/profile"));
        cy.wait('@getPreferences');
        cy.get('.profile-page > ').first().should("exist").within(() => {
            // the page shows the saved preferences once it has them; edit only then, or
            // they replace the edit
            cy.get('[id="input:alias"]').should("have.value", "Admin");
            cy.get('[type="checkbox"]').first().check({force:true}); //flaky
            cy.get('[type="checkbox"]').first().should("be.checked"); 
            cy.contains("Public name").type("{selectall}{backspace}",{delay:100});
            cy.contains("Save changes").should("not.be.disabled").click(); //flaky {force:true}?
            cy.get(".success").should("have.text","Updated preferences have been saved.");
        })
    })

    it("can set and clear homepage notice",function(){
        cy.visit(minePage("/admin")); //direct use of cy.visit can be flaky sometimes
        cy.get(".admin-page .nav").contains('Home').click();
        cy.contains("Set homepage notice").parent().as("setHomepageNotice");

        cy.get("@setHomepageNotice").within(() => {
            cy.get("textarea").type("A new list has been added!{enter}",{delay:100});
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to notice text.");
        })

        cy.visit(minePage());
        cy.get(".text-center").first().should("have.text",mineName());
        cy.contains("A new list has been added!");

        cy.visit(minePage("/admin"));
        cy.get(".admin-page .nav").contains('Home').click();
        cy.get("@setHomepageNotice").within(() => {
            cy.contains("Clear notice").click();
            cy.get(".success").should("include.text","Successfully saved changes to notice text.");
        })
    })

    it("can update installed tools",function(){
        cy.visit(minePage("/tools"));
        cy.contains("Update installed tools").click();
        cy.get(".alert").should("include.text","A tool operation is in progress...");
    })

    it("can generate API access key",function(){
        cy.visit(minePage("/profile"));
        cy.get('.profile-page > ').eq(1).within(() => {
            cy.contains("Generate a new API key").click();
            cy.get(".success").should("include.text","New API key successfully generated.");
        })
    })
})

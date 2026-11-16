import { adminCredentials, describeAdmin, mineService, useTestAccount } from "../../support/mine";
import { GENES_A } from "../../support/data";

// The tests of this describe build on each other: the lists made by one are used by the
// next. They run in a fresh account that is deleted at the end of the run.
describe("Account list test", function() {
    useTestAccount("lists");

    beforeEach(function() {
        cy.loginToTestAccount();
    });

    it("can add tags to a list",function(){
        cy.createGeneList(GENES_A);
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
            cy.contains("Tags").parent().find("input").type("Major genes{enter}");
        })
        cy.get('.modal-footer').within(()=>{
            cy.contains("Save").click();
        })
        cy.get(".lists-table").within(()=>{
            cy.get(".tag").should("contain","Major genes");
        })
    })

    it("can filter lists by tags", function(){
        cy.contains("Lists").click();
        cy.url().should("include","/lists");
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.get('.lists-headers').within(() => {
            cy.contains("Tags").siblings(".dropdown").click();
            cy.get("li").contains("Major genes").click();
        })
        cy.get('.lists-item').its("length").should('eq',1);
    })

    it("can move list(s) to folder",function(){
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

    it("can copy list(s) to folder", function(){
        cy.contains("Lists").click();
        cy.url().should("include","/lists");
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.get('.lists-headers').within(() => {
            cy.get('[type="checkbox"]').check();
        })
        cy.get('.bottom-controls').within(() => {
            cy.contains("Copy all").click();
        })
        cy.reactSelect(0, "List 2");
        cy.get(".modal-footer").within(() => {
            cy.contains("Copy list(s)").click();
        })
        cy.get('.list-title').should("contain","List 2");
    })

    it("can create subfolders and view folder contents", function(){
        cy.contains("Lists").click();
        cy.url().should("include","/lists");
        cy.get('.lists-item').its("length").should('be.gt',0);

        cy.get('.lists-headers').within(() => {
            cy.get('[type="checkbox"]').check();
        })
        cy.get('.bottom-controls').within(() => {
            cy.contains("Move all").click();
        })
        cy.reactSelect(0, "List 3");
        cy.reactSelect(0, "Subfolder 1"); // the same select, now for the next level of the folder path
        cy.intercept("POST",mineService("list/tags")).as("listLoad");
        cy.get(".modal-footer").within(() => {
            cy.contains("Move list(s)").click();
        })
        cy.wait("@listLoad");

        cy.get('.list-title').should("contain","List 3");
        cy.get('.icon-expand-folder').eq(0).click();
        cy.get('.list-title').should("contain","Subfolder 1");
        cy.get('.icon-expand-folder').last().click();
        cy.get('.list-title').should("contain","Gene list");
    })
});

// Only a superuser can add the im:public tag. The list made here is deleted again, by name,
// from the admin account (the account itself is not touched otherwise).
describeAdmin("Admin account list test", function() {
    beforeEach(function() {
        cy.loginToAdminAccount();
    });

    after(function() {
        const { username, password } = adminCredentials();
        const auth = { user: username, pass: password };
        cy.request({ url: mineService("lists"), auth, qs: { format: "json" } }).then(({ body }) => {
            body.lists
                .filter((list) => /^Gene list for /.test(list.name))
                .forEach((list) => {
                    cy.request({ method: "DELETE", url: mineService("lists"), auth, qs: { name: list.name } });
                });
        });
    });

    it("can make a list public",function(){
        cy.createGeneList(GENES_A);
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
            cy.contains("Tags").parent().find("input").type("im:public{enter}");
        })
        cy.get('.modal-footer').within(()=>{
            cy.contains("Save").click();
        })
        cy.get(".logon.dropdown.success").click().within(() =>{
            cy.contains("Logout").click();
        });
        cy.get(".logon.dropdown.warning").click().should("exist");
        cy.get('.lists-item').its("length").should("be.gt",0);
    })

});

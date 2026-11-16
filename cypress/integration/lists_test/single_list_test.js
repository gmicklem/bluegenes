import { minePage } from "../../support/mine";
import { GENES_A } from "../../support/data";

describe("Single List Test", function() {
    beforeEach(function() {
      cy.visit(minePage("/upload"));
      cy.createGeneList(GENES_A);
      cy.contains("Lists").click();
      cy.url().should("include","/lists");
      cy.get('.lists-item').should('have.length',1);
    });

    it("can copy a list", function(){
        cy.get(".lists-item").within(() => {
            cy.get("button").find('svg[class="icon icon-list-more"]')
            .should("be.visible")
            .click();

            cy.get("button").find('svg[class="icon icon-list-copy"]')
            .should("be.visible")
            .first()
            .click();
        })

        cy.get('.modal-footer').within(() => {
            cy.contains("Copy list(s)").click();
        })
        cy.get('.lists-item').should('have.length',2);

    });

    it("can rename and add description to a list", function(){
        cy.get(".lists-item").within(() => {
            cy.get("button").find('svg[class="icon icon-list-more"]')
            .should("be.visible")
            .click();

            cy.get("button").find('svg[class="icon icon-list-edit"]')
            .should("be.visible")
            .first()
            .click();
        })

        cy.get('.modal-body').find("textarea").type("List of drug-metabolism genes");
        cy.contains('Save').click();

        cy.get(".lists-item").within(() => {
            cy.get(".list-description").should("have.text","List of drug-metabolism genes");
        })       
    });
    it("can delete a list", function(){
        cy.get(".lists-item").within(() => {
            cy.get("button").find('svg[class="icon icon-list-more"]')
            .should("be.visible")
            .click();

            cy.get("button").find('svg[class="icon icon-list-delete"]')
            .should("be.visible")
            .first()
            .click();
        })

        cy.get('.modal-footer').within(() => {
            cy.contains("Delete list(s)").click();
        })
        cy.get('.no-lists').should('exist');
    });

    it("can control the number of lists shown", function(){
        cy.get(".pagination-controls").first().within(() => {
            cy.contains("Rows per page").siblings(".dropdown").as("rowSelect");
            cy.get("@rowSelect").find("li").filter(".active").should("have.text","20");
            cy.get("@rowSelect").find("button").click();
            cy.contains("100").click();
            cy.get("@rowSelect").find("li").filter(".active").should("have.text","100");
        })
    });

    it("has an associated list analysis page and can be analyzed with the enrichment widget",function(){
        cy.get('.list-title').first().click();
        cy.url().should("contain","/results");
        cy.get(".results-table").should("exist");
        cy.get(".enrichment").within(() => {
            cy.contains("Max p-value").parent().find("select").first().select("0.10");
            cy.get('.correction').find("select").select("Benjamini Hochberg");
            cy.get(".dropdown").click();
            cy.get(".list-selection").first().click();
            cy.get('.text-filter input').type("metabolism{enter}");
        })
    })
});
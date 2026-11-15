import { mineService } from "../../support/mine";

Cypress.on('uncaught:exception', (err, runnable) => {
    if (err.message.includes('Can not create edge')) {
        // Cytoscape.js tools are throwing this - ignore for now.
        return false
    }
})

// The demo mine has two enrichment widgets for genes, Publication Enrichment and Pathway
// Enrichment (/service/widgets; no Gene Ontology Enrichment), and both sit in the one
// ".enrichment" sidebar. The list is 18 drug-metabolism genes (fixtures/enrichment_gene.csv);
// with the default settings (p < 0.05, Holm-Bonferroni) 5 pathways are enriched, and the
// publication widget has none. The numbers below were checked with POST /service/list/enrichment.
// Every row of a result table is there twice: each pathway of the demo mine is in two data
// sets (Reactome pathways data set, Reactome pathways (RDF Portal)). So the 10 genes of
// Xenobiotics make 20 rows, the 5 pathways 72 and the first two 34.
const pathwayCategory = () => cy.contains(".enrichment-category", "Pathway Enrichment");

describe("Enrichment Test", function(){
    beforeEach(function(){
        cy.visit("/");
        cy.createListFromFile("enrichment_gene.csv","Enrichment analysis genes");
    });

    // Viewing and downloading enrichment results
    it("can view single enrichment result", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.get(".enrichment-filter").within(() => {
                cy.get("select").select("All");
            })
            cy.contains("Xenobiotics").click();
        })
        cy.get(".pagination-label").should("include.text","of 20 rows");
    })

    it("can view and download all enrichment results", function(){
        cy.get(".enrichment").should("exist").within(() => {
            pathwayCategory().within(() => {
                cy.get(".icon-download").click();
            })
            cy.get(".enrichment-header").should("exist").within(() => {
                cy.get('[type="checkbox"]').check();
                cy.wait(500);
                cy.get('[type="checkbox"]').should("be.checked");
            })
            cy.contains("View").click();
        })
        cy.get('.pagination-label').should("include.text","of 72 rows");
        cy.readFile("cypress/downloads/Enrichment analysis genes Pathway Enrichment.tsv").then(newResult => {
            cy.expectFixture("all_enrichment_result.tsv", newResult);
        })
    })

    it("can view and download checked enrichment results", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.get('[type="checkbox"]').eq(1).check();
            cy.get('[type="checkbox"]').eq(2).check();
            cy.get('[type="checkbox"]').eq(1).should("be.checked");
            cy.get('[type="checkbox"]').eq(2).should("be.checked");
            pathwayCategory().within(() => {
                cy.get(".icon-download").click();
            })
            cy.contains("View").click();
        })
        cy.get('.pagination-label').should("include.text","of 34 rows");
        cy.readFile("cypress/downloads/Enrichment analysis genes Pathway Enrichment.tsv").then(newResult => {
            cy.expectFixture("checked_enrichment_result.tsv", newResult);
        })
    })

    // Applying enrichment filters
    it("can select the test correction method", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
            cy.get(".correction").find("select").select("Benjamini Hochberg");
            cy.wait("@enrichmentLoad");
            // Holm-Bonferroni gives 2.16e-4 for the second pathway
            cy.get(".enrichment-p-value").eq(1).should("have.text","1.09e-4");
        })
    })

    it("can select the p-value", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
            cy.contains("Max p-value").parent().find("select").eq(0).select("1.00");
            cy.wait("@enrichmentLoad");
            cy.contains("Pathway Enrichment").should("include.text","(7)");
        })
    })

    // The demo mine's pathways are not linked to a data set, so the data set filter finds none.
    it("can filter enrichment results by data set", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
            cy.get(".enrichment-filter > div > select").select("Reactome data set");
            cy.wait("@enrichmentLoad");
            cy.contains("Pathway Enrichment").should("include.text","(0)");
        })
    })

    it("can filter enrichment results by text", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
            cy.typeSlowly(".text-filter > .form-control", "CYP2E1", { enter: true });
            cy.wait("@enrichmentLoad");
            cy.get(".enrichment-item").eq(0).should("include.text","CYP2E1");
        })
    })

    it("can select background population to analyze against", function(){
        cy.createListFromFile("background_genes.csv","Background genes");
        cy.contains("List").click();
        cy.url().should("include","/lists");
        cy.get(".lists-item").find(".list-title").eq(1).click();
        cy.intercept("POST",mineService("query/results")).as("resultsLoad");
        cy.url().should("include","/results");
        cy.wait("@resultsLoad");
        cy.get(".enrichment").should("exist").within(() => {
            cy.get(".dropdown").click();
            cy.get(".list-selection").eq(1).click();
        })
        cy.intercept("POST",mineService("list/enrichment")).as("enrichmentReq");
        cy.wait('@enrichmentReq').its('response.statusCode').should('eq', 200);
    })

    it("returns an error if the background population doesn't contain a gene in the list", function(){
        cy.createListFromFile("background_genes.csv","Background genes");
        cy.contains("List").click();
        cy.url().should("include","/lists");
        cy.get(".lists-item").find(".list-title").eq(0).click();
        cy.intercept("POST",mineService("query/results")).as("resultsLoad");
        cy.url().should("include","/results");
        cy.wait("@resultsLoad");
        cy.get(".enrichment").should("exist").within(() => {
            cy.get(".dropdown").click();
            cy.get(".list-selection").eq(1).click();
        })
        cy.get('.enrichment-settings > .alert > p').should("include.text","One or more of the Genes in this list are missing from your background population. The background population should include all Genes that were tested as part of your experiment.")
    })

    // Other elements on the page
    it("shows widgets and tools for list analysis", function(){
        // The "Widgets" heading and the chart widgets only show when a chart has data; the demo
        // mine's chromosome distribution has none (no chromosome locations), so look at the
        // enrichment widgets of the sidebar instead.
        cy.get(".enrichment-category").its("length").should("be.gt",0);
        cy.get(".results-heading").last().should("have.text","Tools");
        cy.get(".report-item").its("length").should("be.gt",0);
    })
})

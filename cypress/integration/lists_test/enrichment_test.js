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
// The p-values depend on the population (the 111 of the panel's 114 genes that have a pathway) and on
// the number of tests (the 220 pathways of those genes), so they move with the panel: the fixtures are
// compared with a relative tolerance, since their last digits are floating-point noise of the mine.
// Each pathway is in exactly one data set (Reactome pathways data set), so the table of a
// result has one row per gene of the list that is in the pathway, once: the number of rows is
// the number of gene ids in the third column of the downloaded result (the tsv fixtures, one
// line per pathway: name, p-value, matched gene ids, pathway identifier).

// Rows of the results table for the pathways in a tsv fixture: the matched genes, summed.
const matchedGenes = (line) => line.split("\t")[2].split(",").length;
const expectedRows = (fixture) =>
    cy.readFile("cypress/fixtures/" + fixture).then(tsv =>
        tsv.trim().split("\n").reduce((sum, line) => sum + matchedGenes(line), 0));
// The downloaded tsv against a fixture: every column equal, but the p-value (second column), which
// must agree to 9 significant figures. CYPRESS_RECORD_FIXTURES=true records the fixture instead.
const expectEnrichmentFixture = (fixture, actual) => {
    if (String(Cypress.env("RECORD_FIXTURES")) === "true") {
        return cy.expectFixture(fixture, actual);
    }
    return cy.readFile("cypress/fixtures/" + fixture).then(expected => {
        const rows = (tsv) => tsv.trim().split("\n").map(line => line.split("\t"));
        const want = rows(expected);
        const got = rows(actual);
        expect(got.length, "number of pathways").to.equal(want.length);
        want.forEach((row, i) => {
            [0, 2, 3].forEach(col => expect(got[i][col], "column " + col + " of line " + (i + 1)).to.equal(row[col]));
            expect(Number(got[i][1]), "p-value of line " + (i + 1)).to.be.closeTo(Number(row[1]), Number(row[1]) * 1e-9);
        });
    });
};
const expectRows = (n) => cy.get(".pagination-label").invoke("text").should("match", new RegExp("of " + n + " rows$"));

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
        // Xenobiotics is the first line of the fixtures: one row per matched gene
        cy.readFile("cypress/fixtures/all_enrichment_result.tsv").then(tsv => {
            expectRows(matchedGenes(tsv.split("\n")[0]));
        });
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
        expectedRows("all_enrichment_result.tsv").then(expectRows);
        cy.readFile("cypress/downloads/Enrichment analysis genes Pathway Enrichment.tsv").then(newResult => {
            expectEnrichmentFixture("all_enrichment_result.tsv", newResult);
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
        expectedRows("checked_enrichment_result.tsv").then(expectRows);
        cy.readFile("cypress/downloads/Enrichment analysis genes Pathway Enrichment.tsv").then(newResult => {
            expectEnrichmentFixture("checked_enrichment_result.tsv", newResult);
        })
    })

    // Applying enrichment filters
    it("can select the test correction method", function(){
        cy.get(".enrichment").should("exist").within(() => {
            cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
            cy.get(".correction").find("select").select("Benjamini Hochberg");
            cy.wait("@enrichmentLoad");
            // Holm-Bonferroni gives 2.05e-4 for the second pathway, Benjamini Hochberg
            // 220 * 9.37e-7 / 2 (the raw p-value of the tied second and third pathways)
            cy.get(".enrichment-p-value").eq(1).should("have.text","1.03e-4");
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

    // Every pathway is in the one data set "Reactome pathways data set", so filtering by it
    // keeps all the enriched pathways; the options are the widget's filter list of the mine.
    it("can filter enrichment results by data set", function(){
        cy.request(mineService("widgets")).then(({ body }) => {
            const widget = body.widgets.find(w => w.name === "pathway_enrichment");
            const options = widget.filters.split(",");
            expect(options).to.deep.equal(["All", "Reactome pathways data set"]);
            cy.get(".enrichment").should("exist").within(() => {
                cy.get(".enrichment-filter > div > select option").then($options => {
                    expect([...$options].map(o => o.textContent)).to.deep.equal(options);
                });
                cy.intercept("POST",mineService("list/enrichment")).as("enrichmentLoad");
                cy.get(".enrichment-filter > div > select").select("Reactome pathways data set");
                cy.wait("@enrichmentLoad");
                // as many pathways as without the filter: the lines of the all-results fixture
                cy.readFile("cypress/fixtures/all_enrichment_result.tsv").then(tsv => {
                    const pathways = tsv.trim().split("\n").length;
                    cy.contains("Pathway Enrichment").should("include.text","(" + pathways + ")");
                });
            })
        });
    })

    it("can filter enrichment results by text", function(){
        cy.get(".enrichment").should("exist").within(() => {
            // the filter works on the results the page already has: no request follows
            cy.get(".text-filter > .form-control").type("CYP2E1{enter}");
            cy.get(".enrichment-item").eq(0).should("include.text","CYP2E1");
        })
    })

    it("can select background population to analyze against", function(){
        cy.createListFromFile("background_genes.csv","Background genes");
        cy.contains("List").click();
        cy.url().should("include","/lists");
        // register the intercepts before the click that causes the requests
        cy.intercept("POST",mineService("query/results")).as("resultsLoad");
        cy.get(".lists-item").find(".list-title").eq(1).click();
        cy.url().should("include","/results");
        cy.wait("@resultsLoad");
        cy.intercept("POST",mineService("list/enrichment")).as("enrichmentReq");
        cy.get(".enrichment").should("exist").within(() => {
            cy.get(".dropdown").click();
            cy.get(".list-selection").eq(1).click();
        })
        cy.wait('@enrichmentReq').its('response.statusCode').should('eq', 200);
    })

    it("returns an error if the background population doesn't contain a gene in the list", function(){
        cy.createListFromFile("background_genes.csv","Background genes");
        cy.contains("List").click();
        cy.url().should("include","/lists");
        cy.intercept("POST",mineService("query/results")).as("resultsLoad");
        cy.get(".lists-item").find(".list-title").eq(0).click();
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

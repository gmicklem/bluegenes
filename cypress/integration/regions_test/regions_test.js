import { minePage, mineService, requireMineData } from "../../support/mine";

// The demo mine has chromosomes (1..22, X) but no Location objects, so a region search finds
// no features. The tests that need features to click, list or skip to are skipped with
// requireMineData (a count of Location objects asked of the mine); the tests of the search
// form, which only look at the region headers, run everywhere.
const needsFeatures = (ctx) =>
    requireMineData(ctx, "Location", "the test needs features overlapping a region");

describe("Regions Test", function(){
    beforeEach(function(){
        cy.visit(minePage("/regions"));
    });

    it("can search a gene region given by example", function(){
        needsFeatures(this);
        cy.get(".input-section").within(() => {
            cy.contains("Show Example").click();
            cy.get("textarea").should("include.text","14615455");
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get(".single-feature").its("length").should("be.gt",0);
            cy.get(".single-feature").first().click();
        })
        cy.url().should("include","/report");
    });

    it("can type in chromosome coordinates and select features", function(){
        needsFeatures(this);

        cy.get(".input-section").within(() => {
            cy.get("textarea").type("1:0..100000");
            cy.get('button[class="btn dropdown-toggle"]').click();
            cy.get(".dropdown-menu li").first().click(); // the first organism of the mine
            cy.contains("Features to include").children().click();
            cy.contains("Gene").children().click();
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").first().within(() => {
            cy.get(".single-feature").its("length").should("be.gt",0);
            cy.contains("Next").click();
            cy.get(".single-feature").its("length").should("be.gt",0);
            cy.get(".single-feature").first().click();
        })
        cy.url().should("include","/report");
    });

    it("can search regions with interbase coordinates", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:0..30000");
            cy.get(".radio-group").within(() => {
                cy.contains("interbase").within(() => {
                    cy.get(".check").should("not.be.visible");
                    cy.get(".circle").should("be.visible").click();
                    cy.wait(500);
                    cy.get(".check").should("be.visible");
                })
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get("#region-result-0 > span").should("include.text","1 1..30000");
        })
    })

    it("can perform region search in the leading strand", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:0..30000");
            cy.get(".togglebutton").within(() => {
                cy.get('.toggle').click();
                cy.wait(500);
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results > #region-result-0").within(() => {
            cy.get(".icon-arrow-right").should("exist");
        })
    })
    it("can perform region search in the lagging strand", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:30000..0");
            cy.get(".togglebutton").within(() => {
                cy.get('.toggle').click();
                cy.wait(500);
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results > #region-result-0").within(() => {
            cy.get(".icon-arrow-left").should("exist");
        })
    })

    it("can extend gene search region by clicking tick marks", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:10000..40000");
            cy.get(".extend-region").within(() => {
                cy.get(".slider-ticks").eq(0).within(() => {
                    cy.contains("1k").click();
                    cy.wait(500);
                })
                cy.get(".form-control").eq(1).should("have.value","1k");
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").should("exist").within(() => {
            cy.get("#region-result-0").should("include.text","1 9000..41000");
        })
    })

    it("can extend gene search region by sliders", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:10000..40000");
            cy.get(".extend-region").within(() => {
                cy.get('input[type="range"]').eq(0)
                .then($el => $el[0].stepUp(40))
                .trigger('change');
                cy.wait(500);
                cy.get(".form-control").eq(1).should("have.value","10k");
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get("#region-result-0").should("include.text","1 0..50000");
        })
    })

    it("can extend gene search region by inputing in the text box", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:40000..60000");
            cy.get(".extend-region").within(() => {
                cy.get("input.form-control").eq(1).clear().type("38k{enter}");
                cy.get("input.form-control").eq(1).should("have.value","38k");
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get("#region-result-0").should("include.text","1 2000..98000");
        })
    })

    it("can lock gene search region extension", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:10000..20000");
            cy.get(".extend-region").within(() => {
                cy.get(".icon-lock").click();
                cy.get("input.form-control").eq(1).clear().type("3.8k{enter}");
                cy.get("input.form-control").eq(2).clear().type("2500{enter}");
                cy.get("input.form-control").eq(1).should("have.value","3.8k");
                cy.get("input.form-control").eq(2).should("have.value","2500");
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get("#region-result-0").should("include.text","1 6200..22500");
        })

    })

    it("can select the organism in which to perform region search", function(){
        cy.get(".input-section").within(() => {
            cy.get("textarea").clear().type("1:10000..40000");
            cy.get(".organism-selection").within(() => {
                cy.get(".dropdown-toggle").click();
                cy.get(".dropdown-menu").within(() => {
                    cy.contains("Clear").click();
                })
                cy.get("span").should("include.text","All Organisms");
            })
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").within(() => {
            cy.get(".features-count").should("include.text","overlapping features");
        })
    })

    it("can create a list by feature type", function(){
        needsFeatures(this);
        cy.get(".input-section").within(() => {
            cy.contains("Show Example").click();
            cy.get("textarea").should("include.text","14615455");
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").first().within(() => {
            cy.get(".single-feature").its("length").should("be.gt",0);
        })
        cy.get(".results-actions").within(() => {
            cy.contains("Create list by feature type").click();
            cy.get(".dropdown-menu").within(() => {
                cy.contains("Gene").click();
            })
        })
        cy.intercept("POST",mineService("query/results")).as("queryResults");
        cy.wait("@queryResults");
        cy.url().should("include","/results");
        cy.get(".query-title").should("include.text","Gene");
    })

    it("can view all features in search region in a results table", function(){
        needsFeatures(this);
        cy.get(".input-section").within(() => {
            cy.contains("Show Example").click();
            cy.get("textarea").should("include.text","14615455");
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").first().within(() => {
            cy.get(".single-feature").its("length").should("be.gt",0);
        })
        cy.get(".results-actions").within(() => {
            cy.contains("View all in results table").click();
        })
        cy.intercept("POST",mineService("query/results")).as("queryResults");
        cy.wait("@queryResults");
        cy.contains("Query Results").should("exist");
        cy.url().should("include","/results");
    })

    it("can skip to selected region of search results", function(){
        needsFeatures(this);
        cy.get(".input-section").within(() => {
            cy.contains("Show Example").click();
            cy.get("textarea").should("include.text","14615455");
            cy.get("button").filter(':contains("Search")').click();
        })
        cy.get(".results").first().within(() => {
            cy.get(".single-feature").its("length").should("be.gt",0);
        })
        cy.get("#region-skip-to-bar").within(() => {
            cy.get(".results-count").contains("3").click();
            cy.wait(500);
        })
        cy.get(".results").eq(2).as("thirdResults");
        cy.isInViewport("@thirdResults");
    })
})

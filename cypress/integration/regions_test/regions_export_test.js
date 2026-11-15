import { minePage, mineService, requireMineData } from "../../support/mine";

// The expected files in cypress/fixtures are recorded from the mine's own export (run with
// CYPRESS_RECORD_FIXTURES=true, see docs/building.md), so they need a mine whose features
// have chromosome locations. The demo mine has none: the whole file is skipped there.

describe("Regions Export Test", function(){
    before(function(){
        requireMineData(this, "Location", "the exports need features overlapping the regions");
    });

    beforeEach(function(){
        cy.visit(minePage("/regions"));
        cy.get(".input-section").within(() => {
            cy.get("textarea").type("2:14615455..14619002{enter}");
            cy.get("textarea").should("include.text","14615455");
            cy.intercept("POST",mineService("query/results")).as("regionSearch");
            cy.get("button").filter(':contains("Search")').click();
            cy.wait("@regionSearch");
        })
        // Taken from https://github.com/cypress-io/cypress/issues/14857#issuecomment-790765826
        // Included to avoid pageLoad timeout error when downloading 
        // files which may redirect to a a different baseURL.
        cy.window().document().then(function (doc) {
            doc.addEventListener('click', () => {
              setTimeout(function () { doc.location.reload() }, 5000)
            })
        })
    });

    it("can export results of region search in TAB", function(){
        cy.get(".results").eq(0).find(".results-footer").within(() => {
            cy.contains("TAB").click();
        })
        cy.readFile("cypress/downloads/result.tsv").then(newResult => {
            cy.expectFixture("region_result.tsv", newResult);
        })
    })

    it("can export results of region search in CSV", function(){
        cy.get(".results").eq(0).find(".results-footer").within(() => {
            cy.contains("CSV").click();
        })
        cy.readFile("cypress/downloads/result.csv").then(newResult => {
            cy.expectFixture("region_result.csv", newResult);
        })
    })

    it("can export results of region search in GFF3", function(){
        cy.intercept('**/service/query/results/**').as('records');
        cy.get(".results").eq(0).find(".results-footer").within(() => {
            cy.contains("GFF3").click();
        })
        cy.wait('@records').its('request').then((req) => {
            cy.request(req)
            .then(({ body, headers }) => {
                cy.expectFixture("region_result.gff3", body);
            })
        })
    })
    it("can export results of region search in BED", function(){
        cy.intercept('**/service/query/results/**').as('records');
        cy.get(".results").eq(0).find(".results-footer").within(() => {
            cy.contains("BED").click();
        })
        cy.wait('@records').its('request').then((req) => {
            cy.request(req)
            .then(({ body, headers }) => {
                cy.expectFixture("region_result.bed", body);
            })
          })
    })
    it("can export results of region search in FASTA", function(){
        cy.intercept('**/service/query/results/**').as('records');
        cy.get(".results").eq(0).find(".results-footer").within(() => {
            cy.contains("FASTA").click();
        })
        cy.wait('@records').its('request').then((req) => {
            cy.request(req)
            .then(({ body, headers }) => {
                cy.expectFixture("region_result.fa", body);
            })
          })
    })

})

import { minePage, mineService } from "../support/mine";
import { GENE_SYMBOL } from "../support/data";

// Searches of the demo mine (/service/search): "PPARG OR HFE" finds the two genes first;
// "CYP*" has 18 genes; "protein AND P3723*" gives 3 proteins (P37231 is PPARG's); "GST" gives the genes GSTM1, GSTA1 and GSTP1.

describe("Search Test", function(){
    beforeEach(function(){
        cy.visit(minePage("/search"));
    });

    it("can be accessed from navigation bar", function(){
        cy.searchKeyword("Ma*");
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
    });

    it("can search a single term", function(){
        cy.searchKeyword(GENE_SYMBOL);
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.contains("Symbol").next().should("have.text",GENE_SYMBOL);
    });

    it("can search two terms with OR", function(){
        cy.searchKeyword("PPARG OR HFE");
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().within(()=>{
            cy.contains("Symbol").next().should("have.text","PPARG");
        });

        cy.get(".results > form").children().eq(1).within(()=>{
            cy.contains("Symbol").next().should("have.text","HFE");
        });
    });

    it("can search a phrase with quotation marks", function(){
        cy.searchKeyword('"DNA binding"');        
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.contains("Name").next().should("have.text","DNA binding");
    });

    it("can search for partial matches", function(){
        cy.searchKeyword('CYP*');        
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.get('.report-table-body').within(() => {
            cy.get(".report-table-cell").filter(':contains("CYP")').its('length').should("be.gt", 0);;
        })
    });

    it("can search with boolean search syntax", function(){
        cy.searchKeyword('protein AND P3723*');        
        cy.url().should("include","/search?keyword");

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.get('.report-page-heading > .start').should("include.text","Protein");
        cy.get('.report-table-body').within(() => {
            cy.get(".report-table-cell").filter(':contains("P3723")').its('length').should("be.gt", 0);;
        })
    });

    it("can filter search results by category", function(){
        cy.searchKeyword('CYP*');        
        cy.url().should("include","/search?keyword");

        cy.get("td").filter(':contains("Gene")').click();
        
        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.get('.report-page-heading > .start').should("include.text","Gene");
    });

    // The organism filter is built from the search facet organism.shortName, which the demo
    // mine does not have (its Organism has only a taxon id): skipped there, by asking the mine.
    it("can filter search results by organism", function(){
        cy.request(mineService("search?q=CYP*&size=1&format=json")).then(({ body }) => {
            const organisms = Object.keys(body.facets["organism.shortName"] || {});
            if (organisms.length === 0) {
                this.skip();
            }
            cy.searchKeyword('CYP*');
            cy.url().should("include","/search?keyword");

            cy.get("td").filter(':contains("Gene")').click();
            cy.get("td").filter(':contains("' + organisms[0] + '")').click();

            cy.get(".results > form").children().first().click();
            cy.url().should("include","/report");
            cy.contains("Organism").next().should("include.text", organisms[0]);
        });
    });
})

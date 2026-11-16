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

    // The organism filter is built from the search facet organism.shortName. The demo mine's
    // Organism has the short name "H. sapiens", so every search result of an organism-bearing
    // class counts under it; the sidebar lists it next to the categories, with the count the
    // mine gives (CYP* has 18 genes, all human).
    it("offers an organism filter for the search results", function(){
        cy.request(mineService("search?q=CYP*&size=1&format=json")).then(({ body }) => {
            const organisms = body.facets["organism.shortName"];
            expect(Object.keys(organisms)).to.deep.equal(["H. sapiens"]);
            cy.searchKeyword('CYP*');
            cy.url().should("include","/search?keyword");

            cy.contains(".facets h5", "Organism").next("table").within(() => {
                cy.get("tr").should("have.length", 1);
                cy.contains("tr", "H. sapiens").find("td.count").should("have.text", String(organisms["H. sapiens"]));
            });
            // with the Gene category selected the organism count is the number of genes
            cy.get("td").filter(':contains("Gene")').click();
            cy.contains(".facets h5", "Organism").next("table").contains("tr", "H. sapiens")
                .find("td.count").should("have.text", String(body.facets["Category"]["Gene"]));
        });
    });

    // Known issue, so skipped: choosing the organism filter gives 0 results on the demo mine
    // (/service/search?q=CYP*&facet_organism.shortName=H.%20sapiens has totalHits 0 although
    // the facet counts 64; the public HumanMine returns the hits). InterMine's
    // SolrKeywordSearchHandler adds the filter query as `facet_organism.shortName:H. sapiens`
    // without quoting the value, so Solr reads it as the term "H." on that field plus "sapiens"
    // on the default field; with the value escaped (H%5C.%5C%20sapiens) the demo mine returns
    // the 64. One-word filters, like the categories, work. Enable the test once the mine (or
    // BlueGenes, by escaping the value) handles values with a space.
    it.skip("can filter search results by organism", function(){
        cy.searchKeyword('CYP*');
        cy.url().should("include","/search?keyword");

        cy.get("td").filter(':contains("Gene")').click();
        cy.get("td").filter(':contains("H. sapiens")').click();

        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");
        cy.contains("Organism").next().should("include.text", "H. sapiens");
    });
})

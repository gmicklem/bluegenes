import { itExternal, mineUrl, requireMineData } from "../support/mine";
import { GENES_A, GENE_PRIMARY_IDENTIFIER, GENE_SYMBOL } from "../support/data";

// The report page asks every neighbouring mine for homologues of the gene. FlyMine
// (an additional mine in BLUEGENES_ADDITIONAL_MINES) is answered with this one gene.
const stubFlymineHomologues = () => {
    cy.intercept('POST', 'https://www.flymine.org/flymine/service/query/results', {statusCode: 200,
    body: {"modelName":"genomic","columnHeaders":["Gene > Id","Gene > Symbol","Gene > DB identifier","Gene > Secondary Identifier","Gene > Organism > Short Name"],"rootClass":"Gene","start":0,"views":["Gene.id","Gene.symbol","Gene.primaryIdentifier","Gene.secondaryIdentifier","Gene.organism.shortName"],"results":[
    [1029368,"Eip75B","FBgn0000568","CG8127","D. melanogaster"]
    ],"executionTime":"2021.08.12 13:10::26","wasSuccessful":true,"error":null,"statusCode":200}
    })
};

describe("Report Page Test", function(){
    beforeEach(function(){
        cy.searchKeyword(GENE_SYMBOL);
        stubFlymineHomologues();
        // the gene is the first of the hits (there are proteins, pathways and publications too)
        cy.get(".result").first().click();
        cy.url().should("include","/report");
        cy.get('.report-page-heading').should("exist");
    });

    it("can filter the topic of a search result", function(){
        cy.typeSlowly(".report-page-filter input", "Publications", { enter: true });
        cy.get('.text-highlight').should("include.text","Publications").click();
        cy.get(".report-item").eq(0).within(() => {
            cy.get('.report-item-title').should("include.text","Publications");
            cy.get('.im-table').should("exist");
        })
    });

    it("can access a topic from the left sidebar", function(){
        cy.get(".toc").within(() => {
            cy.contains("Data").click();
            cy.contains("Alleles").click();
        })

        // Alleles is the first topic of the data: topics near the end of the page cannot be
        // scrolled to the top, and would stay below the fold.
        cy.get('.report-item-title').contains("Alleles")
        .parent().parent(".report-item")
        .as('allelesTable');
        cy.wait(100); 
        cy.isInViewport("@allelesTable");
    });

    it("can collapse and expand a section on report page", function(){
        cy.get('.report-table-heading').contains("Data")
        .parent(".report-table")
        .as('dataSection');

        cy.get("@dataSection").within(() => {
            cy.get(".report-item-title").should("exist");
            cy.get(".icon-chevron-up").click();
            cy.get(".report-item").should("not.exist");
        })
    });

    // The next three tests need the gene's sequence and location, which the demo mine does
    // not have (no Sequence or Location objects, so the summary has no region link or FASTA).
    it("can perform a region search with its sequence", function(){
        requireMineData(this, "Location", "the region link of the summary needs a location");
        cy.get(".report-table").should("have.id","summary").within(() => {
            cy.get('.report-table-link > span').click();
        })
        cy.url().should("include","/regions");
    });

    it("can view the sequence of a gene", function(){
        requireMineData(this, "Sequence", "the FASTA value of the summary needs a sequence");
        cy.get(".report-table").should("have.id","summary").within(() => {
            cy.get('.fasta-value > .dropdown').click();
        })
        cy.isInViewport(".fasta-sequence");
    });

    it("can download the sequence of a gene in FASTA format", function(){
        requireMineData(this, "Sequence", "the FASTA value of the summary needs a sequence");
        cy.get(".report-table").should("have.id","summary").within(() => {
            cy.get('.fasta-value > .fasta-download').click();
        })
        cy.readFile('cypress/downloads/' + GENE_PRIMARY_IDENTIFIER + '.fasta').should('contain', GENE_PRIMARY_IDENTIFIER);
    });

    it("can expand a section to view the data displayer", function(){
        cy.get('.report-table-heading').contains("Data")
        .parent(".report-table").find(".report-item").filter(':contains("Pathways")')
        .as('pathwaysSection');

        cy.get("@pathwaysSection").within(() => {
            cy.get('.im-table').should("exist");
            cy.get('.report-item-toggle').click();
            cy.get('.im-table').should("not.exist");
        })
    });

    
    it("can copy the permanent URL of the report page of the object", function(){
        cy.get(".sidebar-actions").filter(':visible').within(() => {
            cy.contains("Copy permanent URL").click();
            cy.get(".permanent-url-container").should("be.visible").within(() => {
                cy.get("input.form-control").should("be.visible").invoke('val').should("include",mineUrl() + "/gene:" + GENE_PRIMARY_IDENTIFIER);
                cy.get("button").contains("Copy").should("be.visible").click({multiple:true});
            });
        })
        // cy.wait(500);
        // cy.task("getClipboard").should("contain","/biotestmine/gene:PF14_0187");
    });

    it("can check if the gene is present in any list", function(){
        cy.get(".sidebar-entry").filter(':contains("Lists")').filter(':visible').as('listsSection');
        cy.get("@listsSection").within(() => {
            cy.get("p").should("contain","This Gene isn't in any lists.");
        })
        cy.createGeneList(GENES_A);
        cy.typeSlowly(".typeahead-search", GENE_SYMBOL, { enter: true });
        cy.get(".result").first().click();
        cy.url().should("include","/report");

        cy.get("@listsSection").within(() => {
            cy.get("a").first().click();
        })   
        cy.wait(500);
        cy.url().should("include","/results");
        cy.get('.query-title').should("include.text","Gene list");
    });

    it("can access the list of data sources", function(){
        // cy.contains("Data sources").siblings().filter(':contains("View all")').click();
        cy.contains("View all").click(); //Flaky
        cy.url().should("include","/results");
        cy.get(".im-table").should("exist");
    })
})

// The "Other mines" box of a gene report page queries the neighbouring mines for
// homologues, so this needs a second mine: FlyMine (BLUEGENES_ADDITIONAL_MINES) next to
// the default mine. It is about FlyMine on purpose, whatever the default mine is, and it
// needs a default mine with real genes (HumanMine). The FlyMine query is stubbed; the
// click then opens FlyMine's report page in BlueGenes.
describe("Report Page Test: other mines", function(){
    beforeEach(function(){
        cy.searchKeyword("PPARG");
        stubFlymineHomologues();
        // The human gene among the PPARG hits (there are mouse and rat genes too).
        cy.contains(".result", "Homo sapiens").first().click();
        cy.url().should("include","/report/Gene");
        cy.get('.report-page-heading').should("exist");
    });

    itExternal("can access homologue of the gene in other mines", function(){
        // The sidebar is rendered twice (one copy is hidden at any width).
        cy.get(".other-mine").filter(":visible").within(() => {
            cy.get(".mine").should("include.text","FlyMine");
            cy.get("img").should("exist");
            cy.contains("Eip75B").should("exist").click(); //An example of a gene in flymine, not necessarily the homologue
        })
        cy.url().should("include","/flymine/report/Gene/1029368");
    })

    // BlueGenes tools (npm packages that bluegenes-tool-store installs, loaded from /tools/)
    // take window.React, window.ReactDOM and window.imjs from the page. run-script! catches
    // what a tool throws, so a missing global (`ReferenceError: imjs is not defined`) leaves
    // the tool's container empty and nothing else fails. The tools that query the mine
    // (ArrayExpress, human tissue, protein atlas, expression box swarm) draw an svg or a
    // canvas; tools that need PDB or EBI servers just show their own error text, so only
    // require that some tool has drawn something. Needs the tools installed under
    // BLUEGENES_TOOL_PATH, which bluegenes-tool-store does at start-up.
    itExternal("renders data in the tools of the report page", function(){
        cy.get(".report-item-tool", {timeout: 60000}).should("exist");
        cy.get(".report-item-tool svg, .report-item-tool canvas", {timeout: 60000}).should("exist");
        cy.window().then((win) => {
            expect(win.React, "window.React").to.exist;
            expect(win.ReactDOM, "window.ReactDOM").to.exist;
            expect(win.imjs, "window.imjs").to.exist;
            expect(win.imjs.Service, "window.imjs.Service").to.be.a("function");
        });
    })
})

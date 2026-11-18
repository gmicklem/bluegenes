import { minePage, mineService } from "../support/mine";
import { GENES_A } from "../support/data";

// The demo mine has 9 public templates (/service/templates), one with the aspect Genomics.

// Rows of the template Gene_Protein (gene, then its proteins) for the genes of GENES_A: counted by
// the web service, so the expectation follows the mine's data (135 for the 114 gene panel).
const geneProteinRows = () => {
    const symbols = GENES_A.split(",").map(s => `<value>${s.trim()}</value>`).join("");
    const query = '<query model="genomic" view="Gene.primaryIdentifier Gene.symbol Gene.proteins.primaryIdentifier ' +
        'Gene.proteins.primaryAccession"><constraint path="Gene.symbol" op="ONE OF">' + symbols + "</constraint></query>";
    return cy.request({ url: mineService("query/results"), qs: { query, format: "count" } })
        .then(({ body }) => {
            expect(Number(body), "Gene_Protein rows of GENES_A").to.be.greaterThan(0);
            return String(Number(body));
        });
};

describe("Templates Test", function() {
    beforeEach(function() {
      cy.visit(minePage("/templates"));
    });

    it("can filter templates by search", function() {
        cy.contains('Filter by text').next().type("organism proteins");
        cy.get('.template').eq(0).should("have.id","All_Proteins_In_Organism_To_Publications");
        cy.get('.template').eq(1).should("have.id","Organism_Protein");
    });

    it("can search templates by categories", function() {
        cy.get(".template").should("have.length","9");
        cy.contains("Genomics").click();
        cy.get(".template").should("have.length","1");
    });

    it("can load predefined template and show results", function() {
        cy.get("#All_Proteins_In_Organism_To_Publications").contains("View").click();
        cy.url().should("include","/All_Proteins_In_Organism_To_Publications");
        cy.get('#All_Proteins_In_Organism_To_Publications').within(() => {
            cy.get('select').first().select('!=');
            cy.get('td').should('include.text','Query returned no results');

            cy.contains('Open in results page').click();
            cy.url().should("include","/results");
        });
    });

    it("can run a template search with a list", function() {
        cy.createGeneList(GENES_A);
        cy.contains("Templates").click();
        cy.url().should("contain","/templates");
        cy.get("#Gene_Protein").click().within(() => {
            cy.get("select").select("IN");
            cy.contains("Choose a list").click();

            cy.get(".dropdown-menu").should("exist");
            cy.get(".list-selection").first().click();
            geneProteinRows().then(rows => cy.get(".view-results").should("contain", rows).click());
        });
        cy.url().should("contain","/results");
    });

    it("can view and close a template", function(){
        cy.contains("View").first().click();
        cy.get(".template").filter(".selected").within(() => {
            cy.contains("Close").click();
        })
        cy.get(".template").filter(".selected").should("not.exist");
    })
    
    it("can edit a templated query", function() {
        cy.get('#All_Proteins_In_Organism_To_Publications').click().within(()=> {
            cy.contains("Edit query").click();
        })
        cy.url().should("contain","/querybuilder");
        cy.get('.query-browser').within(()=>{
            cy.get(".qb-label").should("contain","Protein");
            cy.get(".qb-label").should("contain","Publications");
        })
    })

    it("can lookup a gene with a template search", function() {
        cy.get("#Gene_Protein").click().within(() => {
            cy.get(".constraint-input input").clear().type("CYP*{enter}");
            cy.get(".view-results").click();
        })
        cy.url().should("include","/results");
    });
});

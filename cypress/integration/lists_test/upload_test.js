import { minePage } from "../../support/mine";
import { GENES_A, PROTEINS } from "../../support/data";

describe("Upload Test", function(){
    beforeEach(function(){
        cy.visit(minePage("/upload"));
    });

    it("can load free text input", function(){
        cy.get(".wizard textarea").type("PPARG, HFE");
        cy.contains("Continue").click();
        cy.url().should("include","/save");
    });

    it("can select list type and organism", function(){

        cy.get('.select-organism-and-list-type').within(() => {
            cy.contains("List type").siblings(".form-group").find("select").select("Protein");
            // cy.contains("Organism").siblings(".organism-selector").find("select").select("Any");
        })
        cy.get('.select-organism-and-list-type > :nth-child(2) > .form-group > .form-control').select("Any").trigger("change"); //to rewrite; the trigger is explained at createProteinList
        cy.get('#caseSensitiveCheckbox').check();

        cy.get(".wizard textarea").type(PROTEINS);
        cy.contains("Continue").click();
        cy.url().should("include","/save");
        // not checked: how many matched. With "Identifiers are case sensitive" ticked, BlueGenes
        // lower-cases the identifiers (ws/ids.clj parse-ids has the condition the wrong way round),
        // so UniProt accessions are not found.
        cy.contains("matched a Protein");
    })

    it("can upload and save list", function(){
        cy.get(".wizard textarea").type(GENES_A);
        cy.contains("Continue").click();
        cy.url().should("include","/save");
        cy.contains("Save List").click();
        cy.url().should("include","/results");

        cy.openListsTab();
        cy.url().should("include","/lists");
        cy.get(".lists-item").its('length').should("be.gt", 0);
    });
    
    it("can load a file and save list", function(){
        const filePath = 'gene.csv';
        cy.contains("File Upload").click();
        cy.contains("Browse").click();
        // attachFile (cypress-file-upload) took a fixtures-relative path and ignored
        // visibility; selectFile wants a project-relative path and force for a hidden input
        cy.get('input[type="file"]').selectFile("cypress/fixtures/" + filePath, { force: true });
        cy.contains("Continue").click();

        cy.url().should("include","/save");
        cy.contains("Save List").click();
        cy.url().should("include","/results");
    });

    it("can reset to cancel upload", function(){
        cy.get(".wizard textarea").type(GENES_A);
        cy.contains("Reset").click();
        cy.get(".wizard").find("textarea").should("have.value","");
    })
})
import { adminCredentials, describeAdmin, minePage, mineService } from "../../support/mine";
import { GENE_SYMBOL } from "../../support/data";

// needs a superuser: CYPRESS_ADMIN_USER and CYPRESS_ADMIN_PASSWORD
describeAdmin("Report Page Layout Test", function(){
    // The layout is kept in the mine's bluegenes-properties (key layout.report), and the
    // tests build on each other, so they need to start from an empty layout (a run that
    // stopped half way leaves its categories behind). The mine's own layout is put back
    // at the end.
    const layoutRequest = (method, qs, form) => {
        const { username, password } = adminCredentials();
        return cy.request({
            method,
            url: mineService("bluegenes-properties"),
            auth: { user: username, pass: password },
            qs,
            form: !!form,
            body: form,
            failOnStatusCode: false,
        });
    };
    let originalLayout;

    before(function(){
        layoutRequest("GET").then(({ body }) => {
            originalLayout = body["bluegenes-properties"]["layout.report"];
            layoutRequest("DELETE", { key: "layout.report" });
        });
    });

    after(function(){
        layoutRequest("DELETE", { key: "layout.report" });
        cy.then(() => {
            if (originalLayout) {
                layoutRequest("POST", undefined, { key: "layout.report", value: originalLayout });
            }
        });
    });

    beforeEach(function(){
        cy.loginToAdminAccount();
        cy.visit(minePage("/admin"));
        cy.contains("Report page layout").parent().should("have.class","well").as("reportPageLayout");
        cy.get("@reportPageLayout").within(() => {
            // "Gene" is listed twice (popular classes and all classes): take the first
            cy.get("Select").select(0);
            cy.get("select").should("have.value","Gene");
        })
    });

    it("can add a category",function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get(".add-category input").type("Interactions{enter}");
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.reactSelect(0, "Proteins");
            cy.get(".classes").within(() => {
                cy.get(".icon-plus").as("addClassButton").click();
                cy.get(".class-entry").should("exist");
            })
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can add description to classes", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.get("li").contains("Proteins").should("exist").click();                
            cy.get(".classes").within(() => {
                cy.get(".icon-info").as("classInfoButton").click();
                cy.get("textarea").clear().type("Proteins encoded by this gene{enter}");
                cy.contains("Save").click();
            })
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can make a class show as collapsed", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.get(".classes").within(() => {
                cy.get(".icon-eye").as("collapseClassButton").click();
                cy.get(".icon-eye-blocked").should("exist");
            })
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })
    it("can move a class up", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.reactSelect(0, "Pathways");
            cy.get(".classes").within(() => {
                cy.get(".icon-plus").as("addClassButton").click();
                cy.get(".class-entry").its("length").should("eq",2);
            })
            cy.get(".class-entry").eq(1).within(() => {
                cy.get(".icon-move-up-list").as("moveClassUpButton").click();
            })
            cy.get(".class-entry").eq(0).find("span").should("include.text","Pathways");
            cy.get(".class-entry").eq(1).find("span").should("include.text","Proteins");
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can move a class down", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.get(".class-entry").its("length").should("eq",2);
            cy.get(".class-entry").eq(0).within(() => {
                cy.get(".icon-move-down-list").as("moveClassDownButton").click();
            })
            cy.get(".class-entry").eq(0).find("span").should("include.text","Proteins");
            cy.get(".class-entry").eq(1).find("span").should("include.text","Pathways");
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can remove a class from a category", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").click().parent().should("have.class","active");
            cy.get(".class-entry").its("length").should("eq",2);
            cy.get(".class-entry").eq(1).within(() => {
                cy.get(".icon-remove-list").as("removeClassButton").click();
            })
            cy.get(".class-entry").its("length").should("eq",1);
            cy.get(".class-entry").find("span").should("include.text","Proteins");
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })
    
    it("can move a category up", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get(".add-category input").type("Regions{enter}");
            cy.get("li").contains("Interactions").should("exist");
            cy.get("li").contains("Regions").should("exist");
            cy.get(".nav").within(() => {
                cy.get("a").its("length").should("eq",2);
                cy.get("a").eq(1).should("include.text","Regions").within(() => {
                    cy.contains("Move up").click();
                })
                cy.get("a").eq(0).should("include.text","Regions");
                cy.get("a").eq(1).should("include.text","Interactions");
            })

            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can move a category down", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").should("exist");
            cy.get("li").contains("Regions").should("exist");
            cy.get(".nav").within(() => {
                cy.get("a").its("length").should("eq",2);
                cy.get("a").eq(0).should("include.text","Regions").within(() => {
                    cy.contains("Move down").click();
                })
                cy.get("a").eq(0).should("include.text","Interactions");
                cy.get("a").eq(1).should("include.text","Regions");
            })

            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })

    it("can update the layout in a report page", function(){
        cy.searchKeyword(GENE_SYMBOL);
        cy.url().should("include","/search?keyword"); // Flaky
        cy.get(".results > form").children().first().click();
        cy.url().should("include","/report");

        cy.get(".report-page-heading").should("include.text",GENE_SYMBOL);
        cy.get(".report-table-heading").contains("Interactions")
        .parent(".report-table")
        .as("interactionsSection");

        cy.get("@interactionsSection").within(() => {
            cy.get(".im-table").should("not.exist");
            cy.get(".report-item-title").should("include.text","Proteins");
            cy.get('[class="icon icon-info"]').should("exist").click();
            cy.get(".report-item-title > .dropdown > .dropdown-menu").should("exist")
            .find("p").should("include.text","Proteins encoded by this gene");
            cy.get(".report-item-toggle").click();
            cy.get(".im-table").should("exist");
        });
    })

    it("can delete a category", function(){
        cy.get("@reportPageLayout").within(() => {
            cy.get("li").contains("Interactions").should("exist");
            cy.get("li").contains("Regions").should("exist");
            cy.get("a").its("length").should("eq",2);
            cy.get("a").eq(1).should("include.text","Regions").within(() => {
                cy.contains("Delete").click();
            })
            cy.get("a").eq(0).should("include.text","Interactions").within(() => {
                cy.contains("Delete").click();
            })
            // cy.contains("Delete").click({multiple:true}); //Flaky
            cy.get("li").contains("Interactions").should("not.exist");
            cy.get("li").contains("Regions").should("not.exist");
            cy.contains("Save changes").click();
            cy.get(".success").should("include.text","Successfully saved changes to report page layout.");  
        })
    })
})
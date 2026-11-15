import { mineName, testAccount, useTestAccount } from "../../support/mine";

describe(__filename, function() {

	// a fresh account on the mine, deleted at the end of the run
	useTestAccount("login");

	it("it should login user successfully", function() {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input#email", testAccount().username);
		cy.typeSlowly("input[type='password']", testAccount().password);
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();
    cy.get(".logon.dropdown").click();
    cy.get(".logon.dropdown").should('to.contain', testAccount().username);
	});

	it("it should logout user successfully", function() {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input#email", testAccount().username);
		cy.typeSlowly("input[type='password']", testAccount().password);
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();
    cy.get(".logon.dropdown").click();
    cy.get(".logon.dropdown").contains('Logout').click({ force: true });
	cy.get('.main-nav').should('to.contain', 'Login');
	});

	it("it ensures password is not empty", function() {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input#email", testAccount().username);
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();
		cy.get(".error-box")
			 .should('to.contain', "Missing parameter: 'password'"); 
	});
	it("it ensures username is not empty", function() {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input[type='password']", "test_password");
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();
		cy.get(".error-box")
			 .should('to.contain', "Missing parameter: 'username'"); 
	});

	it("it errors out on invalid user credentials", () => {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input#email", "no_such_user@example.org");
		cy.typeSlowly("input[type='password']", "secret");
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();

		cy.get(".error-box")
			.should('to.contain', 'Unknown username: no_such_user@example.org');
	});

	it("it errors out on invalid password", () => {
		cy.openLoginDialogue()
		cy.get('.login-form').should('to.contain', "Login to " + mineName())
		cy.typeSlowly("input#email", testAccount().username);
		cy.typeSlowly("input[type='password']", "wrong-password");
		cy.get(".login-form")
			.find("button")
			.contains('Login')
		 	.click();

		cy.get(".error-box")
			.should('to.contain', 'Invalid password supplied');
	});

});

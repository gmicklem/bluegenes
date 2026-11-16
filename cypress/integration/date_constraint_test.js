import { itExternal, mineService, minePage } from "../support/mine";

// Constraints on a date (java.util.Date attribute) end to end: the browser's own date
// input (<input type="date">) in the query builder, in the constraints of a template and in
// the im-tables column filters, with every operator it offers, against a mine that has data
// in such an attribute.
//
// None of the public mines (HumanMine, FlyMine) nor the rdfc2im demo mine has an attribute
// of that type (their models have only String, Integer, Double, Boolean and Clob), so these
// tests are tagged @external and need CYPRESS_EXTERNAL=true, and a mine with a date: they
// use the first class of the mine's model that has a Date attribute with data and are
// skipped, with the reason in the log, when there is none. To run them,
// script/date-mock-mine.js puts a Date attribute (Gene.lastReviewed) and the evaluation of
// date constraints in front of the demo mine:
//
//   node script/date-mock-mine.js 8095
//   BLUEGENES_DEFAULT_SERVICE_ROOT=http://localhost:8095/humanmine ... (BlueGenes on port 5081)
//   CYPRESS_EXTERNAL=true CYPRESS_BASE_URL=http://localhost:5081 \
//     CYPRESS_MINE_URL=http://localhost:8095/humanmine npx cypress run --spec cypress/integration/date_constraint_test.js
//
// What the mine should answer is not written down here but computed from its data, with
// the semantics of InterMine (MainHelper.makeQueryDateConstraint): the comparison is on
// the day, and a null date satisfies no comparison, not even !=.

// The operators the interface offers for a date, with the way they are written in query XML.
const OPERATORS = [
  { op: "=", xml: "=" },
  { op: "!=", xml: "!=" },
  { op: "<", xml: "&lt;" },
  { op: "<=", xml: "&lt;=" },
  { op: ">", xml: "&gt;" },
  { op: ">=", xml: "&gt;=" },
];

const compare = {
  "=": (r, d) => r === d,
  "!=": (r, d) => r !== d,
  "<": (r, d) => r < d,
  "<=": (r, d) => r <= d,
  ">": (r, d) => r > d,
  ">=": (r, d) => r >= d,
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// {cls, attr, path, clsLabel, attrLabel, dateNames (of all date attributes), dates: [{id, date}],
// distinct: [sorted dates], d1, d2}
// or null when the mine has no date to test with.
let target = null;

// How many objects have a date for which `op` holds against `day` (ISO strings compare like dates).
const expected = (op, day) => target.dates.filter(({ date }) => date !== null && compare[op](date, day)).length;
const expectedNull = () => target.dates.filter(({ date }) => date === null).length;
const showAll = (n) => new RegExp(`Show All ${n} Rows?`, "i");

// The queries the browser sent to the mine's query service, with the HTTP status of the answer.
let requests = [];
const lastQueryWith = (fragment) => requests.filter((r) => r.query.includes(fragment));

const pickTarget = (model) => {
  const candidates = [];
  Object.values(model.classes).forEach((c) => {
    Object.values(c.attributes || {}).forEach((a) => {
      if (a.type === "java.util.Date") candidates.push({ cls: c.name, clsLabel: c.displayName, attr: a.name, attrLabel: a.displayName });
    });
  });
  return candidates;
};

// Looks for a class with data in a date attribute; sets `target` or leaves it null.
const findTarget = () => {
  target = null;
  cy.request(mineService("model?format=json")).then(({ body }) => {
    const model = body.model;
    const candidates = pickTarget(model);
    cy.log(`${candidates.length} date attribute(s) in the model of ${model.name}`);
    const tryNext = (i) => {
      if (i >= candidates.length || target) return;
      const c = candidates[i];
      const path = `${c.cls}.${c.attr}`;
      cy.request({
        method: "POST",
        url: mineService("query/results"),
        form: true,
        body: { query: `<query model="${model.name}" view="${c.cls}.id ${path}"></query>`, format: "json" },
        failOnStatusCode: false,
      }).then((res) => {
        const rows = res.status === 200 ? res.body.results : [];
        const dates = rows.map(([id, date]) => ({ id, date }));
        const distinct = [...new Set(dates.map((d) => d.date).filter((d) => d !== null))].sort();
        if (distinct.length >= 3) {
          // A day in the middle of the data: every operator has something to select and to leave out.
          target = { ...c, path, model: model.name, dates, distinct, dateNames: candidates.map((x) => x.attr), d1: distinct[Math.floor(distinct.length / 2)], d2: distinct[Math.floor(distinct.length / 4)] };
          cy.log(`testing with ${path}: ${dates.length} objects, ${distinct.length} different dates, ${expectedNull()} without a date`);
        } else {
          tryNext(i + 1);
        }
      });
    };
    tryNext(0);
  });
};

const decode = (body) => {
  try {
    return new URLSearchParams(typeof body === "string" ? body : "").get("query") || "";
  } catch (e) {
    return "";
  }
};

describe("Date constraints", function () {
  before(function () {
    findTarget();
  });

  beforeEach(function () {
    if (!target) {
      cy.log("skipped: the mine has no Date attribute with data, see the header of this spec");
      this.skip();
    }
    requests = [];
    cy.intercept({ method: "POST", url: /\/service\/query\/results/ }, (req) => {
      const query = decode(req.body);
      req.continue((res) => requests.push({ query, status: res.statusCode, format: new URLSearchParams(req.body).get("format") }));
    });
  });

  // The query builder with the date attribute selected and its constraint open.
  const openConstraint = () => {
    cy.visit(minePage("/querybuilder"));
    cy.get(".model-browser-root").within(() => cy.selectFromDropdown(target.cls));
    cy.get(".model-browser").contains(".qb-label", new RegExp(`^${target.attrLabel}$`)).click();
    cy.get(".query-view-column").contains(".qb-label", new RegExp(`^${target.attrLabel}$`)).siblings(".icon-filter").click();
    cy.get("input.date-constraint-input").should("have.attr", "type", "date");
  };

  const showXml = () => {
    cy.contains(".nav-tabs a", "XML").click();
    return cy.get("pre").first();
  };

  // Every query with the date that the browser sent was understood by the mine (the queries of
  // the tools of the results page, which are not about the date, are not looked at).
  const noServiceErrors = () => {
    const withDate = requests.filter((r) => r.query.includes(target.path));
    expect(withDate.length, "queries with the date sent").to.be.greaterThan(0);
    withDate.forEach((r) => expect(r.status, r.query).to.eq(200));
  };

  itExternal("query builder: the date input applies every operator, with an ISO date in the query", function () {
    openConstraint();
    cy.get("input.date-constraint-input").type(target.d1);
    OPERATORS.forEach(({ op, xml }) => {
      cy.get("select.constraint-chooser").select(op);
      // The date stays when the operator changes and the number of rows is the one the data says.
      cy.get("input.date-constraint-input").should("have.value", target.d1);
      cy.contains("button", showAll(expected(op, target.d1))).should("exist");
      showXml().should("contain.text", `value="${target.d1}"`).and("contain.text", `op="${xml}"`);
    });
    cy.screenshot("im-7os.22-qb-date-constraint");
    cy.wrap(null).then(() => {
      OPERATORS.forEach(({ op, xml }) => {
        const sent = lastQueryWith(`op="${xml}"`).filter((r) => r.query.includes(`value="${target.d1}"`) && r.query.includes(target.path));
        expect(sent.length, `a query with ${op} ${target.d1}`).to.be.greaterThan(0);
      });
      noServiceErrors();
    });
  });

  itExternal("query builder: null and not null, and a date for which there are no objects", function () {
    openConstraint();
    cy.get("select.constraint-chooser").select("Null");
    cy.get("input.date-constraint-input").should("not.exist");
    cy.contains("button", showAll(expectedNull())).should("exist");
    cy.get("select.constraint-chooser").select("Not null");
    cy.contains("button", showAll(target.dates.length - expectedNull())).should("exist");
    // The date input is back, empty, with a comparison; a far away date selects nothing.
    cy.get("select.constraint-chooser").select(">");
    cy.get("input.date-constraint-input").should("have.attr", "type", "date").and("have.value", "");
    cy.get("input.date-constraint-input").type("2999-12-31");
    cy.contains("button", /Show All 0 Rows?|No results|0 rows/i).should("exist");
    cy.wrap(null).then(noServiceErrors);
  });

  itExternal("query builder: an empty date is no constraint and is not sent to the mine", function () {
    openConstraint();
    cy.get("input.date-constraint-input").type(target.d1);
    cy.get("select.constraint-chooser").select(">=");
    cy.contains("button", showAll(expected(">=", target.d1))).should("exist");
    cy.get("input.date-constraint-input").clear();
    cy.contains("button", showAll(target.dates.length)).should("exist");
    showXml().should("not.contain.text", "<constraint");
    cy.wrap(null).then(() => {
      requests.forEach((r) => expect(r.query, "empty date sent").not.to.match(/value=""/));
      noServiceErrors();
    });
  });

  itExternal("query builder: a date typed with the keyboard is applied without leaving the input", function () {
    openConstraint();
    cy.get("select.constraint-chooser").select("<");
    // Typing without any other event: no blur, no Enter, as when a date is picked in the calendar popup.
    cy.get("input.date-constraint-input").type(target.d2);
    cy.contains("button", showAll(expected("<", target.d2))).should("exist");
    cy.get("input.date-constraint-input").should("have.focus");
    showXml().should("contain.text", `value="${target.d2}"`);
    cy.wrap(null).then(noServiceErrors);
  });

  itExternal("query builder: a query with a date loaded from XML shows the date and runs", function () {
    const day = target.d1;
    const xml = `<query model="${target.model}" view="${target.path}" sortOrder="${target.path} asc"><constraint path="${target.path}" op="&gt;=" value="${day}"/></query>`;
    cy.visit(minePage("/querybuilder"));
    cy.get(".query-view-column").within(() => {
      cy.contains("Import from XML").click();
      cy.get("textarea.form-control").type(xml, { parseSpecialCharSequences: false, delay: 0 });
      cy.contains("Load query").click();
    });
    cy.get("input.date-constraint-input").should("have.attr", "type", "date").and("have.value", day);
    cy.get("select.constraint-chooser").should("have.value", ">=");
    cy.contains("button", showAll(expected(">=", day))).should("exist");
    cy.wrap(null).then(noServiceErrors);
  });

  itExternal("query builder: a value that is not an ISO date stays visible in a text input and is never reformatted", function () {
    const xml = `<query model="${target.model}" view="${target.path}"><constraint path="${target.path}" op="=" value="03/01/2015"/></query>`;
    cy.visit(minePage("/querybuilder"));
    cy.get(".query-view-column").within(() => {
      cy.contains("Import from XML").click();
      cy.get("textarea.form-control").type(xml, { parseSpecialCharSequences: false, delay: 0 });
      cy.contains("Load query").click();
    });
    cy.get("input.date-constraint-input").should("have.attr", "type", "text").and("have.value", "03/01/2015");
    // Correcting it to a date turns the input into the date input.
    cy.get("input.date-constraint-input").clear().type(target.d1);
    cy.get("input.date-constraint-input").should("have.attr", "type", "date").and("have.value", target.d1);
  });
  // ---- the results table (im-tables) ----

  // The results page of a query with the date attribute as its only column.
  const openResults = () => {
    cy.visit(minePage("/querybuilder"));
    cy.get(".model-browser-root").within(() => cy.selectFromDropdown(target.cls));
    cy.get(".model-browser").contains(".qb-label", new RegExp(`^${target.attrLabel}$`)).click();
    cy.contains("button", showAll(target.dates.length)).click();
    cy.url().should("include", "/results");
    cy.contains(new RegExp(`Showing 1 to \\d+ of ${target.dates.length} rows`)).should("exist");
    // The first click on the static toolbar (drawn before the mouse touches the table) reaches
    // the live table, so there is no need to wait for the interactive one.
    cy.get("table th .filter-icon").should("have.length", 1);
  };

  // The Apply button of the open filter dropdown. In the small window of Cypress the dropdown is
  // clipped by the page after a filter was removed from it, so the click is forced.
  const applyFilters = () => cy.get("input[type=submit]").click({ force: true });

  const openFilter = () => {
    cy.get("table th .filter-icon").first().click();
    return cy.get("table th .dropdown.open");
  };

  itExternal("results table: the column filter on the date filters the rows, shows the constraint, and clears", function () {
    openResults();
    openFilter().within(() => {
      cy.get("select").select(">=");
      cy.get("input.date-constraint-input").should("have.attr", "type", "date").type(target.d1);
      applyFilters();
    });
    cy.contains(new RegExp(`of ${expected(">=", target.d1)} rows`)).should("exist");
    cy.get("table th .filter-icon").first().should("have.class", "active-filter");
    // The constraint is shown as it was set.
    openFilter().within(() => {
      cy.contains("Active filters").should("exist");
      cy.get(".alert-success select").should("have.value", ">=");
      cy.get(".alert-success input.date-constraint-input").should("have.value", target.d1);
    });
    cy.screenshot("im-7os.22-column-filter-active");
    cy.wrap(null).then(() => {
      const sent = lastQueryWith(`value="${target.d1}"`).filter((r) => r.query.includes(`op="&gt;="`) && r.query.includes(target.path));
      expect(sent.length, "queries with the filter").to.be.greaterThan(0);
      noServiceErrors();
    });
    // Remove it: all the rows are back.
    cy.get("table th .dropdown.open").within(() => {
      cy.get(".constraint-delete").click();
      applyFilters();
    });
    cy.contains(new RegExp(`of ${target.dates.length} rows`)).should("exist");
    cy.get("table th .filter-icon").first().should("not.have.class", "active-filter");
    cy.screenshot("im-7os.22-column-filter-cleared");
  });

  itExternal("results table: every operator of the column filter, and null and not null", function () {
    openResults();
    const apply = (op, day) => {
      openFilter().within(() => {
        // New filter form: the last select and date input of the dropdown.
        cy.get(".alert-default select").select(op);
        if (day) cy.get(".alert-default input.date-constraint-input").clear().type(day);
        applyFilters();
      });
    };
    OPERATORS.forEach(({ op }) => {
      apply(op, target.d1);
      cy.contains(new RegExp(`of ${expected(op, target.d1)} rows`)).should("exist");
      openFilter().within(() => {
        cy.get(".constraint-delete").click();
        applyFilters();
      });
      cy.contains(new RegExp(`of ${target.dates.length} rows`)).should("exist");
    });
    apply("IS NULL");
    cy.contains(new RegExp(`of ${expectedNull()} rows`)).should("exist");
    cy.get("table td").should("contain.text", "NO VALUE");
    openFilter().within(() => {
      cy.get(".constraint-delete").click();
      applyFilters();
    });
    apply("IS NOT NULL");
    cy.contains(new RegExp(`of ${target.dates.length - expectedNull()} rows`)).should("exist");
    cy.get("table td").should("not.contain.text", "NO VALUE");
    cy.wrap(null).then(noServiceErrors);
  });

  itExternal("results table: sorting on the date puts the dates in order, rows without a date do not break it", function () {
    openResults();
    cy.get("table th .sort-icon").first().click();
    const dates = () => Cypress.$("table tbody tr td:first-child").toArray().map((td) => td.textContent.trim()).filter((t) => ISO.test(t));
    cy.get("table tbody tr").should("have.length.greaterThan", 1);
    cy.wrap(null).should(() => {
      expect(lastQueryWith(`sortOrder="${target.path} ASC"`).length, "ascending sort sent").to.be.greaterThan(0);
      const d = dates();
      expect(d.length, "dates shown").to.be.greaterThan(0);
      expect(d, "ascending").to.deep.eq([...d].sort());
    });
    cy.get("table th .sort-icon").first().click();
    cy.wrap(null).should(() => {
      expect(lastQueryWith(`sortOrder="${target.path} DESC"`).length, "descending sort sent").to.be.greaterThan(0);
      const d = dates();
      expect(d, "descending").to.deep.eq([...d].sort().reverse());
    });
    cy.wrap(null).then(noServiceErrors);
  });

  // ---- templates ----

  itExternal("template: a constraint on a date can be changed, and runs with the new date", function () {
    cy.request(mineService("templates?format=json")).then(({ body }) => {
      const found = Object.values(body.templates).find((t) =>
        (t.where || []).some((w) => w.editable && compare[w.op] && ISO.test(w.value || "") && target.dateNames.includes(w.path.split(".").pop())));
      if (!found) {
        cy.log("skipped: the mine has no template with an editable constraint on a date");
        this.skip();
      }
      const idx = found.where.findIndex((w) => w.editable && compare[w.op] && ISO.test(w.value || "") && target.dateNames.includes(w.path.split(".").pop()));
      const con = found.where[idx];
      const day = con.value === target.d2 ? target.d1 : target.d2;
      cy.visit(minePage("/templates"));
      cy.get(`#${found.name}`).contains("View").click();
      cy.get(`#${found.name}`).within(() => {
        cy.get("input.date-constraint-input").should("have.attr", "type", "date").and("have.value", con.value);
        cy.get("select.constraint-chooser").should("have.value", con.op);
        cy.get("input.date-constraint-input").type(day);
        cy.get("input.date-constraint-input").should("have.value", day);
        // The web service URL carries the date as it is.
        cy.get("input[readonly]").should(($i) => expect($i.val()).to.contain(`value${idx + 1}=${day}`));
        cy.contains("button.view-results", /View \d+ rows?/).should("exist");
      });
      cy.screenshot("im-7os.22-template-date");
      // The mine's own count of the template query with that date is the one the button shows.
      cy.wrap(null).should(() => {
        const counted = requests.filter((r) => r.format === "count" && r.query.includes(`value="${day}"`));
        expect(counted.length, "count query with the new date").to.be.greaterThan(0);
      });
      cy.wrap(null).then(() => {
        const q = requests.filter((r) => r.format === "count" && r.query.includes(`value="${day}"`)).pop().query;
        cy.request({ method: "POST", url: mineService("query/results"), form: true, body: { query: q, format: "count" } }).then((res) => {
          cy.get(`#${found.name} .view-results`).should("contain.text", `View ${res.body} row`);
        });
      });
      // An empty date is not sent to the mine.
      cy.get(`#${found.name} input.date-constraint-input`).clear();
      cy.get(`#${found.name} .view-results`).should(($b) => expect($b.text()).not.to.match(/View \d+ rows?/));
      cy.get(`#${found.name} input.date-constraint-input`).type(con.value);
      cy.get(`#${found.name} .view-results`).click();
      cy.url().should("include", "/results");
      cy.wrap(null).then(() => {
        noServiceErrors();
        requests.forEach((r) => expect(r.query, "empty date sent").not.to.match(/value=""/));
      });
    });
  });
});

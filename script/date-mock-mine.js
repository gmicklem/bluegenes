#!/usr/bin/env node
// A stand-in InterMine that has a Date attribute, for testing date constraints.
//
// Neither the demo mine nor the public HumanMine and FlyMine have an attribute of
// type java.util.Date (checked 16 Nov 2026: their models have only String, Integer,
// Double, Boolean and Clob attributes), so the UI for constraints on dates (the
// browser's <input type="date"> in the query builder, in template constraints and in
// the im-tables column filters) cannot be tested against them. This script puts a
// small web service in front of a real mine (the demo mine by default), forwards every
// request to it, and adds to it:
//
//   * Gene.lastReviewed, an attribute of type java.util.Date in the model. The value is
//     computed from the id of the gene: null when id % 4 == 0 (so that sorting and
//     filtering meet null dates), else 2015-01-01 plus (id % 400) days, so the 113 genes
//     of the demo mine have dates from 2015-01-01 to 2016-02-04, several on each day.
//   * the template Gene_Last_Reviewed (Gene.lastReviewed > 2015-06-01, editable).
//   * the evaluation of constraints, sorting and summaries on Gene.lastReviewed in
//     /service/query/results and /service/query/results/tablerows (formats json,
//     jsonrows, count, tsv, csv, and summaryPath), with the semantics of InterMine's
//     MainHelper.makeQueryDateConstraint: the value is a day in UTC ("yyyy-MM-dd", as
//     TypeUtil.stringToObject and ConstraintValueParser parse it), the comparison is on
//     the day, and a null date satisfies no comparison, not even !=. A value that is not
//     a date gets the status 400, as in InterMine. The dates in the answers are
//     "yyyy-MM-dd" (JSONResultsIterator). Only AND of constraints is evaluated: a
//     constraintLogic of the query is ignored when it has a constraint on the date.
//
// Usage: node script/date-mock-mine.js [port]
//   MOCK_PORT           port to listen on (default 8095)
//   MOCK_UPSTREAM       the real mine's webapp root (default http://localhost:8090/humanmine)
//   MOCK_PATH           path the mock is served under (default: the last segment of the upstream)
// BlueGenes then needs BLUEGENES_DEFAULT_SERVICE_ROOT=http://localhost:8095/humanmine
// and, for Cypress, CYPRESS_MINE_URL set to the same.
// The requests it gets are logged to stdout, one line each: the evidence of what the
// browser sent.
"use strict";
const http = require("http");

const PORT = Number(process.argv[2] || process.env.MOCK_PORT || 8095);
const UPSTREAM = (process.env.MOCK_UPSTREAM || "http://localhost:8090/humanmine").replace(/\/$/, "");
const MOUNT = "/" + (process.env.MOCK_PATH || UPSTREAM.split("/").pop());
const UPSTREAM_ORIGIN = new URL(UPSTREAM).origin;
const UPSTREAM_PATH = new URL(UPSTREAM).pathname.replace(/\/$/, "");

const DATE_CLASS = "Gene";
const DATE_PATH = "Gene.lastReviewed";
const DAY = 86400000;
const BASE = Date.UTC(2015, 0, 1);

const dateOf = (geneId) => (geneId % 4 === 0 ? null : BASE + (geneId % 400) * DAY);
const iso = (ms) => (ms === null ? null : new Date(ms).toISOString().slice(0, 10));

const TEMPLATE = {
  name: "Gene_Last_Reviewed",
  title: "Genes reviewed after a date",
  model: { name: "genomic" },
  select: ["Gene.primaryIdentifier", "Gene.symbol", DATE_PATH],
  dataTypes: ["java.lang.String", "java.lang.String", "java.util.Date"],
  comment: "",
  description: "Genes whose review date is after the given date (mock mine)",
  tags: ["im:public", "im:aspect:Genomics"],
  rank: "unranked",
  authorized: false,
  orderBy: [{ "Gene.symbol": "ASC" }],
  where: [{ path: DATE_PATH, op: ">", code: "A", editable: true, switchable: false, switched: "LOCKED", value: "2015-06-01" }],
};

const decodeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const attrs = (s) => {
  const out = {};
  for (const m of s.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = decodeXml(m[2]);
  return out;
};
const encAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Lower case, so that the headers of the real mine (also lower case, from fetch) replace them
// instead of being sent twice: a browser refuses "Access-Control-Allow-Origin: *, *".
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, X-Requested-With",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const send = (res, status, body, type = "application/json;charset=UTF-8") => {
  res.writeHead(status, { ...CORS, "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const fail = (res, status, message) =>
  send(res, status, { wasSuccessful: false, error: message, statusCode: status });

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

const upstreamUrl = (rest) => `${UPSTREAM_ORIGIN}${UPSTREAM_PATH}${rest}`;

// Same request to the real mine, answer streamed back.
async function proxy(req, res, rest, body) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  delete headers["accept-encoding"];
  let up;
  try {
    up = await fetch(upstreamUrl(rest), {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
    });
  } catch (e) {
    return fail(res, 502, `upstream ${UPSTREAM}: ${e.message}`);
  }
  const h = {};
  up.headers.forEach((v, k) => {
    if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) h[k] = v;
  });
  res.writeHead(up.status, { ...CORS, ...h });
  res.end(Buffer.from(await up.arrayBuffer()));
}

async function upstreamJson(rest, form) {
  const r = await fetch(upstreamUrl(rest), {
    method: form ? "POST" : "GET",
    headers: form ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
    body: form ? new URLSearchParams(form) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

// ---- the query ----

function parseQuery(xml) {
  const open = xml.match(/<query\b([^>]*)>/);
  if (!open) throw new Error("not a query");
  const q = attrs(open[1]);
  q.viewPaths = (q.view || "").split(/\s+/).filter(Boolean);
  q.sort = (q.sortOrder || "").trim().split(/\s+/).filter(Boolean);
  q.constraints = [...xml.matchAll(/<constraint\b[^>]*?(?:\/>|>[\s\S]*?<\/constraint>)/g)].map((m) => ({
    text: m[0],
    ...attrs(m[0].match(/<constraint\b([^>]*?)\/?>/)[1]),
  }));
  return { q, xml };
}

const cmp = {
  "=": (r, d) => r === d,
  "!=": (r, d) => r !== d,
  "<": (r, d) => r < d,
  "<=": (r, d) => r <= d,
  ">": (r, d) => r > d,
  ">=": (r, d) => r >= d,
};

// The date as the web service parses it: the whole value must be yyyy-MM-dd, or a time stamp
// "yyyy-MM-dd HH:mm:ss" (the time is ignored), or milliseconds.
function parseDate(value) {
  if (/^\d+$/.test(value || "")) return Math.floor(Number(value) / DAY) * DAY;
  const m = /^(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2}:\d{2})?$/.exec(value || "");
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

async function handleQuery(req, res, rest, params) {
  const queryXml = params.get("query") || "";
  if (!queryXml.includes(DATE_PATH)) return false; // nothing to do with the date: plain proxy
  let parsed;
  try {
    parsed = parseQuery(queryXml);
  } catch (e) {
    return fail(res, 400, e.message) || true;
  }
  const { q } = parsed;
  const dateCons = q.constraints.filter((c) => c.path === DATE_PATH);
  const checks = [];
  for (const c of dateCons) {
    if (c.op === "IS NULL") checks.push((r) => r === null);
    else if (c.op === "IS NOT NULL") checks.push((r) => r !== null);
    else if (cmp[c.op]) {
      const d = parseDate(c.value);
      if (d === null) {
        fail(res, 400, `Failed to parse "${c.value || ""}" as a Date (expected yyyy-MM-dd)`);
        return true;
      }
      checks.push((r) => r !== null && cmp[c.op](r, d));
    } else {
      fail(res, 400, `Unknown ConstraintOp: ${c.op}`);
      return true;
    }
  }

  const summaryPath = params.get("summaryPath");
  const view = summaryPath ? [summaryPath] : q.viewPaths;
  // The query the real mine can answer: no date in the view, the sort order or the constraints, and
  // the id of the gene as a column (once, whether or not the view has it too).
  const realPaths = [...new Set(view.filter((p) => p !== DATE_PATH).concat(["Gene.id"]))];
  const col = Object.fromEntries(realPaths.map((p, i) => [p, i]));
  let realXml = queryXml;
  for (const c of dateCons) realXml = realXml.replace(c.text, "");
  const realSort = [];
  for (let i = 0; i < q.sort.length; i += 2) if (q.sort[i] !== DATE_PATH) realSort.push(q.sort[i], q.sort[i + 1] || "asc");
  realXml = realXml.replace(/\sview="[^"]*"/, ` view="${encAttr(realPaths.join(" "))}"`);
  realXml = /\ssortOrder="/.test(realXml)
    ? realXml.replace(/\ssortOrder="[^"]*"/, realSort.length ? ` sortOrder="${encAttr(realSort.join(" "))}"` : "")
    : realXml;
  if (dateCons.length) realXml = realXml.replace(/\sconstraintLogic="[^"]*"/, "");

  const fmt = rest.endsWith("/tablerows") ? "tablerows" : params.get("format") || "tsv";
  const up = await upstreamJson("/service/query/results", { query: realXml, format: "jsonrows", size: "100000", start: "0" });
  if (up.status !== 200 || !up.json) {
    send(res, up.status, up.json || { wasSuccessful: false, error: "upstream failed", statusCode: up.status });
    return true;
  }

  // Original column order, one cell per view path.
  const dateCell = (id, v) => ({ column: DATE_PATH, id, class: DATE_CLASS, value: iso(v), url: `/report.do?id=${id}` });
  let rows = up.json.results.map((cells) => {
    const geneId = cells[col["Gene.id"]].value;
    return { geneId, date: dateOf(geneId), cells: view.map((p) => (p === DATE_PATH ? dateCell(geneId, dateOf(geneId)) : cells[col[p]])) };
  });
  rows = rows.filter((r) => checks.every((f) => f(r.date)));
  if (q.sort[0] === DATE_PATH && !summaryPath) {
    const desc = (q.sort[1] || "asc").toLowerCase() === "desc";
    // PostgreSQL: nulls last when ascending, first when descending.
    const key = (r) => (r.date === null ? Infinity : r.date);
    rows = rows
      .map((r, i) => [r, i])
      .sort(([a, i], [b, j]) => {
        const ka = key(a), kb = key(b);
        if (ka === kb) return i - j;
        return (ka < kb ? -1 : 1) * (desc ? -1 : 1);
      })
      .map(([r]) => r);
  }

  const start = Number(params.get("start") || 0);
  const size = params.get("size") ? Number(params.get("size")) : Infinity;
  const headers = view.map((p) => (p === DATE_PATH ? "Gene > Last Reviewed" : up.json.columnHeaders[col[p]]));
  const meta = { modelName: "genomic", columnHeaders: headers, rootClass: q.viewPaths[0] && q.viewPaths[0].split(".")[0], start, views: view };
  const tail = { executionTime: new Date().toISOString(), wasSuccessful: true, error: null, statusCode: 200 };

  if (summaryPath) {
    const counts = new Map();
    for (const r of rows) {
      const v = r.cells[0].value;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const items = [...counts].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count || String(a.item).localeCompare(String(b.item)));
    send(res, 200, { uniqueValues: items.length, ...meta, columnHeaders: ["item", "count"], results: items.slice(start, start + size), ...tail });
    return true;
  }
  const page = rows.slice(start, start + size);
  if (fmt === "count") send(res, 200, String(rows.length), "text/plain;charset=UTF-8");
  else if (fmt === "tablerows") send(res, 200, { ...meta, iTotalRecords: rows.length, results: page.map((r) => r.cells), ...tail });
  else if (fmt === "jsonrows") send(res, 200, { ...meta, results: page.map((r) => r.cells), ...tail });
  else if (fmt === "json") send(res, 200, { ...meta, results: page.map((r) => r.cells.map((c) => c.value)), ...tail });
  else if (fmt === "tsv" || fmt === "csv") {
    const sep = fmt === "tsv" ? "\t" : ",";
    const text = page.map((r) => r.cells.map((c) => (c.value === null ? "" : String(c.value))).join(sep)).join("\n") + "\n";
    send(res, 200, text, fmt === "tsv" ? "text/tab-separated-values" : "text/csv");
  } else fail(res, 400, `the mock mine does not know the format ${fmt}`);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock");
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (!url.pathname.startsWith(MOUNT + "/") && url.pathname !== MOUNT) return fail(res, 404, "not under " + MOUNT);
  const rest = url.pathname.slice(MOUNT.length) + url.search;
  const body = await readBody(req);
  const params = new URLSearchParams(url.search);
  if (/form-urlencoded/.test(req.headers["content-type"] || "")) for (const [k, v] of new URLSearchParams(body.toString())) params.set(k, v);
  const route = url.pathname.slice(MOUNT.length);
  const brief = route === "/service/query/results" || route === "/service/query/results/tablerows"
    ? `${req.method} ${route} format=${params.get("format")} start=${params.get("start")} size=${params.get("size")} summaryPath=${params.get("summaryPath")} query=${(params.get("query") || "").replace(/\s+/g, " ")}`
    : `${req.method} ${route}${url.search}`;
  if (/lastReviewed|\/query\//.test(brief) || /model|templates/.test(route)) console.log(new Date().toISOString(), brief);
  try {
    if (route === "/service/model" && params.get("format") === "json") {
      const r = await upstreamJson("/service/model?format=json");
      r.json.model.classes[DATE_CLASS].attributes.lastReviewed = { name: "lastReviewed", displayName: "Last Reviewed", type: "java.util.Date" };
      return send(res, 200, r.json);
    }
    if (route === "/service/templates" && (params.get("format") || "json") === "json") {
      const r = await upstreamJson("/service/templates?format=json");
      r.json.templates[TEMPLATE.name] = TEMPLATE;
      return send(res, 200, r.json);
    }
    if (route === "/service/query/results" || route === "/service/query/results/tablerows") {
      if (await handleQuery(req, res, route, params)) return;
    }
    return await proxy(req, res, rest, body);
  } catch (e) {
    console.error(e);
    return fail(res, 500, String(e));
  }
});
server.listen(PORT, () => console.log(`date mock mine on http://localhost:${PORT}${MOUNT}, upstream ${UPSTREAM}`));

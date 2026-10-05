import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/SHASHANK KAKAD/Documents/projects/Invaria";
const skillDir = "C:/Users/SHASHANK KAKAD/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const tmpDir = path.join(workspaceDir, ".presentation-build");
const assetDir = path.join(tmpDir, "assets");
const finalDir = path.join(workspaceDir, "presentation-output");
const finalPath = path.join(finalDir, "Invaria_Review_Deck_Final.pptx");
const stagingDir = path.join(workspaceDir, ".codex-finalizer");

const { resolvePresentationFont, applyPresentationChartFont, finalizePresentation } = await import(
  pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href,
);

await fs.mkdir(tmpDir, { recursive: true });
await fs.mkdir(finalDir, { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });

const font = resolvePresentationFont();
const W = 1280;
const H = 720;
const C = {
  ink: "#121522",
  muted: "#626A7C",
  purple: "#5646E8",
  purple2: "#7C71FF",
  lavender: "#F1F0FF",
  mist: "#F7F8FC",
  line: "#DEE1EC",
  orange: "#C36A12",
  orangePale: "#FFF3E4",
  teal: "#087A71",
  tealPale: "#E7F7F4",
  red: "#C23B59",
  white: "#FFFFFF",
  darkPanel: "#12131E",
};

function shape(slide, opts) {
  return slide.shapes.add({
    geometry: opts.geometry ?? "textbox",
    position: opts.position,
    fill: opts.fill ?? "none",
    line: opts.line ?? { fill: "none", width: 0 },
    ...(opts.borderRadius ? { borderRadius: opts.borderRadius } : {}),
    ...(opts.shadow ? { shadow: opts.shadow } : {}),
    ...(opts.name ? { name: opts.name } : {}),
  });
}

function text(slide, value, x, y, w, h, options = {}) {
  const s = shape(slide, {
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
    name: options.name,
  });
  s.text = value;
  s.text.style = {
    typeface: font,
    fontSize: options.size ?? 20,
    color: options.color ?? C.ink,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    alignment: options.align ?? "left",
    verticalAlignment: options.valign ?? "top",
    autoFit: "shrinkText",
    lineSpacing: options.lineSpacing ?? 1.12,
    insets: options.insets ?? { top: 0, bottom: 0, left: 0, right: 0 },
  };
  return s;
}

function rect(slide, x, y, w, h, fill, options = {}) {
  return shape(slide, {
    geometry: options.geometry ?? "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: options.line ?? { fill: "none", width: 0 },
    borderRadius: options.borderRadius ?? "rounded-xl",
    shadow: options.shadow,
    name: options.name,
  });
}

function rule(slide, x, y, w, color = C.line, width = 1) {
  return shape(slide, {
    geometry: "line",
    position: { left: x, top: y, width: w, height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function badge(slide, value, x, y, w, fill = C.lavender, color = C.purple) {
  rect(slide, x, y, w, 28, fill, { borderRadius: "rounded-full" });
  text(slide, value.toUpperCase(), x + 10, y + 6, w - 20, 16, { size: 11, bold: true, color, align: "center" });
}

function footer(slide, page, source) {
  rule(slide, 72, 670, 1136, C.line, 1);
  text(slide, "INVARIA  |  REVIEW PRESENTATION", 72, 686, 450, 15, { size: 10, bold: true, color: C.muted });
  text(slide, source, 450, 686, 650, 15, { size: 9, color: C.muted, align: "center" });
  text(slide, String(page).padStart(2, "0"), 1140, 684, 68, 18, { size: 11, bold: true, color: C.purple, align: "right" });
}

function baseSlide(presentation, page, source) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  footer(slide, page, source);
  return slide;
}

async function imageBytes(name) {
  return new Uint8Array(await fs.readFile(path.join(assetDir, name)));
}

function addImage(slide, bytes, x, y, w, h, alt, options = {}) {
  return slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit: options.fit ?? "cover",
    position: { left: x, top: y, width: w, height: h },
    geometry: "roundRect",
    borderRadius: options.borderRadius ?? "rounded-xl",
    ...(options.crop ? { crop: options.crop } : {}),
  });
}

function note(slide, value) {
  slide.speakerNotes.textFrame.setText(value);
}

const business = await imageBytes("business.png");
const graph = await imageBytes("graph.png");
const ledger = await imageBytes("decision-ledger.png");

const p = Presentation.create({ slideSize: { width: W, height: H } });

// 01 — Problem and gap
{
  const s = baseSlide(p, 1, "Sources: Invaria blueprint and INVARIANT engine design");
  badge(s, "Problem statement & market gap", 72, 54, 300);
  text(s, "Security failures happen\nwhen code breaks business rules", 72, 103, 635, 130, { size: 49, bold: true, color: C.ink, lineSpacing: 0.98 });
  text(s, "Modern applications often authenticate users correctly yet fail to keep authorization, ownership, and workflow constraints consistent across routes, services, and data stores.", 72, 252, 625, 78, { size: 20, color: C.muted, lineSpacing: 1.22 });
  rule(s, 72, 362, 590, C.purple, 3);

  text(s, "THE REVIEW GAP", 72, 395, 235, 18, { size: 12, bold: true, color: C.purple });
  text(s, "A line-level alert or a general coding-model answer rarely preserves the application policy, the inspected evidence, and the remaining uncertainty in one place.", 72, 425, 580, 67, { size: 22, bold: true, color: C.ink, lineSpacing: 1.18 });
  text(s, "Invaria treats a security finding as a structured case: expected invariant, source-backed path, evidence gate, and a human review decision.", 72, 520, 600, 52, { size: 18, color: C.muted, lineSpacing: 1.18 });

  rect(s, 752, 81, 456, 500, C.darkPanel, { borderRadius: "rounded-3xl" });
  text(s, "INVARIA'S UNIT OF WORK", 790, 120, 300, 18, { size: 12, bold: true, color: C.purple2 });
  text(s, "The security case", 790, 157, 345, 46, { size: 30, bold: true, color: C.white });
  const lines = [
    ["Policy", "What must always be true"],
    ["Path", "How a request reaches sensitive data or action"],
    ["Proof", "Which source evidence supports the hypothesis"],
    ["Decision", "What remains for a reviewer to validate"],
  ];
  lines.forEach(([a, b], i) => {
    const y = 232 + i * 67;
    text(s, String(i + 1).padStart(2, "0"), 790, y + 3, 30, 20, { size: 13, bold: true, color: C.purple2 });
    text(s, a, 834, y, 100, 21, { size: 17, bold: true, color: C.white });
    text(s, b, 834, y + 26, 310, 25, { size: 14, color: "#BEC4D5" });
    if (i < lines.length - 1) rule(s, 790, y + 56, 340, "#303347", 1);
  });
  text(s, "Not a claim of a breach. A traceable basis for review.", 790, 530, 355, 30, { size: 14, italic: true, color: "#BEC4D5" });
  note(s, "Source: Invaria Engineering & Product Blueprint; docs/INVARIANT_ENGINE.md.\n\nTalking points: The core problem is not only finding suspicious code. A reviewer needs to see what business rule might be broken, how the source path supports the concern, and what remains unknown. Invaria is built around that security case.");
}

// 02 — Market opportunity
{
  const s = baseSlide(p, 2, "Source: Grand View Research, Application Security Market, 2026–2033");
  badge(s, "Market opportunity", 72, 54, 180);
  text(s, "Application security is a growing\ncategory with a clear entry point", 72, 102, 670, 105, { size: 43, bold: true, color: C.ink, lineSpacing: 1.0 });
  text(s, "Invaria begins with API-driven products where a broken ownership or business-flow rule can directly affect money, tenant data, or regulated records.", 72, 228, 620, 55, { size: 19, color: C.muted, lineSpacing: 1.2 });

  const chart = s.charts.add("bar", {
    position: { left: 72, top: 322, width: 580, height: 286 },
    categories: ["2025", "2026", "2033"],
    series: [{ name: "USD billions", values: [10.6, 12.6, 42.1], fill: C.purple }],
    barOptions: { direction: "column", grouping: "clustered" },
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd" },
  });
  applyPresentationChartFont(chart, { fontFamily: font });
  text(s, "Global application security market, USD billions", 72, 300, 520, 18, { size: 13, bold: true, color: C.muted });

  rect(s, 736, 104, 472, 464, C.mist, { borderRadius: "rounded-3xl" });
  text(s, "WHERE INVARIA FITS", 776, 142, 250, 18, { size: 12, bold: true, color: C.purple });
  text(s, "Initial wedge", 776, 180, 210, 28, { size: 23, bold: true, color: C.ink });
  text(s, "JavaScript and TypeScript teams building multi-tenant SaaS and API products, especially when a dedicated application-security team is unavailable.", 776, 220, 360, 78, { size: 18, color: C.muted, lineSpacing: 1.2 });
  rule(s, 776, 328, 350, C.line, 1);
  text(s, "Why now", 776, 357, 210, 28, { size: 23, bold: true, color: C.ink });
  text(s, "AI-assisted delivery speeds up code creation. Security review still needs evidence that a system preserves its access and workflow rules.", 776, 397, 360, 64, { size: 18, color: C.muted, lineSpacing: 1.2 });
  rule(s, 776, 490, 350, C.line, 1);
  text(s, "Market context", 776, 519, 180, 19, { size: 15, bold: true, color: C.ink });
  text(s, "$10.6B in 2025  ·  $42.1B projected for 2033  ·  18.8% CAGR", 776, 548, 380, 22, { size: 15, bold: true, color: C.purple });
  text(s, "Category sizing is market context, not a revenue forecast for Invaria.", 72, 624, 945, 19, { size: 12, italic: true, color: C.muted });
  note(s, "Source: Grand View Research, ‘Application Security Market (2026–2033)’, accessed 24 September 2026: https://www.grandviewresearch.com/industry-analysis/application-security-market.\n\nData: Global application security market $10.6B in 2025, $12.6B estimate in 2026, $42.1B projected in 2033, CAGR 18.8% (2026–2033).\n\nTalking points: The market number gives category context. Our initial addressable use case is narrower: API-driven, multi-tenant applications with sensitive data or sensitive business actions.");
}

// 03 — Platform
{
  const s = baseSlide(p, 3, "Screenshot: live local Invaria workspace, captured 24 Sep 2026");
  badge(s, "The platform", 72, 54, 128);
  text(s, "Invaria turns a repository into\nan inspectable security case", 72, 102, 620, 98, { size: 42, bold: true, color: C.ink, lineSpacing: 1.0 });
  text(s, "The product connects a repository snapshot to application structure, evidence-backed security hypotheses, and a review workflow that speaks in technical and business terms.", 72, 223, 592, 64, { size: 19, color: C.muted, lineSpacing: 1.2 });
  addImage(s, business, 696, 89, 512, 355, "Live Invaria business-risk workspace");
  text(s, "LIVE PRODUCT VIEW", 704, 454, 190, 18, { size: 11, bold: true, color: C.purple });
  text(s, "A reviewer can start from business impact, then open the decision ledger and exact source evidence.", 704, 480, 470, 38, { size: 15, color: C.muted });

  const steps = [
    ["1", "Snapshot", "Immutable code input"],
    ["2", "Model", "Routes, handlers, data paths"],
    ["3", "Investigate", "Rule-specific hypotheses"],
    ["4", "Review", "Evidence, uncertainty, action"],
  ];
  steps.forEach(([n, a, b], i) => {
    const x = 72 + i * 154;
    text(s, n, x, 360, 26, 20, { size: 13, bold: true, color: C.purple });
    text(s, a, x, 388, 136, 23, { size: 17, bold: true, color: C.ink });
    text(s, b, x, 417, 135, 38, { size: 13, color: C.muted, lineSpacing: 1.12 });
    if (i < 3) rule(s, x + 111, 372, 35, C.purple2, 2);
  });
  rule(s, 72, 498, 560, C.line, 1);
  text(s, "Where it differs from a standalone coding assistant", 72, 524, 560, 24, { size: 18, bold: true, color: C.ink });
  text(s, "Invaria makes the policy, evidence gate, coverage boundary, and human decision persistent product objects. The model remains a replaceable, advisory component.", 72, 558, 565, 52, { size: 16, color: C.muted, lineSpacing: 1.18 });
  note(s, "Screenshot: live local Invaria workspace captured 24 September 2026.\n\nSources for competitive boundary: OpenAI, ‘Codex Security: now in research preview’, https://openai.com/index/codex-security-now-in-research-preview/; Anthropic, ‘Making frontier cybersecurity capabilities available to defenders’, https://www.anthropic.com/news/claude-code-security.\n\nTalking points: Codex Security and Claude Code Security now offer serious security analysis. Invaria should not claim an unproven performance advantage. Its product differentiation is the versioned, inspectable policy and decision ledger that do not depend on one model provider.");
}

// 04 — Engine stages
{
  const s = baseSlide(p, 4, "Source: docs/INVARIANT_ENGINE.md and current implementation");
  badge(s, "Core algorithm", 72, 54, 150);
  text(s, "INVARIANT: a security-decision engine", 72, 105, 785, 53, { size: 43, bold: true, color: C.ink });
  text(s, "Invariant-based Networked Verification and Attack-path Reasoning defines the conditions under which a code pattern becomes a reported finding.", 72, 174, 895, 43, { size: 19, color: C.muted, lineSpacing: 1.2 });

  const stages = [
    ["01", "Model", "Parse routes, functions, queries, identities, and trust boundaries"],
    ["02", "Hypothesis", "Ask a rule-specific question, such as BOLA001"],
    ["03", "Evidence", "Trace request flow and collect source snippets and controls"],
    ["04", "Gate", "Require the minimum evidence needed for that rule"],
    ["05", "Ledger", "Persist proof, conditions, coverage, and confidence basis"],
  ];
  const boxes = [];
  stages.forEach(([n, title, body], i) => {
    const x = 72 + i * 226;
    const box = rect(s, x, 286, 190, 194, i === 3 ? C.lavender : C.mist, { borderRadius: "rounded-2xl", line: { style: "solid", fill: i === 3 ? C.purple2 : C.line, width: i === 3 ? 2 : 1 } });
    boxes.push(box);
    text(s, n, x + 18, 307, 45, 18, { size: 12, bold: true, color: i === 3 ? C.purple : C.muted });
    text(s, title, x + 18, 343, 154, 27, { size: 22, bold: true, color: C.ink });
    text(s, body, x + 18, 385, 151, 68, { size: 15, color: C.muted, lineSpacing: 1.16 });
  });
  for (let i = 0; i < boxes.length - 1; i++) {
    s.shapes.connect(boxes[i], boxes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.purple2, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  }
  rect(s, 72, 535, 1136, 88, C.darkPanel, { borderRadius: "rounded-2xl" });
  text(s, "MODEL BOUNDARY", 98, 556, 160, 18, { size: 12, bold: true, color: C.purple2 });
  text(s, "RAG and the LLM can review a bounded evidence bundle. They cannot satisfy an evidence gate or replace missing source evidence.", 300, 553, 834, 38, { size: 21, bold: true, color: C.white, valign: "middle" });
  note(s, "Source: docs/INVARIANT_ENGINE.md; backend/invaria/algorithm.py; backend/invaria/pipeline.py.\n\nTalking points: An invariant describes what must stay true in the application. The algorithm creates a question from a rule and the application structure, collects source evidence, then applies a gate. The gate makes it impossible for model prose or RAG content to fill an evidence gap. The decision ledger retains why we reported or discarded the candidate.");
}

// 05 — Evidence gates
{
  const s = baseSlide(p, 5, "Screenshot: live INVARIANT decision ledger, captured 24 Sep 2026");
  badge(s, "Core algorithm", 72, 54, 150);
  text(s, "A BOLA finding must pass\nan evidence test", 72, 105, 560, 92, { size: 42, bold: true, color: C.ink, lineSpacing: 1.0 });
  text(s, "BOLA001 asks whether a request-controlled object reference reaches private data without a proven server-side ownership or tenant predicate.", 72, 220, 547, 54, { size: 18, color: C.muted, lineSpacing: 1.2 });

  rect(s, 72, 310, 548, 272, C.darkPanel, { borderRadius: "rounded-2xl" });
  text(s, "EXAMPLE PATH", 100, 338, 170, 17, { size: 12, bold: true, color: C.purple2 });
  text(s, "POST /api/wallet/withdraw", 100, 371, 415, 24, { size: 20, bold: true, color: C.white });
  text(s, "const wallet = getWallet(userId);\n\nlet wallet = data.wallets.find(\n  w => w.userId === userId\n);", 100, 414, 420, 115, { size: 16, color: "#D8DCEC", lineSpacing: 1.12 });
  text(s, "The engine follows request-derived data into the resolved local helper and inspects the lookup for a server-derived scope constraint.", 100, 544, 455, 25, { size: 13, italic: true, color: "#B7BED2" });

  addImage(s, ledger, 672, 87, 536, 503, "Live Invaria decision ledger for a potential BOLA finding", { fit: "cover", crop: { left: 0.58, top: 0, right: 0, bottom: 0 } });
  text(s, "The decision ledger states what was observed, which controls were proven, and what requires human validation.", 672, 604, 535, 30, { size: 14, color: C.muted, lineSpacing: 1.15 });
  text(s, "BOLA001: route + lookup  |  BFL001: route + mutation  |  INJ001: route + sink  |  SEC001: credential literal", 72, 621, 865, 18, { size: 12, bold: true, color: C.purple });
  note(s, "Screenshot: live Invaria decision ledger captured 24 September 2026. Source: docs/INVARIANT_ENGINE.md; backend/invaria/algorithm.py.\n\nTalking points: BOLA is broken object-level authorization. In this candidate the record selection depends on request-controlled input. The tool identifies the route, the helper flow, and the lookup. It checks for a recognized server-side owner or tenant constraint. The evidence gate passes only when route and lookup evidence are both present. Passing the gate produces a source-backed candidate, not confirmation of exploitation.");
}

// 06 — Real-life example
{
  const s = baseSlide(p, 6, "Screenshot: live public TaskForge scan; source-backed candidate, not a confirmed breach");
  badge(s, "Real-life example", 72, 54, 160);
  text(s, "A marketplace authorization path", 72, 105, 680, 49, { size: 43, bold: true, color: C.ink });
  text(s, "In a multi-tenant marketplace, a participant should only access lender records they own or are permitted to view.", 72, 174, 655, 42, { size: 19, color: C.muted, lineSpacing: 1.2 });
  addImage(s, graph, 72, 260, 704, 336, "Invaria relationship graph for GET /api/lenders/:id", { fit: "cover" });
  text(s, "Live relationship graph: GET /api/lenders/:id", 72, 608, 480, 18, { size: 12, bold: true, color: C.purple });

  text(s, "Expected invariant", 844, 278, 280, 25, { size: 20, bold: true, color: C.ink });
  text(s, "The actor's identity or tenant scope must constrain access to the lender record.", 844, 314, 330, 48, { size: 17, color: C.muted, lineSpacing: 1.18 });
  rule(s, 844, 386, 315, C.line, 1);
  text(s, "Observed source path", 844, 409, 280, 25, { size: 20, bold: true, color: C.ink });
  text(s, "Route receives id  →  inline handler  →  data.lenders.find  →  data.lenders", 844, 446, 330, 62, { size: 17, bold: true, color: C.purple, lineSpacing: 1.2 });
  rule(s, 844, 529, 315, C.line, 1);
  text(s, "Review decision", 844, 552, 280, 23, { size: 20, bold: true, color: C.ink });
  text(s, "The reviewer checks whether a server-derived ownership or tenant predicate scopes the lookup. If the source does not prove it, Invaria reports the condition and uncertainty.", 844, 586, 345, 52, { size: 16, color: C.muted, lineSpacing: 1.15 });
  text(s, "The same method applies to wallet, refund, patient-record, and admin-action workflows.", 72, 638, 820, 18, { size: 13, italic: true, color: C.muted });
  note(s, "Screenshot: live scan of the public TaskForge repository captured 24 September 2026.\n\nTalking points: This is an example of a real repository scan, but it is not an allegation of a confirmed vulnerability or breach. The graph shows the route, request input, handler, query, and data model. Invaria turns the graph into an explicit authorization question that a human can validate against intended policy and controls.");
}

// 07 — Customer
{
  const s = baseSlide(p, 7, "Source: Invaria blueprint; target segments are prospective");
  badge(s, "Target customers", 72, 54, 155);
  text(s, "Who needs evidence-backed\nsecurity review first", 72, 105, 585, 93, { size: 43, bold: true, color: C.ink, lineSpacing: 1.0 });
  text(s, "The first customers share a common risk: their applications make sensitive access or business decisions faster than a small team can manually review them.", 72, 222, 580, 64, { size: 19, color: C.muted, lineSpacing: 1.2 });

  const segs = [
    ["AI-built SaaS", "CTO or engineering lead", "Tenant isolation, sensitive APIs, rapid release cycles", C.purple, C.lavender],
    ["Fintech & payments", "Security or platform lead", "Refunds, balances, transfers, and state-changing actions", C.orange, C.orangePale],
    ["Health software", "Product security lead", "Patient ownership, role-based access, data exposure", C.teal, C.tealPale],
    ["Internal platforms", "Platform or IT lead", "Privileged workflows, employee data, uneven security coverage", C.red, "#FCECEF"],
  ];
  segs.forEach(([name, buyer, risk, col, pale], i) => {
    const y = 337 + i * 69;
    rect(s, 72, y, 104, 47, pale, { borderRadius: "rounded-xl" });
    text(s, name, 85, y + 11, 79, 28, { size: 14, bold: true, color: col, align: "center", valign: "middle" });
    text(s, buyer, 204, y + 1, 230, 22, { size: 17, bold: true, color: C.ink });
    text(s, risk, 204, y + 27, 460, 22, { size: 14, color: C.muted });
    rule(s, 72, y + 58, 594, C.line, 1);
  });

  rect(s, 747, 108, 461, 500, C.darkPanel, { borderRadius: "rounded-3xl" });
  text(s, "FIRST SALES WEDGE", 788, 151, 250, 18, { size: 12, bold: true, color: C.purple2 });
  text(s, "API-driven\nmultitenant products", 788, 193, 330, 66, { size: 34, bold: true, color: C.white, lineSpacing: 1.0 });
  text(s, "Start with JavaScript or TypeScript teams that need to demonstrate control over access paths and business logic before they can hire a mature AppSec function.", 788, 292, 333, 85, { size: 18, color: "#C4C9D9", lineSpacing: 1.22 });
  rule(s, 788, 420, 325, "#363A4D", 1);
  text(s, "Primary buyer", 788, 450, 200, 19, { size: 14, bold: true, color: C.purple2 });
  text(s, "CTO / VP Engineering / Product Security Lead", 788, 482, 320, 24, { size: 18, bold: true, color: C.white });
  text(s, "Value delivered", 788, 528, 190, 18, { size: 14, bold: true, color: C.purple2 });
  text(s, "A path from suspicious code to an accountable security decision.", 788, 555, 332, 28, { size: 16, color: "#C4C9D9" });
  note(s, "Source: Invaria Engineering & Product Blueprint.\n\nTalking points: These are target segments, not named customers or current contracts. We start where the consequences of a policy failure are tangible and teams have limited application-security bandwidth. The wedge is API-driven, multi-tenant SaaS because ownership and authorization flows are common and inspectable.");
}

// 08 — Roadmap
{
  const s = baseSlide(p, 8, "Source: docs/ROADMAP.md and docs/INVARIANT_ENGINE.md");
  badge(s, "Development stages & future scope", 72, 54, 285);
  text(s, "The path from a working engine\nto trusted security coverage", 72, 105, 715, 93, { size: 43, bold: true, color: C.ink, lineSpacing: 1.0 });
  text(s, "The roadmap prioritizes measurable accuracy and clear coverage boundaries before product breadth.", 72, 221, 720, 30, { size: 19, color: C.muted });

  const phases = [
    ["NOW", "Vertical slice", "JS/TS Express parsing; BOLA, sensitive business-flow, injection and credential hypotheses; decision ledger; review workflow", C.purple, C.lavender],
    ["NEXT", "Stronger policy verification", "Typed actor and tenant policies; framework and ORM adapters; call/return propagation; dominance-aware authorization", C.orange, C.orangePale],
    ["THEN", "Workflow and validation", "Multi-step state transitions; held-out evaluation; approved sandbox validation; remediation proposals and incremental scans", C.teal, C.tealPale],
  ];
  const phaseBoxes = [];
  phases.forEach(([tag, title, body, col, pale], i) => {
    const x = 72 + i * 382;
    const b = rect(s, x, 324, 340, 229, pale, { borderRadius: "rounded-2xl", line: { style: "solid", fill: C.line, width: 1 } });
    phaseBoxes.push(b);
    badge(s, tag, x + 24, 348, 76, pale, col);
    text(s, title, x + 24, 396, 286, 28, { size: 22, bold: true, color: C.ink });
    text(s, body, x + 24, 442, 286, 74, { size: 16, color: C.muted, lineSpacing: 1.2 });
  });
  for (let i = 0; i < phaseBoxes.length - 1; i++) {
    s.shapes.connect(phaseBoxes[i], phaseBoxes[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.purple2, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  }
  text(s, "Review focus: the next proof point is a frozen evaluation set showing where the engine reports correctly, where it does not, and what remains unsupported.", 72, 590, 998, 31, { size: 18, bold: true, color: C.ink, lineSpacing: 1.18 });
  text(s, "INVARIA", 72, 638, 116, 21, { size: 19, bold: true, color: C.purple });
  text(s, "Evidence first. Human judgment retained.", 205, 639, 400, 20, { size: 16, color: C.muted });
  note(s, "Source: docs/ROADMAP.md; docs/INVARIANT_ENGINE.md.\n\nTalking points: The implementation today is intentionally bounded. Future work should expand only behind measured regression gates. The priority is not a larger model or more agents; it is better policy verification, stronger data-flow evidence, evaluations on held-out cases, and safe validation in approved environments.");
}

const candidatePath = path.join(stagingDir, "Invaria_Review_Deck_Final_candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 8,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [2],
  materializeLiteralChartWorkbooks: true,
};
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/SHASHANK KAKAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Invaria_Review_Deck_Final.validation.json"),
});

const montage = await p.export({ format: "png", montage: true, scale: 1 });
await fs.writeFile(path.join(tmpDir, "deck-montage.png"), new Uint8Array(await montage.arrayBuffer()));
for (let i = 0; i < p.slides.length; i += 1) {
  const preview = await p.export({ slide: p.slides.get(i), format: "png", scale: 1.5 });
  await fs.writeFile(path.join(tmpDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await preview.arrayBuffer()));
}
console.log(JSON.stringify({ font, finalPath, candidatePath, result }, null, 2));

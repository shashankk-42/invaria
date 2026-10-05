import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const root = "C:/Users/SHASHANK KAKAD/Documents/projects/Invaria";
const skill = "C:/Users/SHASHANK KAKAD/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const build = path.join(root, ".presentation-build");
const assetDir = path.join(build, "assets");
const output = path.join(root, "presentation-output");
const staging = path.join(root, ".codex-finalizer");
const finalPath = path.join(output, "Invaria_Review_Deck_Simple.pptx");
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(path.join(skill, "container_tools", "artifact_tool_utils.mjs")).href);
await fs.mkdir(output, { recursive: true });
await fs.mkdir(staging, { recursive: true });
const font = resolvePresentationFont();
const C = { ink: "#121522", muted: "#667086", purple: "#5646E8", purple2: "#7C71FF", lavender: "#F1F0FF", mist: "#F7F8FC", line: "#DEE1EC", white: "#FFFFFF", dark: "#12131E", orange: "#C36A12", teal: "#087A71" };

function box(s, x, y, w, h, fill = "none", line = { fill: "none", width: 0 }, radius = "rounded-xl") {
  return s.shapes.add({ geometry: "roundRect", position: { left: x, top: y, width: w, height: h }, fill, line, borderRadius: radius });
}
function tx(s, value, x, y, w, h, o = {}) {
  const t = s.shapes.add({ geometry: "textbox", position: { left: x, top: y, width: w, height: h }, fill: "none", line: { fill: "none", width: 0 } });
  t.text = value;
  t.text.style = { typeface: font, fontSize: o.size ?? 20, color: o.color ?? C.ink, bold: o.bold ?? false, italic: o.italic ?? false, alignment: o.align ?? "left", verticalAlignment: o.valign ?? "top", autoFit: "shrinkText", lineSpacing: o.spacing ?? 1.15, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return t;
}
function line(s, x, y, w, color = C.line, width = 1) { return s.shapes.add({ geometry: "line", position: { left: x, top: y, width: w, height: 0 }, fill: "none", line: { style: "solid", fill: color, width } }); }
function label(s, value, x, y, w) { box(s, x, y, w, 28, C.lavender, { fill: "none", width: 0 }, "rounded-full"); tx(s, value.toUpperCase(), x + 9, y + 6, w - 18, 15, { size: 11, bold: true, color: C.purple, align: "center" }); }
function foot(s, n, source = "Source: Invaria Engineering & Product Blueprint") { line(s, 72, 670, 1136); tx(s, "INVARIA  |  REVIEW PRESENTATION", 72, 686, 300, 14, { size: 10, bold: true, color: C.muted }); tx(s, source, 420, 686, 680, 14, { size: 9, color: C.muted, align: "center" }); tx(s, String(n).padStart(2, "0"), 1140, 684, 68, 16, { size: 11, bold: true, color: C.purple, align: "right" }); }
function slide(n, source) { const s = p.slides.add(); s.background.fill = C.white; foot(s, n, source); return s; }
function notes(s, t) { s.speakerNotes.textFrame.setText(t); }
async function bytes(name) { return new Uint8Array(await fs.readFile(path.join(assetDir, name))); }
function img(s, data, x, y, w, h, alt, fit = "cover") { return s.images.add({ blob: data, contentType: "image/png", alt, fit, position: { left: x, top: y, width: w, height: h }, geometry: "roundRect", borderRadius: "rounded-xl" }); }

const business = await bytes("business.png");
const graph = await bytes("graph.png");
const ledger = await bytes("decision-ledger.png");
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

// 1
{
  const s = slide(1);
  label(s, "Problem statement", 72, 54, 156);
  tx(s, "AI-built apps can still\nhave security gaps", 72, 104, 610, 104, { size: 47, bold: true, spacing: 1 });
  tx(s, "A feature can work correctly and still let the wrong person see data, change a transaction, or access a sensitive action.", 72, 235, 565, 64, { size: 20, color: C.muted });
  line(s, 72, 340, 540, C.purple, 3);
  tx(s, "Simple example", 72, 379, 200, 20, { size: 13, bold: true, color: C.purple });
  tx(s, "A user changes an ID in a URL. The app shows another customer's record because it never checks who owns that record.", 72, 416, 545, 68, { size: 23, bold: true });
  tx(s, "The security issue sits in the full path from user request to database, not in only one line of code.", 72, 524, 550, 48, { size: 18, color: C.muted });
  box(s, 740, 99, 468, 465, C.dark);
  tx(s, "WHAT INVARIA DOES", 780, 143, 230, 18, { size: 12, bold: true, color: C.purple2 });
  tx(s, "It checks whether\nthe app follows its\nimportant rules", 780, 189, 355, 112, { size: 34, bold: true, color: C.white, spacing: 1 });
  const a = [["1", "Understand the app"], ["2", "Find a risky path"], ["3", "Show the proof"], ["4", "Help a human decide"]];
  a.forEach(([n, text], i) => { const y = 350 + i * 44; tx(s, n, 780, y, 28, 18, { size: 13, bold: true, color: C.purple2 }); tx(s, text, 827, y, 260, 19, { size: 17, bold: true, color: C.white }); });
  notes(s, "Source: Invaria Engineering & Product Blueprint, sections 2 and 3.\n\nTalk track: Invaria focuses on security problems that appear when separate pieces of a product work together. One API might look safe by itself, but a request path can still expose another user's data or enable an unsafe action.");
}

// 2
{
  const s = slide(2);
  label(s, "Market gap", 72, 54, 112);
  tx(s, "Coding tools help write code.\nSecurity review needs to understand the app.", 72, 104, 850, 103, { size: 42, bold: true, spacing: 1 });
  tx(s, "The gap is not a lack of code generation. The gap is knowing what users are allowed to do and checking that the code follows those rules.", 72, 230, 790, 54, { size: 19, color: C.muted });
  box(s, 72, 336, 510, 214, C.mist, { style: "solid", fill: C.line, width: 1 });
  tx(s, "CODING ASSISTANTS", 104, 370, 210, 18, { size: 12, bold: true, color: C.muted });
  tx(s, "Codex and Claude Code", 104, 408, 340, 30, { size: 25, bold: true });
  tx(s, "They help developers write, explain, and review code.", 104, 456, 390, 43, { size: 18, color: C.muted });
  box(s, 626, 336, 582, 214, C.lavender, { style: "solid", fill: C.purple2, width: 2 });
  tx(s, "INVARIA", 660, 370, 180, 18, { size: 12, bold: true, color: C.purple });
  tx(s, "A focused security review", 660, 408, 385, 30, { size: 25, bold: true });
  tx(s, "It maps the app, asks security questions, and shows the code path behind each possible issue.", 660, 456, 430, 43, { size: 18, color: C.muted });
  tx(s, "The model helps reason about evidence. Invaria owns the security process around it.", 72, 596, 1000, 31, { size: 20, bold: true, color: C.ink });
  notes(s, "Source: Invaria Engineering & Product Blueprint, section 2.\n\nTalk track: We do not position Invaria as a replacement for coding assistants. The blueprint says the key idea clearly: Invaria owns the security reasoning process and uses an LLM as one component inside that process.");
}

// 3
{
  const s = slide(3, "Screenshot: live local Invaria workspace, captured 24 Sep 2026");
  label(s, "Our platform", 72, 54, 120);
  tx(s, "What is Invaria?", 72, 105, 520, 52, { size: 45, bold: true });
  tx(s, "Invaria reads a software repository and gives the team a clear security review.", 72, 179, 560, 48, { size: 20, color: C.muted });
  const items = [["Repository", "Connect a GitHub or GitLab project"], ["Analysis", "Read code, APIs, data, and access rules"], ["Report", "Show possible risks, proof, and suggested fixes"]];
  items.forEach(([h, b], i) => { const y = 290 + i * 83; tx(s, String(i + 1), 72, y + 4, 26, 18, { size: 13, bold: true, color: C.purple }); tx(s, h, 116, y, 170, 24, { size: 21, bold: true }); tx(s, b, 116, y + 32, 450, 26, { size: 16, color: C.muted }); });
  img(s, business, 655, 93, 553, 388, "Live Invaria workspace");
  tx(s, "The dashboard can show both the technical evidence and the business impact.", 655, 505, 520, 35, { size: 17, color: C.muted });
  notes(s, "Source: Invaria Engineering & Product Blueprint, section 2. Screenshot: live local Invaria workspace.\n\nTalk track: This is the product in one sentence. A team connects a repository, Invaria understands the code and important data paths, then it produces a review that a developer or product owner can use.");
}

// 4
{
  const s = slide(4);
  label(s, "How it works", 72, 54, 120);
  tx(s, "From repository to security report", 72, 105, 800, 53, { size: 44, bold: true });
  tx(s, "The blueprint describes one simple flow.", 72, 179, 620, 28, { size: 20, color: C.muted });
  const steps = [["1", "Repository", "A company connects its code"], ["2", "Scan", "Invaria reads the code and APIs"], ["3", "App map", "It maps users, data, and routes"], ["4", "Questions", "It asks what could go wrong"], ["5", "Report", "It shows evidence and a fix"]];
  const cards = [];
  steps.forEach(([n, h, b], i) => { const x = 72 + i * 226; const c = box(s, x, 290, 190, 200, i === 3 ? C.lavender : C.mist, { style: "solid", fill: i === 3 ? C.purple2 : C.line, width: i === 3 ? 2 : 1 }); cards.push(c); tx(s, n, x + 20, 315, 30, 18, { size: 13, bold: true, color: C.purple }); tx(s, h, x + 20, 354, 155, 25, { size: 22, bold: true }); tx(s, b, x + 20, 400, 152, 50, { size: 16, color: C.muted }); });
  for (let i = 0; i < cards.length - 1; i++) s.shapes.connect(cards[i], cards[i + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.purple2, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  box(s, 72, 545, 1136, 71, C.dark);
  tx(s, "The LLM helps with reasoning, but the final report must have code and data-flow evidence.", 105, 565, 950, 28, { size: 20, bold: true, color: C.white });
  notes(s, "Source: Invaria Engineering & Product Blueprint, section 2.\n\nTalk track: This slide follows the blueprint exactly. We start with the repository, scan it, build a map of how the application works, ask security questions, verify the evidence, and create a report.");
}

// 5
{
  const s = slide(5, "Screenshot: live INVARIANT decision ledger, captured 24 Sep 2026");
  label(s, "The INVARIANT algorithm", 72, 54, 222);
  tx(s, "It checks the rules\nthat must always be true", 72, 105, 600, 94, { size: 43, bold: true, spacing: 1 });
  tx(s, "An invariant is a simple security rule for the application.", 72, 220, 550, 29, { size: 19, color: C.muted });
  const rules = [["User data", "A user should only see their own data"], ["Money actions", "A refund or withdrawal should follow the right checks"], ["Secrets", "Passwords and keys should not sit in source code"]];
  rules.forEach(([h, b], i) => { const y = 302 + i * 78; tx(s, String(i + 1), 72, y + 2, 25, 18, { size: 13, bold: true, color: C.purple }); tx(s, h, 115, y, 170, 23, { size: 20, bold: true }); tx(s, b, 115, y + 31, 465, 28, { size: 16, color: C.muted }); });
  tx(s, "INVARIANT follows the code path and checks whether the rule is being followed.", 72, 558, 550, 42, { size: 20, bold: true });
  img(s, ledger, 682, 108, 526, 410, "Live Invaria decision ledger", "contain");
  tx(s, "For every possible issue, the tool records the evidence and what a human still needs to check.", 682, 540, 500, 45, { size: 17, color: C.muted });
  notes(s, "Source: Invaria Engineering & Product Blueprint, sections 2 and 3; docs/INVARIANT_ENGINE.md. Screenshot: live Invaria decision ledger.\n\nTalk track: INVARIANT is the product's decision engine. It starts with a rule, follows the relevant code path, and checks whether the code can prove that the rule is protected. If it cannot, it gives the reviewer the evidence instead of pretending that the issue is already confirmed.");
}

// 6
{
  const s = slide(6, "Source: Invaria Engineering & Product Blueprint, section 3");
  label(s, "Real-life examples", 72, 54, 150);
  tx(s, "The same idea works in many applications", 72, 105, 900, 53, { size: 43, bold: true });
  const cases = [["Fintech", "Can a user change a refund or withdraw money that is not theirs?", C.orange], ["Healthcare", "Can one patient open another patient's medical record?", C.teal], ["SaaS", "Can changing an ID reveal another company's files or invoices?", C.purple]];
  cases.forEach(([h, b, col], i) => { const x = 72 + i * 371; box(s, x, 245, 332, 190, C.mist, { style: "solid", fill: C.line, width: 1 }); tx(s, h, x + 28, 276, 260, 28, { size: 25, bold: true, color: col }); tx(s, b, x + 28, 330, 270, 62, { size: 18, color: C.muted }); });
  img(s, graph, 72, 491, 623, 123, "Invaria security graph", "cover");
  tx(s, "Invaria maps the path from a user request to the sensitive data or action.", 736, 514, 410, 44, { size: 21, bold: true });
  tx(s, "Then it asks whether the app has the right security check in that path.", 736, 574, 410, 32, { size: 17, color: C.muted });
  notes(s, "Source: Invaria Engineering & Product Blueprint, section 3. Screenshot: live Invaria graph.\n\nTalk track: The blueprint gives these examples because the security idea stays the same across industries. Invaria asks who is making the request, what they are trying to access or change, and whether the code protects that action.");
}

// 7
{
  const s = slide(7);
  label(s, "Target customers", 72, 54, 155);
  tx(s, "Who will use Invaria?", 72, 105, 600, 52, { size: 45, bold: true });
  tx(s, "Teams that build products with user data, money movement, or important business actions.", 72, 179, 680, 49, { size: 20, color: C.muted });
  const audience = [["AI-built startups", "Fast-moving teams without a dedicated security team"], ["SaaS companies", "Teams responsible for keeping customer data separate"], ["Fintech products", "Teams handling payments, wallets, refunds, or balances"], ["Healthcare products", "Teams protecting patient data and access rights"]];
  audience.forEach(([h, b], i) => { const y = 281 + i * 71; tx(s, String(i + 1), 72, y + 3, 25, 18, { size: 13, bold: true, color: C.purple }); tx(s, h, 116, y, 255, 23, { size: 21, bold: true }); tx(s, b, 116, y + 31, 520, 25, { size: 16, color: C.muted }); line(s, 72, y + 59, 570); });
  box(s, 737, 110, 471, 430, C.dark);
  tx(s, "THE MAIN USER", 779, 151, 200, 18, { size: 12, bold: true, color: C.purple2 });
  tx(s, "Developers and\nengineering leads", 779, 196, 350, 70, { size: 34, bold: true, color: C.white, spacing: 1 });
  tx(s, "They need a clear answer to one question:", 779, 309, 330, 28, { size: 18, color: "#C4C9D9" });
  tx(s, "Does this product protect its users and important data?", 779, 360, 347, 56, { size: 24, bold: true, color: C.white });
  tx(s, "Invaria gives them a focused review before a release or major change.", 779, 452, 340, 46, { size: 17, color: "#C4C9D9" });
  notes(s, "Source: Invaria Engineering & Product Blueprint, section 3.\n\nTalk track: We start with teams that have real application risk but limited security capacity. The main user is the developer or engineering lead who needs a clear review before releasing a product or an important change.");
}

// 8
{
  const s = slide(8, "Source: Invaria Engineering & Product Blueprint, sections 2 and 4");
  label(s, "Future scope", 72, 54, 105);
  tx(s, "What is built now and what comes next", 72, 105, 950, 53, { size: 43, bold: true });
  const current = box(s, 72, 248, 522, 286, C.lavender, { style: "solid", fill: C.purple2, width: 2 });
  tx(s, "BUILT NOW", 106, 282, 180, 18, { size: 12, bold: true, color: C.purple });
  tx(s, "Repository scan", 106, 323, 365, 28, { size: 25, bold: true });
  tx(s, "Code and API mapping\nSecurity questions\nEvidence-backed reports", 106, 377, 320, 84, { size: 19, color: C.muted, spacing: 1.35 });
  const next = box(s, 686, 248, 522, 286, C.mist, { style: "solid", fill: C.line, width: 1 });
  tx(s, "NEXT", 720, 282, 140, 18, { size: 12, bold: true, color: C.purple });
  tx(s, "Broader coverage", 720, 323, 375, 28, { size: 25, bold: true });
  tx(s, "More frameworks and languages\nDeeper business-flow checks\nSuggested fixes and future pull requests", 720, 377, 410, 84, { size: 19, color: C.muted, spacing: 1.35 });
  s.shapes.connect(current, next, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.purple2, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } });
  box(s, 72, 585, 1136, 53, C.dark);
  tx(s, "Goal: give every product team a clear, evidence-based security review before they ship.", 105, 600, 940, 23, { size: 20, bold: true, color: C.white });
  notes(s, "Source: Invaria Engineering & Product Blueprint, sections 2 and 4.\n\nTalk track: The blueprint gives us a clear direction. Today the product can scan a repository, map its structure, find supported security issues, and report them. Next we will support more technologies, check deeper workflows, and help teams fix issues through future pull requests.");
}

const candidatePath = path.join(staging, "Invaria_Review_Deck_Simple_candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
await finalizePresentation({
  explicitTotalSlideCount: 8,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir: root,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/SHASHANK KAKAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skill, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skill, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(staging, "Invaria_Review_Deck_Simple.validation.json"),
});
console.log(finalPath);

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CheckCircle2, FileSearch, GitBranch, ShieldCheck } from 'lucide-react';
import { Cta } from '@/components/site/cta';

export const metadata: Metadata = { title: 'INVARIANT — Invaria', description: 'See how INVARIANT turns observed source paths into inspectable business-risk hypotheses.' };

const rules = [
  ['BFL001', 'Sensitive business mutation', 'Flags a request-controlled value or state change where the expected product invariant is absent or not fully observed.'],
  ['BOLA001', 'Object access boundary', 'Flags a request-controlled object reference reaching a private data operation without a proven scope predicate.'],
  ['INJ001', 'Executable data path', 'Flags request-derived data reaching a supported executable sink.'],
  ['SEC001', 'Credential-like source literal', 'Flags a credential-like string committed in source for human confirmation.'],
];

export default function InvariantPage() {
  return <main id="main-content" className="marketing-page">
    <section className="page-hero dark-section"><span className="kicker">THE INVARIA DECISION ENGINE</span><h1>INVARIANT turns a code path into an <span>inspectable decision.</span></h1><p>Invariant-based Networked Verification and Attack-path Reasoning is the policy layer behind Invaria’s evidence-first review.</p><Link href="/workspace?lens=business" className="button button-primary">See it in the workspace <ArrowUpRight size={18} /></Link></section>

    <section className="section-container invariant-intro" data-reveal><div><span className="kicker">WHY IT EXISTS</span><h2>More than pattern matching.</h2></div><p>A detector can suggest a risk. INVARIANT decides whether the candidate has the route, operation, and control evidence needed to be shown to a reviewer. Advisory AI can add business context, but it never satisfies that evidence gate.</p></section>

    <section className="section-container invariant-path" data-reveal aria-label="INVARIANT evidence path"><header><span className="kicker">THE EVIDENCE PATH</span><h2>A review-ready hypothesis has a visible trail.</h2></header><div>{[[GitBranch, '01', 'Map the source', 'Resolve supported routes, request inputs, functions, lookups, mutations, and relationships.'], [FileSearch, '02', 'Apply the policy', 'Test a rule-specific hypothesis against required source and control evidence.'], [ShieldCheck, '03', 'Pass the evidence gate', 'Discard candidates that cannot meet the rule’s minimum evidence threshold.'], [CheckCircle2, '04', 'Support a human decision', 'Show the operation, assumptions, policy coverage, evidence, and possible consequence.']].map(([Icon, number, title, text]) => { const StepIcon = Icon as typeof GitBranch; return <article key={String(number)}><StepIcon size={25} /><span>{number as string}</span><h3>{title as string}</h3><p>{text as string}</p><ArrowRight size={18} /></article>; })}</div></section>

    <section className="invariant-rule-section"><div className="section-container"><div className="section-heading"><span className="kicker">CURRENT RULE FAMILIES</span><h2>Evidence-first, by rule.</h2><p>BFL001 brings business operations into view without claiming that an outcome has already occurred.</p></div><div className="invariant-rules">{rules.map(([code, title, text]) => <article key={code}><code>{code}</code><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

    <section className="section-container boundary-section" data-reveal><div><span className="kicker">A CLEAR BOUNDARY</span><h2>What the current engine does—and does not—claim.</h2></div><div><p><strong>Today:</strong> INVARIANT can surface a source-backed potential sensitive mutation, ownership gap, executable sink, or committed credential for review.</p><p><strong>Next:</strong> multi-step refund and withdrawal sequences, coupon reuse, race conditions, atomicity, idempotency, and double-spend analysis require deeper runtime and cross-service reasoning. They are not reported as detected today.</p></div></section>
    <div className="section-container"><Cta title={'See the policy.\nInspect the evidence.'} /></div>
  </main>;
}

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BadgeCheck, Building2, GitBranch, Landmark, ScanLine, ShoppingCart, Sparkles } from 'lucide-react';
import { ProductPreview } from '@/components/site/product-preview';
import { Cta } from '@/components/site/cta';

const differentiators = [
  ['01', 'Reason about product rules.', 'INVARIANT looks for request-controlled changes to sensitive values and states—the operations your customers, revenue, and product promises depend on.'],
  ['02', 'Keep every claim inspectable.', 'Potential risks stay connected to the route, operation, evidence gate, assumptions, and controls a reviewer can actually inspect.'],
  ['03', 'Explain the consequence clearly.', 'Local Gemma translates evidence into advisory business context. It never turns a possibility into proof.'],
];

const audiences = [
  { icon: Sparkles, title: 'AI-built SaaS', text: 'Move quickly without losing sight of tenant boundaries, ownership, and server-side rules.' },
  { icon: ShoppingCart, title: 'Commerce & marketplaces', text: 'Review the sensitive paths around discounts, inventory, orders, refunds, and account balances.' },
  { icon: Landmark, title: 'Regulated products', text: 'Give security and product reviewers one evidence trail for the business operations that matter.' },
];

export default function LandingPage() {
  return <main id="main-content" className="marketing-page">
    <section className="landing-hero dark-section">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-copy">
        <span className="release-pill"><span /> INVARIANT-POWERED BUSINESS RISK REVIEW</span>
        <h1>Protect the business logic that makes your <span>product work.</span></h1>
        <p>Invaria connects observed code paths to the product operations they could affect, then gives every reviewer the evidence needed to make a confident call.</p>
        <div className="hero-actions"><Link href="/workspace?lens=business" className="button button-primary">Try the local preview <ArrowUpRight size={18} /></Link><Link href="/invariant" className="button button-dark-outline">Meet INVARIANT <ArrowRight size={17} /></Link></div>
        <small>Evidence-first. Local model. Human-reviewed.</small>
      </div>
      <div className="hero-preview"><ProductPreview /></div>
      <div className="hero-bottom"><span>FROM CODE PATH TO BUSINESS CONSEQUENCE</span><span>Designed for people who ship product <ArrowRight size={14} /></span></div>
    </section>

    <section className="technology-strip" aria-label="Invaria capabilities"><span>BUILT FOR A REVIEW THAT CONNECTS</span><div><GitBranch size={21} /> Source paths</div><div><ScanLine size={21} /> Evidence gates</div><div><span className="tech-monogram">◇</span> Local Gemma</div><div><BadgeCheck size={20} /> Human decisions</div></section>

    <section className="section-container intro-section" data-reveal><div><span className="kicker">BEYOND A LINE NUMBER</span><h2>Show the operation.<br /><span className="text-muted">Explain the exposure.</span></h2></div><p>A generic finding says a line of code looks risky. Invaria shows the request path, the sensitive product operation, the potential business consequence, and the exact evidence behind that review.</p></section>

    <section className="section-container feature-grid" aria-label="Why Invaria">{differentiators.map(([number, title, text]) => <article key={number} className="feature-card" data-reveal><div className="feature-top"><Building2 size={25} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p><Link href="/invariant" className="text-link">How INVARIANT works <ArrowUpRight size={16} /></Link></article>)}</section>

    <section className="section-container workflow-section" data-reveal><div className="section-heading"><span className="kicker">ONE SCAN. TWO LENSES.</span><h2>Business clarity<br />with technical proof.</h2><p>Start with what the risk could mean, then move directly into the evidence.</p></div><div className="workflow-steps">{[{ title: 'Map the product path.', text: 'Bring a supported repository. Invaria maps routes, inputs, operations, and data access.' }, { title: 'Test an invariant.', text: 'INVARIANT applies an evidence gate before a candidate becomes a review-ready potential risk.' }, { title: 'Choose the next step.', text: 'Business risk gives the plain-language consequence; technical evidence provides the source trail.' }].map(({ title, text }, i) => <article key={title}><span className="step-number">0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={22} /></article>)}</div></section>

    <section className="proof-section"><div className="section-container" data-reveal><div className="section-heading"><span className="kicker">WHO IT IS FOR</span><h2>Built around the operations<br />your product cannot get wrong.</h2></div><div className="audience-grid">{audiences.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22} /><h3>{title}</h3><p>{text}</p></article>)}</div><Link href="/customers" className="text-link audience-link">See the customer fit <ArrowUpRight size={16} /></Link></div></section>

    <div className="section-container"><Cta title={'Protect the logic.\nKeep the evidence.'} /></div>
  </main>;
}

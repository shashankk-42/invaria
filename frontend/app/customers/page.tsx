import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Building2, HeartPulse, Landmark, ShoppingCart, Sparkles } from 'lucide-react';
import { Cta } from '@/components/site/cta';

export const metadata: Metadata = { title: 'Customers — Invaria', description: 'See which product teams get the most value from Invaria business-risk review.' };

const customerTypes = [
  { icon: Sparkles, label: 'PRIMARY', title: 'AI-built SaaS & internal tools', issue: 'Your team ships quickly, but product rules, roles, ownership checks, and server-side controls need a repeatable review.', outcome: 'Use Invaria to connect a potential route-level weakness to the customers, tenant data, and operations it could affect.' },
  { icon: ShoppingCart, label: 'PRIMARY', title: 'E-commerce & marketplaces', issue: 'Discount, price, inventory, payout, order, and refund workflows can create a bad outcome even when each individual endpoint looks reasonable.', outcome: 'Focus review on sensitive mutations and the business rules that should govern those operations.' },
  { icon: Landmark, label: 'SUPPORTING', title: 'Fintech & payments', issue: 'A series of valid-looking operations can still change who receives value or when funds move.', outcome: 'Use source-backed hypotheses to focus human review on authorization, state changes, and high-impact money flows.' },
  { icon: HeartPulse, label: 'SUPPORTING', title: 'Healthcare & multi-tenant products', issue: 'A caller-controlled record identifier or incomplete tenant check can place private records in the wrong hands.', outcome: 'Trace users, routes, records, and ownership boundaries before a reviewer makes a security decision.' },
];

export default function CustomersPage() {
  return <main id="main-content" className="marketing-page">
    <section className="page-hero dark-section"><span className="kicker">BUILT FOR PRODUCT TEAMS WITH REAL CONSEQUENCES</span><h1>If your product depends on rules, <span>Invaria is for you.</span></h1><p>Start where business logic matters most: customer data, money movement, product state, inventory, and tenant boundaries.</p><Link href="/workspace?lens=business" className="button button-primary">Explore the business dashboard <ArrowUpRight size={18} /></Link></section>
    <section className="section-container customer-intro" data-reveal><span className="kicker">THE CUSTOMER FIT</span><h2>Security review for the people responsible for the product outcome.</h2><p>Invaria gives engineering, product, and security teams a shared language without hiding the evidence that makes a claim reviewable.</p></section>
    <section className="section-container customer-grid">{customerTypes.map(({ icon: Icon, label, title, issue, outcome }) => <article key={title} data-reveal><header><Icon size={24} /><span>{label}</span></header><h3>{title}</h3><div><strong>If this sounds familiar</strong><p>{issue}</p></div><div><strong>What Invaria helps you review</strong><p>{outcome}</p></div></article>)}</section>
    <section className="customer-cta dark-section"><div className="section-container"><Building2 size={30} /><div><span className="kicker">YOUR PRODUCT. YOUR RULES.</span><h2>Find the operations a generic scanner leaves behind.</h2><p>Begin with a public repository or test fixture in the local developer preview.</p></div><Link href="/workspace" className="button button-primary">Open workspace <ArrowUpRight size={18} /></Link></div></section>
    <div className="section-container"><Cta title={'Bring the product context.\nKeep control of the decision.'} /></div>
  </main>;
}

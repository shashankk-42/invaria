'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/product', label: 'Product' },
  { href: '/invariant', label: 'INVARIANT' },
  { href: '/customers', label: 'Customers' },
  { href: '/pricing', label: 'Pricing' },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="nav-pill" aria-label="Main navigation">
        <Link href="/" className="wordmark" aria-label="Invaria home" onClick={() => setOpen(false)}>
          invaria
        </Link>
        <div className="desktop-links">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</div>
        <Link className="nav-cta" href="/workspace" onClick={() => setOpen(false)}>Open workspace <ArrowUpRight size={15} /></Link>
        <button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        {open && <div className="mobile-links" id="mobile-navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} onClick={() => setOpen(false)}>{link.label}<ArrowUpRight size={16} /></Link>)}</div>}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-top"><Link href="/" className="wordmark">invaria</Link><p>Protect the business logic<br />that makes your product work.</p><nav aria-label="Footer navigation"><Link href="/product">Product</Link><Link href="/invariant">INVARIANT</Link><Link href="/customers">Customers</Link><Link href="/pricing">Pricing</Link><Link href="/workspace">Workspace</Link></nav></div><div className="footer-bottom"><span>© 2026 Invaria</span><span>Built for evidence. Designed for people.</span><span>Local-first · Developer preview</span></div></footer>;
}

export function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.classList.add('reveal-enabled');
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function Cta({ title = 'Your code has a story.\nSee the whole picture.' }: { title?: string }) {
  return <section className="accent-cta" data-reveal><div><span className="kicker">CLARITY STARTS HERE</span><h2>{title}</h2><p>Bring a repository. Leave with a clearer next step.</p></div><Link href="/workspace" className="button button-white">Start an analysis <ArrowUpRight size={18} /></Link><span className="cta-orbit" aria-hidden="true" /></section>;
}

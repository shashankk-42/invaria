'use client';
import { useEffect, useState, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import {
  Shield,
  ShieldCheck,
  GitFork,
  GitBranch,
  Play,
  ArrowRight,
  ArrowUpRight,
  ArrowDownToLine,
  Network,
  FileCode2,
  Search,
  Sparkles,
  Check,
  X,
  CircleAlert,
  LoaderCircle,
  Fingerprint,
  FlaskConical,
  Terminal,
  ChevronRight,
  Activity,
  SlidersHorizontal,
  Braces,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

type Evidence = {
  id: string;
  file: string;
  line: number;
  end_line: number;
  snippet: string;
  kind: string;
};
type Finding = {
  id: string;
  rule_id: string;
  title: string;
  category: string;
  severity: string;
  confidence: number;
  route?: string;
  summary: string;
  impact: string;
  remediation: string;
  assumptions: string[];
  attack_path: string[];
  evidence: Evidence[];
  references: { title: string; url: string }[];
  review_status: string;
  review_note: string;
  algorithm?: {
    code_name: string;
    version: string;
    hypothesis: string;
    decision: string;
    evidence_gate: { passed: boolean; required_kinds: string[]; observed_kinds: string[]; missing_kinds: string[]; interprocedural_trace?: boolean };
    proven_controls: string[];
    policy?: { coverage?: string; matched_invariants?: { id: string; description: string; required_controls: string[] }[]; observed_control_markers?: string[]; missing_control_markers?: string[] };
    risk_signals: string[];
    unresolved_conditions: string[];
    confidence_basis: string;
  };
  reasoning?: { model: string; verdict: string; explanation: string };
};
type Node = {
  id: string;
  kind: string;
  label: string;
  file?: string;
  line?: number;
};
type Edge = { source: string; target: string; kind: string };
type BusinessImpact = {
  finding_id: string;
  business_impact: string;
  affected_areas: string[];
  caveat: string;
};
type ExecutiveEntry = {
  finding: Finding;
  impact?: BusinessImpact;
  areas: string[];
  weight: number;
};
type ExecutiveArea = {
  key: string;
  name: string;
  count: number;
  weight: number;
};
type UploadedDocument = {
  id: string;
  name: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  status: string;
  characters_extracted: number;
  headings: string[];
  excerpt: string;
  error?: string;
};
type Scan = {
  id: string;
  repository: string;
  source: string;
  status: string;
  stage: string;
  created_at: string;
  commit?: string;
  duration_seconds?: number;
  summary?: Record<string, number>;
  coverage?: Record<string, number>;
  findings?: Finding[];
  graph?: { nodes: Node[]; edges: Edge[] };
  schemas?: unknown[];
  routes?: {
    method: string;
    path: string;
    file: string;
    line: number;
    resolved: boolean;
  }[];
  warnings?: string[];
  limitations?: string[];
  error?: string;
  model_status?: string;
  product_overview?: {
    status: 'queued' | 'generating' | 'ready' | 'unavailable';
    summary?: string;
    activities?: string[];
    document_context?: string;
    sources?: string[];
    message?: string;
  };
  business_impact_overview?: {
    status: 'queued' | 'generating' | 'ready' | 'unavailable';
    summary?: string;
    impacts?: BusinessImpact[];
    model?: string;
    sources?: string[];
    message?: string;
  };
  retrieval_modes?: string[];
  semgrep?: { status: string };
  events?: { stage: string; message: string; elapsed_seconds: number }[];
  documentation?: {
    trust: 'untrusted-hints-only';
    documents: UploadedDocument[];
    business_context: { name: string; headings: string[]; excerpt: string }[];
  };
};
type Models = {
  reasoning_ready: boolean;
  embedding_ready: boolean;
  reasoning_model: string;
};
const target =
  'https://github.com/shashankk-42/taskforge-decentralized-compute-marketplace';
const fixtures: Record<string, string> = {
  'bola-vulnerable': 'Authorization · vulnerable',
  'bola-fixed': 'Authorization · fixed',
  'injection-vulnerable': 'SQL injection · vulnerable',
  'injection-fixed': 'SQL injection · fixed',
  'secrets-vulnerable': 'Credential · vulnerable',
  'secrets-fixed': 'Credential · fixed',
};
const stages = [
  'ingestion',
  'extraction',
  'baseline',
  'reasoning',
  'verification',
  'report',
];
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const r = await fetch('/api' + path, {
    ...init,
    headers,
  });
  if (!r.ok) {
    const b = (await r
      .json()
      .catch(() => ({
        detail: 'The API is unavailable. Check that the backend is running.',
      }))) as { detail?: unknown };
    throw new Error(
      typeof b.detail === 'string' ? b.detail : 'Please check your input.',
    );
  }
  return r.json();
}
function ProductOverview({ scan }: { scan: Scan }) {
  const requested = useRef(false);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [queued, setQueued] = useState(false);
  const overview = scan.product_overview;
  const requestOverview = useCallback(async () => {
    setPending(true);
    setRequestError('');
    try {
      await api(`/scans/${scan.id}/overview`, { method: 'POST' });
      setQueued(true);
    } catch (error) {
      setRequestError((error as Error).message);
    } finally {
      setPending(false);
    }
  }, [scan.id]);
  useEffect(() => {
    if (!overview && !requested.current) {
      requested.current = true;
      void requestOverview();
    }
  }, [overview, requestOverview]);
  const busy = pending || overview?.status === 'queued' ||
    overview?.status === 'generating' || (!overview && queued);
  return (
    <section className="product-overview" aria-label="Product overview" aria-busy={busy}>
      <div className="product-overview-heading">
        <div><Sparkles size={17} aria-hidden="true" /><h3>Product overview</h3></div>
        <span>Business context</span>
      </div>
      {overview?.status === 'ready' ? (
        <>
          <p className="product-overview-summary">{overview.summary}</p>
          {!!overview.activities?.length && (
            <ul>{overview.activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul>
          )}
          <div className="product-overview-context">
            <strong>Document context</strong>
            <p>{overview.document_context}</p>
            {!!overview.sources?.length && <small>Documents considered: {overview.sources.join(', ')}</small>}
          </div>
          <small className="product-overview-note">AI-generated from code structure and available documents. Review for accuracy.</small>
        </>
      ) : busy ? (
        <output className="product-overview-loading">
          <LoaderCircle size={16} className="spin" aria-hidden="true" />
          Preparing a brief overview of this product and its main activities…
        </output>
      ) : (
        <div className="product-overview-empty">
          <p role={requestError ? 'alert' : undefined}>{requestError || overview?.message ||
            'Summarize what this product does using its code structure and uploaded documents.'}</p>
          <Button variant="outline" size="sm" onClick={() => void requestOverview()}>
            {requestError || overview?.status === 'unavailable' ? 'Retry overview' : 'Generate overview'}
          </Button>
        </div>
      )}
    </section>
  );
}

function BusinessImpactOverview({ scan }: { scan: Scan }) {
  const requested = useRef(false);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [queued, setQueued] = useState(false);
  const overview = scan.business_impact_overview;
  const requestBusinessImpact = useCallback(async () => {
    setPending(true);
    setRequestError('');
    try {
      await api(`/scans/${scan.id}/business-impact`, { method: 'POST' });
      setQueued(true);
    } catch (error) {
      setRequestError((error as Error).message);
    } finally {
      setPending(false);
    }
  }, [scan.id]);
  useEffect(() => {
    if (!overview && scan.findings?.length && !requested.current) {
      requested.current = true;
      void requestBusinessImpact();
    }
  }, [overview, requestBusinessImpact, scan.findings?.length]);
  const busy = pending || overview?.status === 'queued' || overview?.status === 'generating' || (!overview && queued);
  return (
    <section className="business-impact-overview" aria-label="Business impact overview" aria-busy={busy}>
      <div className="business-impact-heading">
        <div><Sparkles size={17} aria-hidden="true" /><h3>Business impact overview</h3></div>
        <span>Local Gemma · advisory</span>
      </div>
      {overview?.status === 'ready' ? (
        <>
          <p>{overview.summary}</p>
          <small>Each finding below includes a plain-language potential business consequence. This context does not prove an issue or change its severity.</small>
        </>
      ) : busy ? (
        <output className="business-impact-loading"><LoaderCircle size={16} className="spin" aria-hidden="true" /> Translating potential risks into plain-language business context…</output>
      ) : (
        <div className="business-impact-empty">
          <p role={requestError ? 'alert' : undefined}>{requestError || overview?.message || 'Explain how each potential risk could affect the business, using local model context.'}</p>
          <Button variant="outline" size="sm" onClick={() => void requestBusinessImpact()}>{requestError || overview?.status === 'unavailable' ? 'Retry business overview' : 'Generate business overview'}</Button>
        </div>
      )}
    </section>
  );
}

function businessAreaFallback(category: string) {
  if (category === 'authorization') return 'Access control';
  if (category === 'injection') return 'Data integrity';
  if (category === 'secrets') return 'Sensitive data';
  return 'Business operations';
}

function severityWeight(severity: string) {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as Record<string, number>)[severity] || 1;
}

function severityMessage(severity: string) {
  return ({
    critical: 'Act first',
    high: 'Priority review',
    medium: 'Plan review',
    low: 'Monitor',
  } as Record<string, string>)[severity] || 'Review';
}

function areaKey(area: string) {
  return area.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function sourceLabel(finding: Finding) {
  if (finding.route) return finding.route;
  const source = finding.evidence[0];
  return source ? `${source.file}:${source.line}` : 'the recorded source path';
}

function businessAsset(finding: Finding) {
  const details = `${finding.route || ''} ${finding.summary} ${finding.attack_path.join(' ')}`.toLowerCase();
  if (details.includes('wallet')) return 'a wallet balance or credit record';
  if (details.includes('lender')) return 'a lender profile or lender-owned job';
  if (details.includes('download')) return 'a private job attachment';
  if (details.includes('result')) return 'a submitted job result';
  if (details.includes('accept')) return 'the job acceptance decision';
  if (details.includes('status')) return 'the job status';
  if (details.includes('job')) return 'a job record';
  if (details.includes('order')) return 'an order record';
  if (details.includes('user')) return 'a customer record';
  return 'a protected product record';
}

function businessConsequence(finding: Finding) {
  const location = sourceLabel(finding);
  const details = `${finding.summary} ${finding.algorithm?.risk_signals?.join(' ') || ''}`.toLowerCase();

  if (finding.rule_id === 'BFL001') {
    const operation = finding.route ? `the ${finding.route} operation` : 'a sensitive product operation';
    const outcome = /(coupon|discount)/.test(details)
      ? 'an unapproved discount could reduce the order value'
      : /(refund|withdraw|balance|credit|amount|price|payment)/.test(details)
        ? 'an unapproved money movement or price change could be recorded'
        : /(quantity|inventory|stock)/.test(details)
          ? 'stock or order quantities could be changed outside the intended rules'
          : 'a sensitive product state could be changed outside the intended rules';
    return `A caller could send a changed value to ${operation}. If the server-side business rule is incomplete, ${outcome}.`;
  }

  if (finding.rule_id === 'BOLA001') {
    const asset = businessAsset(finding);
    return `A signed-in user could try a different identifier at ${location} to reach ${asset}. If ownership or tenant scope is not enforced separately, another customer’s ${asset.replace(/^a /, '')} could be viewed or changed.`;
  }

  if (finding.rule_id === 'FBA001') {
    return 'A visitor can start an anonymous session and submit a shared data change. If the remote Firebase rules do not limit that action to the intended user or record, unapproved records could be created or changed.';
  }

  if (finding.rule_id === 'CFG001') {
    const setting = finding.summary.split(' ')[0] || 'credential setting';
    return `If ${setting} is used outside local development, a person who learns the fallback could try it against the running service. That could put application sessions or protected service access at risk.`;
  }

  if (finding.rule_id === 'SEC001' || finding.category === 'secrets') {
    const credential = finding.summary.split(' ')[0] || 'credential';
    return `Someone with repository access could copy the ${credential} value recorded at ${location}. If it is active, they could attempt to sign in to the related service or impersonate an application user.`;
  }

  if (finding.category === 'injection') {
    return `A caller could influence the operation reached from ${location}. If the recorded input reaches the data or command layer without the expected protection, application data could be read, changed, or disrupted.`;
  }

  return finding.impact;
}

function businessTrigger(finding: Finding) {
  if (finding.rule_id === 'BFL001') return `A request-controlled value reaches ${finding.route || 'a sensitive operation'}.`;
  if (finding.rule_id === 'BOLA001') return `The lookup for ${businessAsset(finding)} at ${sourceLabel(finding)} accepts an identifier without a proven matching ownership or tenant check.`;
  if (finding.rule_id === 'FBA001') return 'Anonymous access reaches a Firebase write, while the enforcement rules are outside this source snapshot.';
  if (finding.rule_id === 'CFG001') return 'The service can fall back to a credential-like value when the expected environment setting is absent.';
  if (finding.rule_id === 'SEC001' || finding.category === 'secrets') return `A credential-like value appears in ${sourceLabel(finding)}.`;
  return finding.algorithm?.unresolved_conditions?.[0] || 'The recorded evidence needs a reviewer to confirm the intended product control.';
}

type ModelDomain = {
  id: string;
  label: string;
  shortLabel: string;
  status: 'observed' | 'partial' | 'awaiting';
  summary: string;
  items: { label: string; detail?: string }[];
  x: number;
  y: number;
};

function ApplicationModel({
  scan,
  onOpenGraph,
}: {
  scan: Scan;
  onOpenGraph: (routeId: string) => void;
}) {
  const [selectedDomainId, setSelectedDomainId] = useState('views');
  const nodes = scan.graph?.nodes || [];
  const routeNodes = nodes.filter((node) => node.kind === 'Route');
  const dataNodes = nodes.filter((node) => ['Query', 'Model'].includes(node.kind));
  const controlNodes = nodes.filter((node) => ['Input', 'Middleware', 'Identity'].includes(node.kind));
  const serviceNodes = nodes.filter((node) => ['Middleware', 'Function'].includes(node.kind));
  const documentContext = scan.documentation?.business_context || [];
  const activities = scan.product_overview?.activities || [];
  const sourceFiles = scan.coverage?.source_files || 0;
  const parsedFiles = scan.coverage?.parsed_files || 0;
  const routeItems = routeNodes.slice(0, 4).map((node) => ({
    label: node.label,
    detail: node.file ? `${node.file}:${node.line}` : undefined,
  }));
  const dataItems = dataNodes.slice(0, 4).map((node) => ({
    label: node.label,
    detail: node.file ? `${node.file}:${node.line}` : undefined,
  }));
  const controlItems = controlNodes.slice(0, 4).map((node) => ({
    label: node.label,
    detail: node.kind,
  }));
  const domains: ModelDomain[] = [
    {
      id: 'views', label: 'Views & entry points', shortLabel: 'Views', status: routeNodes.length ? 'observed' : 'awaiting',
      summary: routeNodes.length
        ? `${routeNodes.length} supported application entry points were resolved from source.`
        : 'No supported application entry points were extracted from this scan.',
      items: routeItems, x: 15, y: 21,
    },
    {
      id: 'content', label: 'Content & context', shortLabel: 'Context', status: documentContext.length || activities.length ? 'observed' : 'partial',
      summary: documentContext.length || activities.length
        ? 'Product activities and uploaded business material give the model its operating context.'
        : 'No functional documentation was attached. Product context will grow as documents and AI summaries are available.',
      items: [
        ...activities.slice(0, 3).map((activity) => ({ label: activity, detail: 'Product activity' })),
        ...documentContext.slice(0, 2).map((document) => ({ label: document.name, detail: 'Business document' })),
      ], x: 50, y: 10,
    },
    {
      id: 'data', label: 'Data & persistence', shortLabel: 'Data', status: dataNodes.length ? 'observed' : 'awaiting',
      summary: dataNodes.length
        ? `${dataNodes.length} data operations or models were connected to supported code paths.`
        : 'No supported data operations were linked to an application path.',
      items: dataItems, x: 85, y: 21,
    },
    {
      id: 'schema', label: 'Base schema', shortLabel: 'Schema', status: scan.schemas?.length ? 'observed' : dataNodes.length ? 'partial' : 'awaiting',
      summary: scan.schemas?.length
        ? `${scan.schemas.length} schema elements were extracted from the repository.`
        : dataNodes.length
          ? 'Models and queries provide schema clues. Migration and ORM-schema extraction remains the next coverage step.'
          : 'Schema extraction needs supported database definitions, migrations, or ORM models.',
      items: scan.schemas?.length
        ? scan.schemas.slice(0, 4).map((schema) => ({ label: String(schema), detail: 'Schema element' }))
        : dataItems.slice(0, 3), x: 88, y: 52,
    },
    {
      id: 'roles', label: 'Roles & access', shortLabel: 'Roles', status: controlNodes.length ? 'partial' : 'awaiting',
      summary: controlNodes.length
        ? 'The parser found request inputs and access-control clues. Role and ownership policy still require deeper application analysis.'
        : 'Role and access policy becomes visible when supported identity or middleware patterns are found.',
      items: controlItems, x: 78, y: 82,
    },
    {
      id: 'trust', label: 'Trust boundaries', shortLabel: 'Trust', status: controlNodes.length ? 'partial' : 'awaiting',
      summary: controlNodes.length
        ? 'Request-controlled inputs and middleware mark where data crosses into application-controlled logic.'
        : 'Trust boundaries will be drawn when request inputs and protection layers can be resolved.',
      items: controlItems.filter((item) => item.detail === 'Input' || item.detail === 'Middleware'), x: 50, y: 91,
    },
    {
      id: 'services', label: 'Services & modules', shortLabel: 'Services', status: serviceNodes.length ? 'partial' : 'awaiting',
      summary: serviceNodes.length
        ? `${serviceNodes.length} local functions or mounted modules were linked to the observed routes.`
        : 'Service and module connections will appear as imports and calls are resolved.',
      items: serviceNodes.slice(0, 4).map((node) => ({ label: node.label, detail: node.kind })), x: 22, y: 82,
    },
    {
      id: 'flows', label: 'Business flows', shortLabel: 'Flows', status: activities.length || routeNodes.length ? 'partial' : 'awaiting',
      summary: activities.length
        ? 'Business activities combine the product overview with the code paths that support them.'
        : 'Route groupings show technical flow today. Business-flow descriptions become richer with product documentation or the local AI overview.',
      items: activities.length
        ? activities.slice(0, 4).map((activity) => ({ label: activity, detail: 'Product activity' }))
        : routeItems.slice(0, 3), x: 12, y: 52,
    },
  ];
  const selectedDomain = domains.find((domain) => domain.id === selectedDomainId) || domains[0];
  const observedDomains = domains.filter((domain) => domain.status === 'observed').length;
  const primaryRouteId = routeNodes[0]?.id || '';

  return (
    <section className="application-model" aria-label="Application model">
      <header className="application-model-header">
        <div>
          <span><Network size={15} aria-hidden="true" /> Phase 3 · application model</span>
          <h3>How this application fits together.</h3>
          <p>Explore the connected view of its entry points, code context, data paths, controls, and business operations.</p>
        </div>
        <div className="model-coverage">
          <strong>{observedDomains}<small> / {domains.length}</small></strong>
          <span>model areas observed</span>
        </div>
      </header>

      <div className="application-model-map" aria-label="Interactive application model map">
        <svg className="application-model-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <circle cx="50" cy="51" r="12" className="model-orbit" />
          {domains.map((domain) => (
            <line key={domain.id} x1="50" y1="51" x2={domain.x} y2={domain.y} />
          ))}
          <line x1="15" y1="21" x2="12" y2="52" className="model-cross-link" />
          <line x1="85" y1="21" x2="88" y2="52" className="model-cross-link" />
          <line x1="22" y1="82" x2="50" y2="91" className="model-cross-link" />
          <line x1="78" y1="82" x2="50" y2="91" className="model-cross-link" />
        </svg>
        <div className="application-core" aria-hidden="true"><Network size={25} /><strong>Application</strong><span>model</span></div>
        {domains.map((domain) => (
          <button
            type="button"
            key={domain.id}
            className={`application-model-node ${domain.status} ${selectedDomain.id === domain.id ? 'selected' : ''}`}
            style={{ '--model-x': `${domain.x}%`, '--model-y': `${domain.y}%` } as CSSProperties}
            onClick={() => setSelectedDomainId(domain.id)}
            aria-pressed={selectedDomain.id === domain.id}
          >
            <i aria-hidden="true" />
            <span>{domain.shortLabel}</span>
            <small>{domain.status === 'observed' ? 'Observed' : domain.status === 'partial' ? 'Partial' : 'Awaiting'}</small>
          </button>
        ))}
      </div>

      <section className="application-model-detail" aria-live="polite">
        <div className="model-detail-heading">
          <div>
            <span>{selectedDomain.status === 'observed' ? 'Evidence from this scan' : 'Coverage in progress'}</span>
            <h4>{selectedDomain.label}</h4>
          </div>
          <span className={`model-status ${selectedDomain.status}`}>{selectedDomain.status === 'observed' ? 'Observed' : selectedDomain.status === 'partial' ? 'Partially mapped' : 'Not yet observed'}</span>
        </div>
        <p>{selectedDomain.summary}</p>
        {selectedDomain.items.length ? (
          <div className="model-detail-items" aria-label={`${selectedDomain.label} evidence`}>
            {selectedDomain.items.map((item, index) => (
              <div key={`${item.label}-${index}`}><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</div>
            ))}
          </div>
        ) : <p className="model-empty">This area will populate as the relevant repository structures are parsed.</p>}
        <div className="model-detail-footer">
          <span><Check size={14} aria-hidden="true" /> {parsedFiles} of {sourceFiles} inventoried source files parsed</span>
          <Button variant="outline" size="sm" disabled={!primaryRouteId} onClick={() => onOpenGraph(primaryRouteId)}>
            Trace a source path <ArrowUpRight size={14} />
          </Button>
        </div>
      </section>
      <p className="application-model-note">Solid nodes come from the current snapshot. Dashed nodes describe model areas that need deeper parser coverage; they are not asserted as source evidence.</p>
    </section>
  );
}

function ProductModel({
  scan,
  entries,
  onOpenTechnical,
}: {
  scan: Scan;
  entries: ExecutiveEntry[];
  onOpenTechnical: () => void;
}) {
  const nodes = scan.graph?.nodes || [];
  const activities = scan.product_overview?.activities?.slice(0, 3) || [];
  const routes = nodes.filter((node) => node.kind === 'Route').slice(0, 3);
  const dataCount = nodes.filter((node) => ['Query', 'Model'].includes(node.kind)).length;
  const controls = nodes.filter((node) => ['Identity', 'Middleware'].includes(node.kind)).length;
  const businessCandidates = entries.filter((entry) => entry.finding.rule_id === 'BFL001');
  const activitiesToShow = activities.length
    ? activities
    : routes.length
      ? routes.map((route) => route.label)
      : ['Product actions will appear as supported routes are mapped.'];
  const examples = businessCandidates.length
    ? businessCandidates.slice(0, 3).map((entry) => 'Could this ' + (entry.finding.algorithm?.risk_signals?.[0] || 'sensitive operation') + ' happen outside the intended product rules?')
    : [
      'Could one customer reach another customer’s records?',
      'Could a price, coupon, refund, or inventory change bypass product rules?',
      'Could a sensitive action be repeated when it should happen once?',
    ];

  return (
    <section className="product-model" aria-label="Product operating model">
      <header className="product-model-hero">
        <div>
          <span>Product operating model</span>
          <h3>How to think about this product before looking at code.</h3>
          <p>This is a business map, built from what the scan observed. It shows where a product reviewer should focus; technical details remain in the evidence dashboard.</p>
        </div>
        <Button variant="outline" onClick={onOpenTechnical}>Open technical model <ArrowUpRight size={15} /></Button>
      </header>
      <div className="product-model-flow">
        <article>
          <span>01</span><small>People who act</small>
          <strong>{controls ? controls + ' access clues observed' : 'People and roles need more context'}</strong>
          <p>{controls ? 'The scan found identity or middleware clues. Confirm who is allowed to take sensitive actions.' : 'Add product context or inspect the technical model to define roles and ownership.'}</p>
        </article>
        <ArrowRight aria-hidden="true" />
        <article>
          <span>02</span><small>Product actions</small>
          <strong>{activitiesToShow[0]}</strong>
          <p>{activitiesToShow.slice(1).join(' · ') || 'These are the actions the current scan can begin to connect.'}</p>
        </article>
        <ArrowRight aria-hidden="true" />
        <article>
          <span>03</span><small>What needs protection</small>
          <strong>{dataCount ? dataCount + ' data operations or models observed' : 'Business assets need deeper mapping'}</strong>
          <p>{dataCount ? 'Review which records, balances, prices, states, or customer data should stay protected.' : 'The current parser did not connect a supported data operation to this scan.'}</p>
        </article>
        <ArrowRight aria-hidden="true" />
        <article>
          <span>04</span><small>Rules to confirm</small>
          <strong>{businessCandidates.length ? businessCandidates.length + ' sensitive operation' + (businessCandidates.length === 1 ? '' : 's') + ' need review' : 'No sensitive-mutation candidate reported'}</strong>
          <p>{businessCandidates.length ? 'Check whether server-side rules, atomic changes, and expected controls are truly in place.' : 'That does not prove product rules are complete; review the coverage in Technical Evidence.'}</p>
        </article>
      </div>
      <section className="product-model-examples">
        <div>
          <span>Helpful questions for a product review</span>
          <h4>Examples to consider next</h4>
          <p>These are review prompts, not findings from this scan.</p>
        </div>
        <ul>{examples.map((example) => <li key={example}><Check size={15} />{example}</li>)}</ul>
      </section>
    </section>
  );
}

function ExecutiveSummary({
  scan,
  entries,
  areas,
  selectedArea,
  onSelectArea,
  onOpenFinding,
  onOpenFindings,
}: {
  scan: Scan;
  entries: ExecutiveEntry[];
  areas: ExecutiveArea[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  onOpenFinding: (finding: Finding) => void;
  onOpenFindings: () => void;
}) {
  const priority = entries.filter((entry) => ['critical', 'high'].includes(entry.finding.severity));
  const open = entries.filter((entry) => entry.finding.review_status === 'open');
  const relevant = selectedArea
    ? entries.filter((entry) => entry.areas.some((area) => areaKey(area) === selectedArea))
    : entries;
  const selectedAreaName = areas.find((area) => area.key === selectedArea)?.name;
  const businessSummary = scan.business_impact_overview?.summary ||
    'This scan connects potential risks to the product operations and people they could affect. Review the evidence before deciding what is real.';
  const directSummary = businessSummary.length > 360
    ? businessSummary.slice(0, businessSummary.lastIndexOf(' ', 360)) + '…'
    : businessSummary;
  const topRisk = relevant[0] || entries[0];

  return (
    <section className="business-brief" aria-label="Business risk briefing">
      <header className="business-brief-hero">
        <div>
          <span>Business risk briefing</span>
          <h3>Here is what needs a product decision.</h3>
          <p>{directSummary}</p>
        </div>
        <div className="business-brief-action">
          <small>Start here</small>
          <strong>{(open.length || entries.length) + ' potential risk' + ((open.length || entries.length) === 1 ? '' : 's') + ' need a decision'}</strong>
          <Button onClick={onOpenFindings}>Review the evidence <ArrowRight size={16} /></Button>
        </div>
      </header>

      {scan.business_impact_overview?.status !== 'ready' && (
        <BusinessImpactOverview key={scan.id + '-executive-business-impact'} scan={scan} />
      )}

      <section className="business-brief-steps" aria-label="Business review steps">
        <article><span>1</span><div><small>What we saw</small><strong>{priority.length ? priority.length + ' priority items need review' : entries.length + ' potential items were reported'}</strong><p>These are source-backed candidates, not confirmed breaches.</p></div></article>
        <article><span>2</span><div><small>What could be affected</small><strong>{areas.length ? areas.slice(0, 2).map((area) => area.name).join(' and ') : 'Your product operations'}</strong><p>Business areas are advisory context used to organize the review.</p></div></article>
        <article><span>3</span><div><small>What to do now</small><strong>Decide whether the recorded control is sufficient</strong><p>Open a scenario, inspect its evidence, then confirm, dismiss, or keep it open.</p></div></article>
      </section>

      <section className="business-scenarios" aria-labelledby="business-scenarios-title">
        <header>
          <div><span>{selectedAreaName || 'All business areas'}</span><h4 id="business-scenarios-title">The conversations to have first</h4></div>
          <small aria-live="polite">{relevant.length + ' potential review item' + (relevant.length === 1 ? '' : 's')}</small>
        </header>
        <div className="business-area-filter" role="group" aria-label="Filter scenarios by business area">
          <button type="button" aria-controls="business-scenario-list" aria-pressed={!selectedArea} onClick={() => onSelectArea('')}>All areas <span>{entries.length}</span></button>
          {areas.slice(0, 5).map((area) => <button type="button" aria-controls="business-scenario-list" key={area.key} aria-pressed={selectedArea === area.key} onClick={() => onSelectArea(selectedArea === area.key ? '' : area.key)}>{area.name}<span>{area.count}</span></button>)}
        </div>
        {relevant.length ? <div id="business-scenario-list" className="business-scenario-list" aria-live="polite">{relevant.slice(0, 4).map((entry, index) => (
          <article key={entry.finding.id}>
            <span className="scenario-number">{'0' + (index + 1)}</span>
            <div>
              <small>Potential outcome · {entry.finding.route ? 'Customer-facing operation' : 'Service safeguard'}</small>
              <h5>{businessConsequence(entry.finding)}</h5>
              <p><strong>What creates this possibility:</strong> {businessTrigger(entry.finding)}</p>
            </div>
            <div className="scenario-actions">
              <span className={'plain-severity ' + entry.finding.severity}><i />{severityMessage(entry.finding.severity)}</span>
              <Button variant="outline" size="sm" onClick={() => onOpenFinding(entry.finding)}>See evidence <ArrowUpRight size={14} /></Button>
            </div>
          </article>
        ))}</div> : <p className="business-empty">There are no potential risks in this area. Choose another area or check Technical Evidence for coverage details.</p>}
      </section>

      {topRisk && <section className="business-next">
        <div><span>A simple way to use this view</span><h4>Start with the consequence, then verify the proof.</h4><p>Select a conversation above to see its related source path, INVARIANT decision ledger, assumptions, and remediation.</p></div>
        <Button variant="outline" onClick={() => onOpenFinding(topRisk.finding)}>Open the first review <ArrowUpRight size={15} /></Button>
      </section>}
    </section>
  );
}

function name(s: Scan) {
  if (s.source === 'fixture') return fixtures[s.repository] || s.repository;
  const repository = s.repository.replace('https://github.com/', '');
  return repository === 'shashankk-42/taskforge-decentralized-compute-marketplace'
    ? 'TaskForge marketplace'
    : repository;
}
function GitHubMark({ size = 29 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.08c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.92 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.49 11.49 0 0 1 12 6.76c1.02 0 2.05.14 3.01.41 2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.61-5.47 5.91.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}
function date(s: string) {
  return new Date(
    s.endsWith('Z') || s.includes('+') ? s : s + 'Z',
  ).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function Status({ value }: { value: string }) {
  return (
    <span className={'status status-' + value}>
      <i />
      {value.replaceAll('-', ' ')}
    </span>
  );
}
function Picker({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: Record<string, string>;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v || Object.keys(options)[0])}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue>{options[value] || value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([key, title]) => (
          <SelectItem value={key} key={key}>
            {title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Home() {
  const [scans, setScans] = useState<Scan[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [scan, setScan] = useState<Scan | null>(null);
  const [models, setModels] = useState<Models | null>(null),
    [connected, setConnected] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [source, setSource] = useState('github'),
    [repository, setRepository] = useState(target),
    [fixture, setFixture] = useState('bola-vulnerable');
  const [documents, setDocuments] = useState<File[]>([]);
  const documentInput = useRef<HTMLInputElement>(null);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [workspaceSection, setWorkspaceSection] = useState<'history' | 'results'>('results');
  const [useModel, setUseModel] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all');
  const [finding, setFinding] = useState<Finding | null>(null),
    [note, setNote] = useState(''),
    [saving, setSaving] = useState(false),
    [lens, setLens] = useState<'business' | 'technical'>('business'),
    [tab, setTab] = useState('summary'),
    [executiveArea, setExecutiveArea] = useState(''),
    [graphRoute, setGraphRoute] = useState(''),
    [graphNodeId, setGraphNodeId] = useState('');
  const refresh = useCallback(async () => {
    try {
      const rows = await api<Scan[]>('/scans');
      setScans(rows);
      setConnected(true);
      setSelected((v) => v || rows[0]?.id || null);
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const update = () =>
      api<Models>('/models')
        .then(setModels)
        .catch(() => setModels(null));
    update();
    const t = setInterval(update, 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setScan(null);
    setFinding(null);
    const requestedLens = new URLSearchParams(window.location.search).get('lens');
    const nextLens = requestedLens === 'technical' ? 'technical' : 'business';
    setLens(nextLens);
    setTab(nextLens === 'business' ? 'summary' : 'findings');
    setExecutiveArea('');
    setGraphRoute('');
    const update = () =>
      api<Scan>('/scans/' + selected)
        .then((s) => {
          if (active) setScan(s);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    update();
    const t = setInterval(update, 2500);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [selected]);
  useEffect(() => {
    if (!finding) return;
    const frame = requestAnimationFrame(() => sheetBodyRef.current?.scrollTo({ top: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [finding?.id]);
  const filtered = (scan?.findings || []).filter(
    (f) =>
      (category === 'all' || f.category === category) &&
      `${f.title} ${f.route} ${f.evidence.map((e) => e.file).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const activeScan = scan && ['queued', 'running'].includes(scan.status);
  const routes = scan?.graph?.nodes.filter((n) => n.kind === 'Route') || [];
  const routeId = graphRoute || routes[0]?.id || '';
  const graph = useMemo(() => {
    if (!scan?.graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const ids = new Set([routeId]);
    for (let i = 0; i < 4; i++)
      for (const e of scan.graph.edges)
        if (ids.has(e.source)) ids.add(e.target);
    return {
      nodes: scan.graph.nodes.filter((n) => ids.has(n.id)),
      edges: scan.graph.edges.filter(
        (e) => ids.has(e.source) && ids.has(e.target),
      ),
    };
  }, [scan, routeId]);
  const graphLayout = useMemo(() => {
    const lanes = [
      ['Route'],
      ['Input', 'Middleware'],
      ['Function'],
      ['Query', 'Model', 'Identity'],
    ];
    const positioned = graph.nodes.map((node) => {
      const laneIndex = Math.max(
        0,
        lanes.findIndex((kinds) => kinds.includes(node.kind)),
      );
      const laneNodes = graph.nodes.filter((candidate) =>
        lanes[laneIndex].includes(candidate.kind),
      );
      const nodeIndex = laneNodes.findIndex((candidate) => candidate.id === node.id);
      return { ...node, x: 13 + laneIndex * 25, y: 78 + nodeIndex * 102 };
    });
    const height = Math.max(
      420,
      ...lanes.map(
        (kinds) => graph.nodes.filter((node) => kinds.includes(node.kind)).length * 102 + 108,
      ),
    );
    return {
      height,
      nodes: positioned,
      edges: graph.edges
        .map((edge) => ({
          ...edge,
          sourceNode: positioned.find((node) => node.id === edge.source),
          targetNode: positioned.find((node) => node.id === edge.target),
        }))
        .filter(
          (edge): edge is Edge & { sourceNode: Node & { x: number; y: number }; targetNode: Node & { x: number; y: number } } =>
            Boolean(edge.sourceNode && edge.targetNode),
        ),
    };
  }, [graph]);
  const graphNode =
    graph.nodes.find((node) => node.id === graphNodeId) ||
    graph.nodes.find((node) => node.id === routeId) ||
    graph.nodes[0];
  const businessImpacts = useMemo(
    () => new Map<string, BusinessImpact>(
      (scan?.business_impact_overview?.impacts || []).map((impact) => [
        impact.finding_id,
        impact,
      ]),
    ),
    [scan?.business_impact_overview?.impacts],
  );
  const executiveEntries = useMemo<ExecutiveEntry[]>(
    () => (scan?.findings || [])
      .map((currentFinding) => {
        const impact = businessImpacts.get(currentFinding.id);
        const areas = impact?.affected_areas?.length
          ? impact.affected_areas
          : [businessAreaFallback(currentFinding.category)];
        return {
          finding: currentFinding,
          impact,
          areas,
          weight: severityWeight(currentFinding.severity),
        };
      })
      .sort((left, right) =>
        Number(right.finding.rule_id === 'BFL001') - Number(left.finding.rule_id === 'BFL001') || right.weight - left.weight,
      ),
    [scan?.findings, businessImpacts],
  );
  const executiveAreas = useMemo<ExecutiveArea[]>(() => {
    const totals = new Map<string, ExecutiveArea>();
    for (const entry of executiveEntries) {
      for (const area of entry.areas) {
        const key = areaKey(area);
        const current = totals.get(key) || { key, name: area.trim(), count: 0, weight: 0 };
        current.count += 1;
        current.weight += entry.weight;
        totals.set(key, current);
      }
    }
    return [...totals.values()].sort((left, right) =>
      right.weight - left.weight || right.count - left.count,
    );
  }, [executiveEntries]);
  const openFinding = useCallback((currentFinding: Finding) => {
    setFinding(currentFinding);
    setNote(currentFinding.review_note || '');
  }, []);
  const changeLens = useCallback((nextLens: 'business' | 'technical', nextTab?: string) => {
    setLens(nextLens);
    setTab(nextTab || (nextLens === 'business' ? 'summary' : 'findings'));
    const url = new URL(window.location.href);
    url.searchParams.set('lens', nextLens);
    window.history.replaceState(null, '', url);
  }, []);
  function addDocuments(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const supported = new Set(['md', 'txt', 'pdf', 'docx', 'doc']);
    const invalid = incoming.find((file) => !supported.has(file.name.split('.').pop()?.toLowerCase() || ''));
    const tooLarge = incoming.find((file) => file.size > 8_000_000);
    if (invalid) {
      setError('Business documentation must be MD, TXT, PDF, DOCX, or DOC.');
    } else if (tooLarge) {
      setError(`${tooLarge.name} exceeds the 8 MB document limit.`);
    } else {
      setDocuments((current) => {
        const merged = [...current];
        for (const file of incoming) {
          if (!merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
            merged.push(file);
          }
        }
        if (merged.length > 10) {
          setError('Add at most 10 business documents to one analysis.');
          return current;
        }
        if (merged.reduce((total, file) => total + file.size, 0) > 25_000_000) {
          setError('Business documents exceed the combined 25 MB limit.');
          return current;
        }
        return merged;
      });
    }
    if (documentInput.current) documentInput.current.value = '';
  }
  async function start() {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const payload = new FormData();
      payload.set('source', source);
      payload.set('repository', source === 'github' ? repository.trim() : fixture);
      payload.set('use_model', String(useModel));
      documents.forEach((document) => payload.append('documents', document));
      const r = await api<{ id: string }>('/scans', {
        method: 'POST',
        body: payload,
      });
      setComposerOpen(false);
      setSelected(r.id);
      changeLens('technical', 'findings');
      setDocuments([]);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  async function review(status: string) {
    if (!finding || !scan) return;
    setSaving(true);
    try {
      const f = await api<Finding>(`/scans/${scan.id}/findings/${finding.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      setFinding(f);
      setScan((s) =>
        s
          ? { ...s, findings: s.findings?.map((x) => (x.id === f.id ? f : x)) }
          : s,
      );
      setNotice('Review saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function download(format: string) {
    if (!scan) return;
    try {
      const r = await fetch(`/api/scans/${scan.id}/export?format=${format}`);
      if (!r.ok) throw new Error('Could not export report.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `invaria-${scan.id}.${format === 'json' ? 'json' : 'md'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const composerVisible = composerOpen || (!scan && !selected);
  function openComposer() {
    setComposerOpen(true);
    requestAnimationFrame(() =>
      document.getElementById('analysis')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      }),
    );
  }
  function goToWorkspaceSection(section: 'history' | 'results') {
    setWorkspaceSection(section);
    const targetElement = document.getElementById(section);
    if (!targetElement) return;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetElement.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${section}`);
  }
  return (
    <div>
      <div className="workspace-toolbar">
        <nav aria-label="Workspace navigation">
          <button type="button" onClick={openComposer}><Plus size={15} /> New analysis</button>
          <a
            href="#history"
            aria-current={workspaceSection === 'history' ? 'location' : undefined}
            onClick={(event) => {
              event.preventDefault();
              goToWorkspaceSection('history');
            }}
          >
            History
          </a>
          <a
            href="#results"
            aria-current={workspaceSection === 'results' ? 'location' : undefined}
            onClick={(event) => {
              event.preventDefault();
              goToWorkspaceSection('results');
            }}
          >
            Results
          </a>
        </nav>
        <span className={connected ? 'connection online' : 'connection'}><i />{connected ? 'Engine online' : 'Connecting to engine'}</span>
      </div>
      <main id="main-content" className={'workspace ' + (composerVisible ? 'composer-open' : 'has-results')}>
        <div className="page-heading">
          <div>
            <div className="eyebrow">INVARIA / APPLICATION SECURITY</div>
            <h1>Know what your code is telling you.</h1>
            <p>
              Scan repositories, trace the evidence, and focus your review on
              the risks that matter.
            </p>
          </div>
          <div className="stamp">
            <Fingerprint size={29} />
            <span>
              STATIC ANALYSIS
              <br />
              <strong>Evidence first</strong>
            </span>
          </div>
        </div>
        {error && (
          <div className="banner error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="banner success" role="status">
            <Check size={17} />
            <span>{notice}</span>
            <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
              <X size={15} />
            </button>
          </div>
        )}
        <section id="analysis" className="scan-launch" aria-label="Start analysis">
          <div className="launch-top">
            <span>
              <GitBranch size={15} />
              NEW ANALYSIS
            </span>
            <small>
              <ShieldCheck size={14} />
              Source is read, never executed
            </small>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <div className="launch-controls">
              <Picker
                value={source}
                onChange={setSource}
                label="Scan source"
                options={{ github: 'Public GitHub', fixture: 'Test fixture' }}
              />
              {source === 'github' ? (
                <Input
                  required
                  className="repo-input"
                  aria-label="GitHub repository URL"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                />
              ) : (
                <div className="fixture-picker">
                  <Picker
                    value={fixture}
                    onChange={setFixture}
                    label="Test fixture"
                    options={fixtures}
                  />
                </div>
              )}
              <input
                ref={documentInput}
                className="document-input"
                type="file"
                accept=".md,.txt,.pdf,.docx,.doc,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                multiple
                aria-label="Optional business documentation"
                onChange={(e) => addDocuments(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="document-button"
                onClick={() => documentInput.current?.click()}
              >
                <FileCode2 size={15} />
                Add docs
                {documents.length ? <span>{documents.length}</span> : null}
              </Button>
              <Button
                type="submit"
                className="scan-button"
                disabled={submitting || !connected}
              >
                {submitting ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
                Run analysis
                <ArrowRight size={16} />
              </Button>
            </div>
            <div className="document-context">
              <p>
                Optional business context. Documents are untrusted hints: they
                never become source evidence or prove a security finding.
              </p>
              {documents.length > 0 && (
                <ul aria-label="Documents selected for upload">
                  {documents.map((document) => (
                    <li key={`${document.name}-${document.lastModified}`}>
                      <FileCode2 size={13} />
                      <span>
                        {document.name}{' '}
                        <small>{Math.ceil(document.size / 1024)} KB</small>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${document.name}`}
                        onClick={() =>
                          setDocuments((current) =>
                            current.filter((item) => item !== document),
                          )
                        }
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="launch-bottom">
              <label>
                <Checkbox
                  checked={useModel}
                  onCheckedChange={(v) => setUseModel(v === true)}
                  disabled={!models?.reasoning_ready}
                />
                <Sparkles size={14} />
                Include Gemma evidence review{' '}
                <span>
                  {models?.reasoning_ready ? 'Ready' : 'Model unavailable'}
                </span>
              </label>
              <small>
                  JS / TS / Python <b>·</b> Express <b>·</b> Public repositories
              </small>
            </div>
          </form>
        </section>
        <div className="workspace-grid">
          <aside id="history" className="history workspace-target" tabIndex={-1}>
            <div className="history-title">
              ANALYSIS HISTORY <span className="count">{scans.length}</span>
            </div>
            {loading ? (
              <p className="empty-history">Loading scans…</p>
            ) : !scans.length ? (
              <p className="empty-history">Your scans will appear here.</p>
            ) : (
              <div className="history-list">
                {scans.map((s) => (
                  <button
                    key={s.id}
                    className={
                      'history-item ' + (selected === s.id ? 'selected' : '')
                    }
                    onClick={() => {
                      setSelected(s.id);
                      setComposerOpen(false);
                      setQuery('');
                      setCategory('all');
                    }}
                  >
                    <div>
                      {s.source === 'fixture' ? (
                        <FlaskConical size={15} />
                      ) : (
                        <GitFork size={15} />
                      )}
                      <span>
                        {s.source === 'fixture'
                          ? s.repository
                          : s.repository.split('/').at(-1)}
                      </span>
                    </div>
                    <footer>
                      <span>{date(s.created_at)}</span>
                      {s.status === 'completed' ? (
                        <strong
                          className={s.summary?.total ? 'has-findings' : ''}
                        >
                          {s.summary?.total || 0}
                        </strong>
                      ) : (
                        <Status value={s.status} />
                      )}
                    </footer>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="new-analysis" onClick={openComposer}>
              <Plus size={17} />
              New analysis
            </button>
            <div className="engine-card">
              <h3>
                <Activity size={16} />
                Engine status
              </h3>
              <p>
                <span>AST parser</span>
                <strong>Tree-sitter</strong>
              </p>
              <p>
                <span>Reasoning</span>
                <strong>
                  {models?.reasoning_ready ? 'Gemma ready' : 'Not connected'}
                </strong>
              </p>
              <p>
                <span>Embeddings</span>
                <strong>
                  {models?.embedding_ready ? 'Ready' : 'Not connected'}
                </strong>
              </p>
              <small>
                A clean scan reflects supported checks, not a security
                guarantee.
              </small>
            </div>
          </aside>
          <section
            id="results"
            className="results workspace-target"
            tabIndex={-1}
            aria-label="Analysis results"
            aria-busy={!!activeScan}
          >
            {!scan ? (
              <div className="welcome">
                <div className="welcome-icon">
                  <Network size={38} />
                </div>
                <div className="eyebrow">FROM CODE TO CONTEXT</div>
                <h2>
                  {selected
                    ? 'Opening analysis…'
                    : 'Your first investigation starts here.'}
                </h2>
                <p>
                  Run TaskForge above, or choose a vulnerable fixture to see a
                  complete evidence trail.
                </p>
                <div>
                  <span>
                    <FileCode2 size={18} />
                    Source
                  </span>
                  <ArrowRight size={15} />
                  <span>
                    <Network size={18} />
                    Security graph
                  </span>
                  <ArrowRight size={15} />
                  <span>
                    <ShieldCheck size={18} />
                    Findings
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="result-heading">
                  <div className="result-repository">
                    <span
                      className="repo-icon"
                      aria-label={scan.source === 'github' ? 'GitHub repository' : 'Test fixture'}
                    >
                      {scan.source === 'github' ? (
                        <GitHubMark />
                      ) : (
                        <FlaskConical size={27} />
                      )}
                    </span>
                    <div>
                      <div className="breadcrumb">
                        Workspace
                        <ChevronRight size={12} />
                        Analysis<code>{scan.id.slice(0, 8)}</code>
                      </div>
                      <h2>{name(scan)}</h2>
                      <div className="result-meta">
                        <Status value={scan.status} />
                        {scan.commit && (
                          <span>
                            <GitBranch size={12} />
                            {scan.commit.slice(0, 8)}
                          </span>
                        )}
                        <span>{date(scan.created_at)}</span>
                        {scan.duration_seconds != null && (
                          <span>{scan.duration_seconds.toFixed(1)}s</span>
                        )}
                        {!!scan.documentation?.documents.length && (
                          <span>
                            <FileCode2 size={12} />
                            {scan.documentation.documents.length} business doc
                            {scan.documentation.documents.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="export-buttons">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={scan.status !== 'completed'}
                      onClick={() => download('markdown')}
                    >
                      <ArrowDownToLine size={14} />
                      Report
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={scan.status !== 'completed'}
                      onClick={() => download('json')}
                    >
                      <Braces size={14} />
                      JSON
                    </Button>
                  </div>
                </div>
                {activeScan && (
                  <div className="pipeline" role="status">
                    <p>
                      <LoaderCircle size={17} className="spin" />
                      {scan.events?.at(-1)?.message ||
                        'Waiting for the local worker…'}
                    </p>
                    <div>
                      {stages.map((s, i) => (
                        <div
                          key={s}
                          className={
                            stages.indexOf(scan.stage) >= i ? 'current' : ''
                          }
                        >
                          <span>
                            {stages.indexOf(scan.stage) > i ? (
                              <Check size={12} />
                            ) : (
                              i + 1
                            )}
                          </span>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {scan.status === 'failed' && (
                  <div className="clear-state failed">
                    <CircleAlert size={30} />
                    <h3>Analysis could not finish</h3>
                    <p>{scan.error}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSource(scan.source);
                        if (scan.source === 'fixture')
                          setFixture(scan.repository);
                        else setRepository(scan.repository);
                        setNotice(
                          'Source loaded above. Reattach documents if you want them included, then run analysis.',
                        );
                      }}
                    >
                      Load source to retry
                    </Button>
                  </div>
                )}
                {scan.status === 'completed' && (
                  <>
                    {lens === 'technical' && <div className="metrics">
                      <div>
                        <span>Findings to review</span>
                        <strong>
                          {scan.summary?.total || 0}
                          <small>potential risks</small>
                        </strong>
                        <div className="severity-track">
                          {['critical', 'high', 'medium', 'low'].map((s) => (
                            <i
                              key={s}
                              className={s}
                              style={{ flex: scan.summary?.[s] || 0.08 }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span>High severity</span>
                        <strong className={scan.summary?.high ? 'orange' : ''}>
                          {(scan.summary?.high || 0) +
                            (scan.summary?.critical || 0)}
                          <small>high / critical</small>
                        </strong>
                      </div>
                      <div>
                        <span>Endpoints mapped</span>
                        <strong>
                          {scan.coverage?.routes || 0}
                          <small>Express routes</small>
                        </strong>
                      </div>
                      <div>
                        <span>Source files parsed</span>
                        <strong>
                          {scan.coverage?.parsed_files || 0}
                          <small>
                            of {scan.coverage?.source_files || 0} inventoried
                          </small>
                        </strong>
                      </div>
                    </div>}
                    <div className="dashboard-lens" aria-label="Choose dashboard lens">
                      <div>
                        <span>View this scan through</span>
                        <strong>{lens === 'business' ? 'Business risk' : 'Technical evidence'}</strong>
                      </div>
                      <div className="lens-switch">
                        <button type="button" aria-pressed={lens === 'business'} onClick={() => changeLens('business')}>Business risk</button>
                        <button type="button" aria-pressed={lens === 'technical'} onClick={() => changeLens('technical')}>Technical evidence</button>
                      </div>
                    </div>
                    <Tabs
                      value={tab}
                      onValueChange={(v) => setTab(String(v))}
                      className="report-tabs"
                    >
                      <div className="tabbar">
                        <TabsList variant="line">
                          {lens === 'business' ? <>
                            <TabsTrigger value="summary"><Activity size={14} /> Decision briefing</TabsTrigger>
                            <TabsTrigger value="model"><Network size={14} /> Product map</TabsTrigger>
                          </> : <>
                            <TabsTrigger value="findings"><Shield size={14} /> Findings <span className="count">{scan.summary?.total || 0}</span></TabsTrigger>
                            <TabsTrigger value="graph"><Network size={14} /> Security graph</TabsTrigger>
                            <TabsTrigger value="model"><Network size={14} /> Application model</TabsTrigger>
                            <TabsTrigger value="coverage"><SlidersHorizontal size={14} /> Coverage & audit</TabsTrigger>
                          </>}
                        </TabsList>
                        <span>
                          <ShieldCheck size={13} />
                          Source references checked
                        </span>
                      </div>
                      <TabsContent value="model">
                        {lens === 'business' ? (
                          <ProductModel
                            scan={scan}
                            entries={executiveEntries}
                            onOpenTechnical={() => changeLens('technical', 'model')}
                          />
                        ) : (
                          <ApplicationModel
                            scan={scan}
                            onOpenGraph={(routeId) => {
                              setGraphRoute(routeId);
                              setGraphNodeId(routeId);
                              changeLens('technical', 'graph');
                            }}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="summary">
                        <ExecutiveSummary
                          scan={scan}
                          entries={executiveEntries}
                          areas={executiveAreas}
                          selectedArea={executiveArea}
                          onSelectArea={setExecutiveArea}
                          onOpenFinding={openFinding}
                          onOpenFindings={() => {
                            setExecutiveArea('');
                            changeLens('technical', 'findings');
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="findings">
                        <ProductOverview key={scan.id} scan={scan} />
                        <BusinessImpactOverview key={`${scan.id}-business-impact`} scan={scan} />
                        <div className="findings-toolbar">
                          <div className="findings-toolbar-heading">
                            <span>Potential findings</span>
                            <small>
                              {scan.summary?.total || 0} items need review
                            </small>
                          </div>
                          <div className="finding-controls">
                            <div className="finding-search">
                              <Search size={16} />
                              <Input
                                aria-label="Search findings"
                                placeholder="Search findings, endpoints or files…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                              />
                            </div>
                            <Picker
                              value={category}
                              onChange={setCategory}
                              label="Finding category"
                              options={{
                                all: 'All categories',
                                authorization: 'Authorization',
                                business_logic: 'Business flows',
                                injection: 'Injection',
                                secrets: 'Secrets',
                              }}
                            />
                          </div>
                        </div>
                        {filtered.length ? (
                          <div className="findings-list">
                            {filtered.map((f) => (
                              <button
                                className="finding-row"
                                key={f.id}
                                onClick={() => openFinding(f)}
                              >
                                <span
                                  className={'finding-symbol ' + f.category}
                                >
                                  {f.category === 'authorization' ? (
                                    <Fingerprint size={22} />
                                  ) : f.category === 'injection' ? (
                                    <Terminal size={21} />
                                  ) : (
                                    <Shield size={21} />
                                  )}
                                </span>
                                <div className="finding-main">
                                  <h3>
                                    {f.title}
                                    <code>{f.rule_id}</code>
                                  </h3>
                                  <p>{f.route || f.evidence[0]?.file}</p>
                                  <small>
                                    <FileCode2 size={12} />
                                    {f.evidence.at(-1)?.file}:
                                    {f.evidence.at(-1)?.line}
                                    <b>·</b>
                                    {f.evidence.length} evidence references
                                    {f.review_status !== 'open' && (
                                      <em>{f.review_status}</em>
                                    )}
                                  </small>
                                  {businessImpacts.get(f.id) && (
                                    <span className="finding-business-impact">
                                      <Sparkles size={13} aria-hidden="true" />
                                      <span><b>Business impact:</b> {businessImpacts.get(f.id)?.business_impact}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="finding-right">
                                  <span className={'plain-severity ' + f.severity}>
                                    <i />
                                    {severityMessage(f.severity)}
                                  </span>
                                  <span className={'severity ' + f.severity}>
                                    <i />
                                    {f.severity}
                                  </span>
                                  <small>
                                    {Math.round(f.confidence * 100)}% confidence
                                  </small>
                                </div>
                                <ChevronRight className="row-arrow" size={16} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="clear-state">
                            <ShieldCheck size={34} />
                            <h3>
                              {scan.findings?.length
                                ? 'No findings match your filters'
                                : 'No findings from supported checks'}
                            </h3>
                            <p>
                              {scan.findings?.length
                                ? 'Try a different category or search term.'
                                : 'Review coverage and unsupported patterns before drawing conclusions about security.'}
                            </p>
                          </div>
                        )}
                        <div className="findings-footer">
                          <span>
                            {filtered.length} of {scan.findings?.length || 0}{' '}
                            findings
                          </span>
                          <span>
                            Confidence is a rule heuristic, not exploit
                            probability.
                          </span>
                        </div>
                      </TabsContent>
                      <TabsContent value="graph">
                        <div className="graph-toolbar">
                          <div>
                            <h3>Relationship investigation</h3>
                            <p>
                              A connected view of the selected endpoint and its extracted source relationships.
                            </p>
                          </div>
                          {routes.length > 0 && (
                            <Picker
                              value={routeId}
                              onChange={(value) => {
                                setGraphRoute(value);
                                setGraphNodeId('');
                              }}
                              label="Graph endpoint"
                              options={Object.fromEntries(
                                routes.map((r) => [r.id, r.label]),
                              )}
                            />
                          )}
                        </div>
                        {graph.nodes.length ? (
                          <div className="graph-shell">
                            <aside className="graph-inspector" aria-label="Selected graph node">
                              <span className="graph-inspector-label">SELECTED NODE</span>
                              <strong>{graphNode?.label || 'No node selected'}</strong>
                              <span className={'graph-kind node-' + graphNode?.kind}>{graphNode?.kind || 'Unknown'}</span>
                              {graphNode?.file ? <code>{graphNode.file}:{graphNode.line}</code> : <p>Source location is not available for this extracted node.</p>}
                              <dl>
                                <div><dt>Connected</dt><dd>{graphLayout.edges.filter((edge) => edge.source === graphNode?.id || edge.target === graphNode?.id).length}</dd></div>
                                <div><dt>Visible nodes</dt><dd>{graph.nodes.length}</dd></div>
                                <div><dt>Relationships</dt><dd>{graph.edges.length}</dd></div>
                              </dl>
                              <button type="button" onClick={() => setGraphNodeId(routeId)}>Return to route focus</button>
                            </aside>
                            <section className="graph-canvas" aria-label="Endpoint relationship map">
                              <div className="graph-canvas-header">
                                <div><span className="graph-live-marker"><i /> SOURCE MAP</span><strong>Endpoint network</strong></div>
                                <span>{graph.nodes.length} nodes · {graph.edges.length} links</span>
                              </div>
                              <div className="graph-legend" aria-label="Node legend">
                                {['Route', 'Input', 'Middleware', 'Function', 'Query', 'Model', 'Identity'].map((kind) => <span key={kind}><i className={'node-' + kind} />{kind}</span>)}
                              </div>
                              <div className="graph-plot" style={{ minHeight: `${graphLayout.height}px` }}>
                                <svg className="graph-wires" viewBox={`0 0 100 ${graphLayout.height}`} preserveAspectRatio="none" aria-hidden="true">
                                  <defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
                                  {graphLayout.edges.map((edge, index) => {
                                    const middle = (edge.sourceNode.x + edge.targetNode.x) / 2;
                                    return <path key={`${edge.source}-${edge.target}-${index}`} d={`M ${edge.sourceNode.x} ${edge.sourceNode.y + 24} C ${middle} ${edge.sourceNode.y + 24}, ${middle} ${edge.targetNode.y + 24}, ${edge.targetNode.x} ${edge.targetNode.y + 24}`} markerEnd="url(#graph-arrow)" />;
                                  })}
                                </svg>
                                <div className="graph-lanes" aria-hidden="true"><span>ENTRY</span><span>CONTROLS</span><span>EXECUTION</span><span>DATA & IDENTITY</span></div>
                                {graphLayout.nodes.map((node) => (
                                  <button type="button" key={node.id} className={`graph-node node-${node.kind} ${graphNode?.id === node.id ? 'selected' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}px` }} onClick={() => setGraphNodeId(node.id)} aria-pressed={graphNode?.id === node.id}>
                                    <span>{node.kind}</span><strong>{node.label}</strong>{node.file && <small>{node.file}:{node.line}</small>}
                                  </button>
                                ))}
                              </div>
                            </section>
                          </div>
                        ) : (
                          <div className="clear-state graph-empty"><Network size={30} /><p>No supported route graph was extracted.</p></div>
                        )}
                        <div className="graph-edges">
                          <h3>
                            Extracted relationships{' '}
                            <span className="count">{graph.edges.length}</span>
                          </h3>
                          {graph.edges.map((e, i) => (
                            <div key={i}>
                              <span>
                                {
                                  graph.nodes.find((n) => n.id === e.source)
                                    ?.label
                                }
                              </span>
                              <code>{e.kind}</code>
                              <ArrowRight size={13} />
                              <span>
                                {
                                  graph.nodes.find((n) => n.id === e.target)
                                    ?.label
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="coverage">
                        <div className="audit-grid">
                          <div>
                            <Activity size={20} />
                            <h3>Analysis coverage</h3>
                            <p>
                              {scan.coverage?.resolved_routes || 0} /{' '}
                              {scan.coverage?.routes || 0} route handlers
                              resolved
                            </p>
                            <p>
                              {scan.coverage?.functions || 0} named functions
                              extracted
                            </p>
                            <p>Semgrep: {scan.semgrep?.status || 'unknown'}</p>
                          </div>
                          <div>
                            <Sparkles size={20} />
                            <h3>Reasoning & retrieval</h3>
                            <p>
                              Model review:{' '}
                              {scan.model_status?.replaceAll('-', ' ')}
                            </p>
                            <p>
                              Guidance:{' '}
                              {scan.retrieval_modes?.join(', ') ||
                                'No retrieval needed'}
                            </p>
                            <p>
                              Model output never changes the static evidence.
                            </p>
                          </div>
                        </div>
                        <section className="documentation-audit">
                          <div className="documentation-audit-heading">
                            <FileCode2 size={19} />
                            <div>
                              <h3>Business documentation</h3>
                              <p>
                                Untrusted context only. It is excluded from
                                source evidence and finding verification.
                              </p>
                            </div>
                          </div>
                          {scan.documentation?.documents.length ? (
                            <div className="documentation-list">
                              {scan.documentation.documents.map((document) => (
                                <article key={document.id}>
                                  <div>
                                    <strong>{document.name}</strong>
                                    <span className={'document-status ' + document.status}>
                                      {document.status.replaceAll('-', ' ')}
                                    </span>
                                  </div>
                                  <p>
                                    {document.characters_extracted.toLocaleString()} extracted characters
                                    {document.headings.length
                                      ? ` · ${document.headings.join(' · ')}`
                                      : ''}
                                  </p>
                                  {document.excerpt && <blockquote>{document.excerpt}</blockquote>}
                                  {document.error && <p className="document-error">{document.error}</p>}
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="documentation-empty">
                              No business documentation was attached to this analysis.
                            </p>
                          )}
                        </section>
                        {!!scan.warnings?.length && (
                          <div className="coverage-warnings">
                            <h3>
                              <CircleAlert size={17} />
                              Scan notes
                            </h3>
                            {scan.warnings.map((w, i) => (
                              <p key={i}>{w}</p>
                            ))}
                          </div>
                        )}
                        <div className="route-table">
                          <h3>Endpoint inventory</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Endpoint</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Handler</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scan.routes?.map((r, i) => (
                                <TableRow key={i}>
                                  <TableCell>
                                    <span className="method">{r.method}</span>{' '}
                                    {r.path}
                                  </TableCell>
                                  <TableCell>
                                    <code>
                                      {r.file}:{r.line}
                                    </code>
                                  </TableCell>
                                  <TableCell>
                                    {r.resolved ? 'Resolved' : 'Unsupported'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="limitations">
                          <h3>Scope of this report</h3>
                          {scan.limitations?.map((l, i) => (
                            <p key={i}>{l}</p>
                          ))}
                        </div>
                        <div className="audit-timeline">
                          <h3>Pipeline audit</h3>
                          {scan.events?.map((e) => (
                            <div key={e.stage}>
                              <Check size={14} />
                              <strong>{e.stage}</strong>
                              <span>{e.message}</span>
                              <code>{e.elapsed_seconds}s</code>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </>
            )}
          </section>
          <aside className="evidence-rail" aria-label="Evidence-backed analysis">
            <div>
              <ShieldCheck size={25} />
              <h2>Evidence-backed</h2>
              <p>
                Each static finding links to source evidence, with assumptions
                and coverage limits visible alongside it.
              </p>
            </div>
            <ul>
              <li>
                <Check size={14} />
                Links to exact source locations
              </li>
              <li>
                <Check size={14} />
                Shows the reason and impact
              </li>
              <li>
                <Check size={14} />
                Cross-checked with multiple rules
              </li>
              <li>
                <Check size={14} />
                Reduces noise with evidence
              </li>
            </ul>
            <div className="evidence-rail-bottom">
              <h3>Why it matters</h3>
              <p>
                Trace the evidence, check the assumptions, and record your
                judgment. Every candidate still needs human review.
              </p>
              <blockquote>
                Evidence turns security from a black box into a conversation.
              </blockquote>
            </div>
          </aside>
        </div>

      </main>
      <Sheet
        open={!!finding}
        onOpenChange={(v) => {
          if (!v) setFinding(null);
        }}
      >
        <SheetContent className="finding-sheet">
          {finding && (
            <>
              <SheetHeader>
                <div className="sheet-kicker">
                  <span className={'severity ' + finding.severity}>
                    {finding.severity}
                  </span>
                  <code>{finding.rule_id}</code>
                </div>
                <SheetTitle>{finding.title}</SheetTitle>
                <SheetDescription>
                  {finding.route || finding.evidence[0]?.file}
                </SheetDescription>
              </SheetHeader>
              <div className="sheet-body" key={finding.id} ref={sheetBodyRef}>
                <section className="finding-impact-hero">
                  <div className="finding-impact-heading">
                    <div>
                      <span>Business lens</span>
                      <h3><Sparkles size={17} /> Potential business impact</h3>
                    </div>
                    {businessImpacts.get(finding.id) && <small>Local Gemma · advisory</small>}
                  </div>
                  <p>{businessImpacts.get(finding.id)?.business_impact || finding.impact}</p>
                  {businessImpacts.get(finding.id) && (
                    <>
                      <div className="finding-impact-tags">
                        {businessImpacts.get(finding.id)?.affected_areas.map((area) => (
                          <span key={area}>{area}</span>
                        ))}
                      </div>
                      <small className="finding-impact-caveat">{businessImpacts.get(finding.id)?.caveat}</small>
                    </>
                  )}
                </section>
                <div className="evidence-status">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Static evidence verified</strong>
                    <p>
                      Source references match the snapshot. Exploitability needs
                      review.
                    </p>
                  </div>
                </div>
                {finding.algorithm && (
                  <section className="invariant-ledger">
                    <div className="ledger-heading"><div><span>INVARIANT decision ledger</span><h3>{finding.algorithm.code_name} {finding.algorithm.version}</h3></div><small>{finding.algorithm.evidence_gate.passed ? 'Evidence gate passed' : 'Evidence incomplete'}</small></div>
                    <p>{finding.algorithm.hypothesis}</p>
                    <div className="ledger-grid">
                      <div><strong>Observed evidence</strong><span>{finding.algorithm.evidence_gate.observed_kinds.join(', ') || 'No recorded evidence kinds'}</span></div>
                      <div><strong>Policy coverage</strong><span>{finding.algorithm.policy?.coverage || 'No repository policy matched'}</span></div>
                    </div>
                    {!!finding.algorithm.risk_signals.length && <div className="ledger-tags">{finding.algorithm.risk_signals.map((signal) => <span key={signal}>{signal}</span>)}</div>}
                    {!!finding.algorithm.unresolved_conditions.length && <small className="ledger-note">Review condition: {finding.algorithm.unresolved_conditions[0]}</small>}
                  </section>
                )}
                <section>
                  <h3>What we found</h3>
                  <p>{finding.summary}</p>
                </section>
                <section>
                  <h3>Evidence trail</h3>
                  {finding.evidence.map((e) => (
                    <div className="code-evidence" key={e.id}>
                      <div>
                        <FileCode2 size={14} />
                        <strong>{e.file}</strong>
                        <span>
                          Lines {e.line}–{e.end_line}
                        </span>
                      </div>
                      <pre>
                        {e.snippet.split('\n').map((line, i) => (
                          <span key={i}>
                            <em>{e.line + i}</em>
                            <code>{line || ' '}</code>
                          </span>
                        ))}
                      </pre>
                    </div>
                  ))}
                </section>
                {!!finding.attack_path.length && (
                  <section>
                    <h3>Potential attack path</h3>
                    <ol className="attack-path">
                      {finding.attack_path.map((p, i) => (
                        <li key={i}>
                          <span>{i + 1}</span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <section className="remediation">
                  <h3>
                    <Check size={17} />
                    Recommended remediation
                  </h3>
                  <p>{finding.remediation}</p>
                </section>
                <section>
                  <h3>Assumptions to check</h3>
                  <ul>
                    {finding.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </section>
                {finding.reasoning && (
                  <section className="model-reasoning">
                    <h3>
                      <Sparkles size={17} />
                      Model review <small>Advisory</small>
                    </h3>
                    <p>{finding.reasoning.explanation}</p>
                    <small>
                      {finding.reasoning.model} ·{' '}
                      {finding.reasoning.verdict.replaceAll('_', ' ')}
                    </small>
                  </section>
                )}
                <section>
                  <h3>Security guidance</h3>
                  {finding.references.map((r) => (
                    <a
                      className="reference-link"
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.title}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </section>
                <section className="review-section">
                  <h3>
                    Your review <Status value={finding.review_status} />
                  </h3>
                  <Textarea
                    aria-label="Review note"
                    placeholder="Record the access policy, existing controls, or why this is a false positive…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={2000}
                  />
                  <div>
                    <Button
                      disabled={saving}
                      onClick={() => review('confirmed')}
                    >
                      <Check size={14} />
                      Confirm
                    </Button>
                    <Button
                      disabled={saving}
                      variant="outline"
                      onClick={() => review('dismissed')}
                    >
                      Dismiss
                    </Button>
                    <Button
                      disabled={saving}
                      variant="ghost"
                      onClick={() => review('open')}
                    >
                      Keep open
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

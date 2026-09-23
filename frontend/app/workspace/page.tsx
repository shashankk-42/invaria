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

function ExecutiveSummary({
  scan,
  entries,
  areas,
  selectedArea,
  onSelectArea,
  selectedFindingId,
  onSelectFinding,
  onOpenFinding,
  onOpenFindings,
}: {
  scan: Scan;
  entries: ExecutiveEntry[];
  areas: ExecutiveArea[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  selectedFindingId: string;
  onSelectFinding: (id: string) => void;
  onOpenFinding: (finding: Finding) => void;
  onOpenFindings: () => void;
}) {
  const priority = entries.filter((entry) => ['critical', 'high'].includes(entry.finding.severity));
  const open = entries.filter((entry) => entry.finding.review_status === 'open');
  const reviewed = entries.length - open.length;
  const relevant = selectedArea
    ? entries.filter((entry) => entry.areas.includes(selectedArea))
    : entries;
  const journey = entries.find((entry) => entry.finding.id === selectedFindingId) || relevant[0] || entries[0];
  const title = priority.length
    ? `${priority.length} potential risks deserve priority review`
    : entries.length
      ? `${entries.length} potential risks are ready for review`
      : 'No potential risks were found in supported checks';
  const journeyArea = journey?.areas[0] || 'Business operations';
  const businessSummary = scan.business_impact_overview?.summary ||
    'This view connects potential technical risks to their possible effect on the product and the people who use it.';
  const executiveTakeaway = businessSummary.length > 290
    ? `${businessSummary.slice(0, businessSummary.lastIndexOf(' ', 290))}…`
    : businessSummary;

  return (
    <section className="executive-summary" aria-label="Executive risk summary">
      <header className="executive-hero">
        <div>
          <span className="executive-kicker"><Activity size={14} aria-hidden="true" /> Executive risk summary</span>
          <h3>{title}</h3>
          <p title={businessSummary}>{executiveTakeaway}</p>
        </div>
        <Button onClick={onOpenFindings} className="executive-cta">
          Review {open.length || entries.length} risk{(open.length || entries.length) === 1 ? '' : 's'} <ArrowRight size={16} />
        </Button>
      </header>

      {scan.business_impact_overview?.status !== 'ready' && (
        <BusinessImpactOverview key={`${scan.id}-executive-business-impact`} scan={scan} />
      )}

      <div className="executive-scorecards" aria-label="Business risk scorecards">
        <button type="button" className="executive-scorecard priority" onClick={onOpenFindings}>
          <span>Needs review</span><strong>{open.length}</strong><small>potential risks</small>
        </button>
        <div className="executive-scorecard">
          <span>Business areas</span><strong>{areas.length}</strong><small>potentially affected</small>
        </div>
        <div className="executive-scorecard">
          <span>Priority routes</span><strong>{new Set(priority.map((entry) => entry.finding.route).filter(Boolean)).size}</strong><small>high / critical paths</small>
        </div>
        <div className="executive-scorecard">
          <span>Review progress</span><strong>{reviewed}/{entries.length}</strong><small>decisions recorded</small>
        </div>
      </div>

      <div className="executive-grid">
        <section className="impact-heatmap" aria-labelledby="impact-heatmap-title">
          <div className="executive-section-heading">
            <div><span>Business exposure</span><h4 id="impact-heatmap-title">Impact heatmap</h4></div>
            <button type="button" className="text-button" onClick={() => onSelectArea('')} aria-pressed={!selectedArea}>Show all</button>
          </div>
          <p>Choose an area to focus the risk list on the possible business impact.</p>
          <div className="heatmap-cells">
            {areas.slice(0, 6).map((area) => (
              <button
                type="button"
                key={area.name}
                className={`heatmap-cell ${selectedArea === area.name ? 'selected' : ''}`}
                style={{ '--heat': Math.min(1, area.weight / Math.max(1, areas[0]?.weight || 1)) } as CSSProperties}
                onClick={() => onSelectArea(selectedArea === area.name ? '' : area.name)}
                aria-pressed={selectedArea === area.name}
              >
                <span>{area.name}</span><strong>{area.count}</strong><small>potential risks</small>
              </button>
            ))}
          </div>
        </section>

        <section className="risk-journey" aria-labelledby="risk-journey-title">
          <div className="executive-section-heading">
            <div><span>From request to consequence</span><h4 id="risk-journey-title">Risk journey</h4></div>
            <small>Choose a risk to trace its business impact</small>
          </div>
          {journey ? (
            <>
              <div className="journey-picker" aria-label="Choose a potential risk">
                {relevant.slice(0, 4).map((entry, index) => (
                  <button type="button" key={entry.finding.id} onClick={() => onSelectFinding(entry.finding.id)} aria-pressed={journey.finding.id === entry.finding.id}>
                    <span>Risk {index + 1}</span>{entry.finding.route || entry.finding.title}
                  </button>
                ))}
              </div>
              <div className="journey-steps">
                <div className="journey-step journey-entry"><span>01</span><small>Entry point</small><strong>{journey.finding.route || 'Application path'}</strong></div>
                <ArrowRight className="journey-arrow" aria-hidden="true" />
                <div className="journey-step journey-area"><span>02</span><small>Affected area</small><strong>{journeyArea}</strong></div>
                <ArrowRight className="journey-arrow journey-arrow-consequence" aria-hidden="true" />
                <div className="journey-step journey-consequence"><span>03</span><small>Possible business consequence</small><strong>{journey.impact?.business_impact || journey.finding.impact}</strong></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenFinding(journey.finding)}>Open this finding <ArrowUpRight size={14} /></Button>
            </>
          ) : <p className="executive-empty">Business-impact explanations will appear here when the local model has finished.</p>}
        </section>
      </div>

      <section className="executive-risks" aria-labelledby="executive-risks-title">
        <div className="executive-section-heading">
          <div><span>{selectedArea || 'All business areas'}</span><h4 id="executive-risks-title">What deserves attention</h4></div>
          <small>{relevant.length} potential risk{relevant.length === 1 ? '' : 's'}</small>
        </div>
        <div className="executive-risk-list">
          {relevant.slice(0, 5).map((entry) => (
            <button type="button" key={entry.finding.id} className="executive-risk-row" onClick={() => onOpenFinding(entry.finding)}>
              <span className={`plain-severity ${entry.finding.severity}`}><i /> {severityMessage(entry.finding.severity)} <small>{entry.finding.severity}</small></span>
              <div><strong>{entry.finding.route || entry.finding.title}</strong><p>{entry.impact?.business_impact || entry.finding.impact}</p></div>
              <span className="executive-area-tag">{entry.areas[0]}</span><ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
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
    [tab, setTab] = useState('summary'),
    [executiveArea, setExecutiveArea] = useState(''),
    [journeyFindingId, setJourneyFindingId] = useState(''),
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
    setTab('summary');
    setExecutiveArea('');
    setJourneyFindingId('');
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
      .sort((left, right) => right.weight - left.weight),
    [scan?.findings, businessImpacts],
  );
  const executiveAreas = useMemo<ExecutiveArea[]>(() => {
    const totals = new Map<string, ExecutiveArea>();
    for (const entry of executiveEntries) {
      for (const area of entry.areas) {
        const current = totals.get(area) || { name: area, count: 0, weight: 0 };
        current.count += 1;
        current.weight += entry.weight;
        totals.set(area, current);
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
      setTab('findings');
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
                JS / TS <b>·</b> Express <b>·</b> Public repositories
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
                    <div className="metrics">
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
                    </div>
                    <Tabs
                      value={tab}
                      onValueChange={(v) => setTab(String(v))}
                      className="report-tabs"
                    >
                      <div className="tabbar">
                        <TabsList variant="line">
                          <TabsTrigger value="summary">
                            <Activity size={14} />
                            Executive summary
                          </TabsTrigger>
                          <TabsTrigger value="findings">
                            <Shield size={14} />
                            Findings
                            <span className="count">
                              {scan.summary?.total || 0}
                            </span>
                          </TabsTrigger>
                          <TabsTrigger value="graph">
                            <Network size={14} />
                            Security graph
                          </TabsTrigger>
                          <TabsTrigger value="coverage">
                            <SlidersHorizontal size={14} />
                            Coverage & audit
                          </TabsTrigger>
                        </TabsList>
                        <span>
                          <ShieldCheck size={13} />
                          Source references checked
                        </span>
                      </div>
                      <TabsContent value="summary">
                        <ExecutiveSummary
                          scan={scan}
                          entries={executiveEntries}
                          areas={executiveAreas}
                          selectedArea={executiveArea}
                          onSelectArea={setExecutiveArea}
                          selectedFindingId={journeyFindingId}
                          onSelectFinding={setJourneyFindingId}
                          onOpenFinding={openFinding}
                          onOpenFindings={() => {
                            setExecutiveArea('');
                            setTab('findings');
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

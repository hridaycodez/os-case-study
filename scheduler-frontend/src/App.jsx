import { useState, useEffect, useRef } from "react";

// ─── API config ───────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || null;

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const DEFAULT_NODES = [
  { id: "node-a", label: "Node A", total_cpu: 8,  total_ram: 16, latency_ms: 10 },
  { id: "node-b", label: "Node B", total_cpu: 8,  total_ram: 16, latency_ms: 35 },
  { id: "node-c", label: "Node C", total_cpu: 4,  total_ram: 8,  latency_ms: 60 },
];

const STRATEGIES = [
  {
    id: "least-loaded",
    label: "Least-Loaded",
    accent: "#c084fc",
    glow: "#c084fc44",
    icon: "⟺",
    desc: "Spreads jobs across all nodes evenly. Picks the node with most free CPU.",
    tradeoff: "Best balance, ignores latency entirely."
  },
  {
    id: "binpack",
    label: "Binpack",
    accent: "#f472b6",
    glow: "#f472b644",
    icon: "⊞",
    desc: "Fills a node before moving to the next. Minimises active nodes.",
    tradeoff: "Saves power, creates hotspots under load."
  },
  {
    id: "network-aware",
    label: "Network-Aware",
    accent: "#38bdf8",
    glow: "#38bdf844",
    icon: "⌁",
    desc: "Scores nodes by CPU free + latency. Favours low-latency nodes.",
    tradeoff: "Lowest latency, can over-load fast nodes."
  },
];

const BENCHMARK = {
  unlimited:     { cores: 3820, throughput: 47.3, latency: 210  },
  limited_500m:  { cores: 487,  throughput: 5.9,  latency: 1840 },
  limited_1000m: { cores: 971,  throughput: 12.1, latency: 950  },
};

// ─── Scheduling logic (client-side fallback) ──────────────────────────────────
function computeBalance(nodes) {
  const utils = nodes.map(n => n.used_cpu / n.total_cpu);
  const mean = utils.reduce((s, u) => s + u, 0) / utils.length;
  const variance = utils.reduce((s, u) => s + (u - mean) ** 2, 0) / utils.length;
  const std = Math.sqrt(variance);
  return { std: parseFloat(std.toFixed(4)), pct: Math.max(0, Math.round((1 - std) * 100)) };
}

function runSchedulerLocal(strategy, jobs, nodeConfigs) {
  const nodes = nodeConfigs.map(n => ({ ...n, used_cpu: 0, used_ram: 0, jobs: [] }));
  const assignments = [];
  const log = [];

  for (const job of jobs) {
    const available = nodes.filter(
      n => n.used_cpu + job.cpu <= n.total_cpu && n.used_ram + job.ram <= n.total_ram
    );
    if (!available.length) { log.push(`${job.label} → UNSCHEDULED`); continue; }

    let chosen;
    if (strategy === "least-loaded") {
      chosen = available.sort((a, b) => a.used_cpu / a.total_cpu - b.used_cpu / b.total_cpu)[0];
    } else if (strategy === "binpack") {
      chosen = available.sort((a, b) => b.used_cpu / b.total_cpu - a.used_cpu / a.total_cpu)[0];
    } else {
      chosen = available.sort((a, b) => {
        const sc = n => 0.6 * (1 - n.used_cpu / n.total_cpu) + 0.4 * (1 / n.latency_ms);
        return sc(b) - sc(a);
      })[0];
    }
    chosen.used_cpu += job.cpu;
    chosen.used_ram += job.ram;
    chosen.jobs.push(job.id);
    assignments.push({ job_id: job.id, node_id: chosen.id, node_label: chosen.label, latency_ms: chosen.latency_ms });
    log.push(`${job.label} → ${chosen.label}`);
  }

  const avgLatency = assignments.length
    ? assignments.reduce((s, a) => s + a.latency_ms, 0) / assignments.length
    : 0;
  const balance = computeBalance(nodes);

  return {
    strategy, assignments,
    nodes: nodes.map(n => ({
      ...n,
      cpu_pct: Math.round((n.used_cpu / n.total_cpu) * 100),
      ram_pct: Math.round((n.used_ram / n.total_ram) * 100),
    })),
    log,
    avg_latency_ms: parseFloat(avgLatency.toFixed(1)),
    jobs_placed: assignments.length,
    jobs_total: jobs.length,
    balance_score: balance.std,
    balance_pct: balance.pct,
    duration_ms: 0,
  };
}

function makeDefaultJobs() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `job-${i + 1}`,
    label: `Job ${i + 1}`,
    cpu: [0.5, 1, 1.5, 2][i % 4],
    ram: [1, 2, 1, 3][i % 4],
  }));
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#07070f",
  surface: "#0d0d1a",
  card:    "#111124",
  border:  "#1e1e3a",
  borderHi:"#2d2d5e",
  text:    "#e2e8f0",
  muted:   "#64748b",
  dim:     "#334155",
  violet:  "#c084fc",
  pink:    "#f472b6",
  cyan:    "#38bdf8",
  green:   "#4ade80",
  red:     "#f87171",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function GlowOrb({ color, x, y, size = 300 }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
      pointerEvents: "none",
      transform: "translate(-50%, -50%)",
    }} />
  );
}

function Tag({ children, color = C.violet }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
      padding: "2px 8px", borderRadius: 4,
      border: `1px solid ${color}55`,
      color: color,
      background: `${color}11`,
    }}>
      {children}
    </span>
  );
}

function Pill({ label, value, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: color || C.text }}>{value}</span>
    </div>
  );
}

function Bar({ pct, color, animated = true }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: C.border, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: pct > 85 ? C.red : color,
        transition: animated ? "width 0.6s cubic-bezier(0.4,0,0.2,1)" : "none",
        boxShadow: `0 0 6px ${pct > 85 ? C.red : color}88`,
      }} />
    </div>
  );
}

function NodeCard({ node, highlighted, accentColor }) {
  const glow = highlighted ? `0 0 20px ${accentColor}44, 0 0 40px ${accentColor}22` : "none";
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${highlighted ? accentColor : C.border}`,
      borderRadius: 12, padding: "16px 18px",
      boxShadow: glow,
      transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: highlighted ? accentColor : C.text }}>{node.label}</span>
        <Tag color={node.latency_ms <= 15 ? C.green : node.latency_ms <= 40 ? C.cyan : C.red}>
          {node.latency_ms}ms
        </Tag>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
          <span>CPU</span>
          <span style={{ color: C.text }}>{node.used_cpu?.toFixed(1)}/{node.total_cpu} cores · {node.cpu_pct || 0}%</span>
        </div>
        <Bar pct={node.cpu_pct || 0} color={accentColor || C.violet} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
          <span>RAM</span>
          <span style={{ color: C.text }}>{node.used_ram?.toFixed(0)}/{node.total_ram} GB · {node.ram_pct || 0}%</span>
        </div>
        <Bar pct={node.ram_pct || 0} color={C.pink} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 24 }}>
        {(node.jobs || []).map(jid => (
          <span key={jid} style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 4,
            background: `${accentColor || C.violet}1a`,
            border: `1px solid ${accentColor || C.violet}44`,
            color: accentColor || C.violet,
          }}>{jid}</span>
        ))}
        {(!node.jobs || node.jobs.length === 0) && (
          <span style={{ fontSize: 11, color: C.muted }}>idle</span>
        )}
      </div>
    </div>
  );
}

function StrategyCard({ s, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: selected ? `${s.accent}12` : C.card,
      border: `1.5px solid ${selected ? s.accent : C.border}`,
      borderRadius: 10, padding: "14px 16px",
      cursor: "pointer", textAlign: "left",
      transition: "all 0.25s",
      boxShadow: selected ? `0 0 20px ${s.glow}` : "none",
      width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18, color: s.accent }}>{s.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: selected ? s.accent : C.text }}>{s.label}</span>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: "0 0 6px", lineHeight: 1.5 }}>{s.desc}</p>
      <p style={{ fontSize: 11, color: selected ? s.accent : C.dim, margin: 0, fontStyle: "italic" }}>{s.tradeoff}</p>
    </button>
  );
}

function NeonButton({ onClick, disabled, children, color = C.violet, outline = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "9px 20px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
      border: `1.5px solid ${disabled ? C.dim : color}`,
      background: outline ? "transparent" : disabled ? C.surface : `${color}22`,
      color: disabled ? C.muted : color,
      fontFamily: "inherit", fontSize: 13, fontWeight: 600,
      transition: "all 0.2s",
      boxShadow: disabled ? "none" : `0 0 12px ${color}33`,
      letterSpacing: "0.03em",
      whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

// ─── Job configurator ─────────────────────────────────────────────────────────
function JobConfigurator({ jobs, onJobsChange, isMobile }) {
  const addJob = () => {
    const id = `job-${jobs.length + 1}`;
    onJobsChange([...jobs, { id, label: id, cpu: 1, ram: 2 }]);
  };
  const removeJob = (idx) => onJobsChange(jobs.filter((_, i) => i !== idx));
  const update = (idx, field, val) => {
    const updated = [...jobs];
    updated[idx] = { ...updated[idx], [field]: parseFloat(val) || val };
    onJobsChange(updated);
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.violet }}>
          Job queue <span style={{ color: C.muted, fontWeight: 400 }}>({jobs.length} jobs)</span>
        </span>
        <NeonButton onClick={addJob} color={C.green} outline>+ Add job</NeonButton>
      </div>
      <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
        {jobs.map((job, i) => (
          <div key={job.id} style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr auto" : "1fr 80px 80px auto",
            gap: 8, alignItems: "center",
            padding: "8px 10px", borderRadius: 8,
            background: C.surface, border: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 12, color: C.text }}>{job.label}</span>
            {!isMobile && (
              <>
                <div>
                  <label style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>CPU cores</label>
                  <input
                    type="number" min="0.5" max="8" step="0.5" value={job.cpu}
                    onChange={e => update(i, "cpu", e.target.value)}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.cyan, padding: "3px 6px", fontSize: 12, fontFamily: "inherit" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: C.muted, display: "block", marginBottom: 2 }}>RAM GB</label>
                  <input
                    type="number" min="1" max="32" step="1" value={job.ram}
                    onChange={e => update(i, "ram", e.target.value)}
                    style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.pink, padding: "3px 6px", fontSize: 12, fontFamily: "inherit" }}
                  />
                </div>
              </>
            )}
            {isMobile && (
              <span style={{ fontSize: 11, color: C.muted }}>{job.cpu} CPU · {job.ram}GB</span>
            )}
            <button onClick={() => removeJob(i)} style={{
              background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "0 4px",
            }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Benchmark section ────────────────────────────────────────────────────────
function BenchmarkSection({ cols }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>
          Real performance data collected from the AI job running inside Kubernetes — with and without CPU limits enforced by Linux cgroups. This is what actually happens when the OS scheduler gets throttled.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 20 }}>
        {[
          { label: "Unlimited", data: BENCHMARK.unlimited, color: C.green, tag: "No limits" },
          { label: "1 core limit", data: BENCHMARK.limited_1000m, color: C.cyan, tag: "1000m CPU cap" },
          { label: "500m limit", data: BENCHMARK.limited_500m, color: C.red, tag: "500m CPU cap" },
        ].map(({ label, data, color, tag }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${color}44`, borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color }}>{label}</span>
              <Tag color={color}>{tag}</Tag>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>CPU usage</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{data.cores}m</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Throughput (SVD/s)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{data.throughput}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>p99 Latency</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{data.latency}ms</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.violet}44`, borderRadius: 12, padding: "18px 20px", background: `${C.violet}08` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.violet, marginBottom: 8 }}>Key insight</div>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>
          Capping at <span style={{ color: C.red }}>500m CPU</span> via Kubernetes resource limits reduced throughput by{" "}
          <span style={{ color: C.red }}>87.5%</span> and increased p99 latency by{" "}
          <span style={{ color: C.red }}>8.8×</span>. This is Linux cgroups enforcing isolation — the same OS scheduling mechanism that makes Kubernetes safe for multi-tenant clusters.
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const width = useWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 900;
  const cols3 = isMobile ? 1 : 3;
  const cols2 = isMobile ? 1 : 2;

  const [tab, setTab] = useState("sim");
  const [strategy, setStrategy] = useState("least-loaded");
  const [jobs, setJobs] = useState(makeDefaultJobs());
  const [showJobConfig, setShowJobConfig] = useState(false);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);

  const timerRef = useRef(null);
  const strat = STRATEGIES.find(s => s.id === strategy);

  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/health`).then(r => r.ok && setApiOnline(true)).catch(() => {});
  }, []);

  async function fetchSchedule(strat, jobList) {
    if (API_BASE && apiOnline) {
      const res = await fetch(`${API_BASE}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: strat, jobs: jobList }),
      });
      if (!res.ok) throw new Error("API error");
      return res.json();
    }
    return runSchedulerLocal(strat, jobList, DEFAULT_NODES);
  }

  async function runSim() {
    const r = await fetchSchedule(strategy, jobs);
    setResult(r);
    setStep(0);
    setRunning(true);
  }

  useEffect(() => {
    if (!running || !result) return;
    if (step >= result.assignments.length) { setRunning(false); return; }
    timerRef.current = setTimeout(() => setStep(s => s + 1), 220);
    return () => clearTimeout(timerRef.current);
  }, [running, step, result]);

  function reset() {
    clearTimeout(timerRef.current);
    setRunning(false);
    setStep(0);
    setResult(null);
  }

  async function runCompare() {
    const results = await Promise.all(STRATEGIES.map(s => fetchSchedule(s.id, jobs)));
    setCompareData(results);
  }

  const fullResult = result || runSchedulerLocal(strategy, jobs, DEFAULT_NODES);
  const shownAssignments = fullResult.assignments.slice(0, step);

  const displayedNodes = DEFAULT_NODES.map(n => {
    const copy = { ...n, used_cpu: 0, used_ram: 0, jobs: [] };
    shownAssignments.forEach(a => {
      if (a.node_id === n.id) {
        const job = jobs.find(j => j.id === a.job_id);
        if (job) { copy.used_cpu += job.cpu; copy.used_ram += job.ram; }
        copy.jobs.push(a.job_id);
      }
    });
    return {
      ...copy,
      cpu_pct: Math.round((copy.used_cpu / n.total_cpu) * 100),
      ram_pct: Math.round((copy.used_ram / n.total_ram) * 100),
    };
  });

  const lastAssigned = shownAssignments.at(-1);
  const done = result && step >= result.assignments.length;

  const containerStyle = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: isMobile ? "0 16px" : "0 32px",
  };

  const TABS = [
    { id: "sim",       label: isMobile ? "Sim" : "Simulator" },
    { id: "compare",   label: "Compare" },
    { id: "benchmark", label: isMobile ? "K8s" : "K8s Benchmarks" },
    { id: "about",     label: isMobile ? "Info" : "How it works" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'DM Mono', 'Fira Code', 'Cascadia Code', monospace",
      paddingBottom: 60,
      width: "100%",
      overflowX: "hidden",
    }}>

      {/* ── Hero ── */}
      <header style={{
        background: `linear-gradient(180deg, #0a0a1e 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: isMobile ? "32px 16px 28px" : "56px 32px 44px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        width: "100%",
      }}>
        <GlowOrb color={C.violet} x="20%" y="50%" size={isMobile ? 200 : 500} />
        <GlowOrb color={C.pink}   x="80%" y="50%" size={isMobile ? 150 : 400} />
        <GlowOrb color={C.cyan}   x="50%" y="100%" size={isMobile ? 120 : 250} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <Tag color={C.violet}>VIT VELLORE · OS CASE STUDY</Tag>
            <Tag color={apiOnline ? C.green : C.muted}>{apiOnline ? "API ONLINE" : "OFFLINE MODE"}</Tag>
          </div>
          <h1 style={{
            fontSize: isMobile ? "28px" : isTablet ? "40px" : "56px",
            fontWeight: 800,
            margin: "0 0 14px",
            lineHeight: 1.1,
            background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 50%, ${C.cyan} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.02em",
            padding: "0 8px",
          }}>
            Kubernetes Scheduling Simulator
          </h1>
          <p style={{ fontSize: isMobile ? 13 : 15, color: C.muted, margin: 0 }}>
            3 nodes · {jobs.length} jobs · 3 real strategies · cgroup benchmarks
          </p>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, width: "100%" }}>
        <div style={{ ...containerStyle, display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: isMobile ? "12px 14px" : "14px 24px",
              border: "none", background: "none",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: tab === t.id ? strat.accent : C.muted,
              borderBottom: `2px solid ${tab === t.id ? strat.accent : "transparent"}`,
              transition: "all 0.2s",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ ...containerStyle, paddingTop: 28 }}>

        {/* ══ SIMULATOR TAB ══ */}
        {tab === "sim" && (
          <div>
            {/* Strategy selector */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols3}, 1fr)`,
              gap: 10, marginBottom: 16,
            }}>
              {STRATEGIES.map(s => (
                <StrategyCard key={s.id} s={s}
                  selected={strategy === s.id}
                  onClick={() => { setStrategy(s.id); reset(); }}
                />
              ))}
            </div>

            {/* Job config toggle */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              <button
                onClick={() => setShowJobConfig(v => !v)}
                style={{
                  background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.muted, cursor: "pointer", fontSize: 12, padding: "6px 14px",
                  fontFamily: "inherit",
                }}>
                {showJobConfig ? "▲ Hide" : "▼ Edit"} job queue ({jobs.length} jobs)
              </button>
              <button
                onClick={() => { setJobs(makeDefaultJobs()); reset(); }}
                style={{
                  background: "none", border: "none", color: C.dim,
                  cursor: "pointer", fontSize: 12, padding: "6px 14px", fontFamily: "inherit",
                }}>
                Reset to defaults
              </button>
            </div>

            {showJobConfig && (
              <JobConfigurator jobs={jobs} isMobile={isMobile}
                onJobsChange={j => { setJobs(j); reset(); }}
              />
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <NeonButton onClick={runSim} disabled={running} color={strat.accent}>
                {running ? `Scheduling… ${step}/${result?.assignments.length || "?"}` : done ? "▶ Run again" : "▶ Run simulation"}
              </NeonButton>
              <NeonButton onClick={reset} color={C.muted} outline>Reset</NeonButton>
              <NeonButton onClick={() => { runCompare(); setTab("compare"); }} color={C.pink} outline>
                Compare all →
              </NeonButton>
            </div>

            {/* Node grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols3}, 1fr)`,
              gap: 12, marginBottom: 20,
            }}>
              {displayedNodes.map(n => (
                <NodeCard key={n.id} node={n}
                  highlighted={lastAssigned?.node_id === n.id}
                  accentColor={strat.accent}
                />
              ))}
            </div>

            {/* Log + metrics */}
            {step > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 12, color: strat.accent, fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>
                  ASSIGNMENT LOG
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: done ? 16 : 0 }}>
                  {fullResult.log.slice(0, step).map((l, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 4,
                      background: C.surface, border: `1px solid ${C.border}`,
                      color: i === step - 1 ? strat.accent : C.muted,
                    }}>{l}</span>
                  ))}
                </div>

                {done && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`,
                    gap: 10, marginTop: 16,
                  }}>
                    <Pill label="Avg Latency" value={`${fullResult.avg_latency_ms}ms`} color={strat.accent} />
                    <Pill label="Jobs Placed" value={`${fullResult.jobs_placed}/${fullResult.jobs_total}`} color={C.green} />
                    <Pill label="Balance" value={`${fullResult.balance_pct}%`} color={C.pink} />
                    <Pill label="Std Dev" value={fullResult.balance_score} color={C.cyan} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ COMPARE TAB ══ */}
        {tab === "compare" && (
          <div>
            {!compareData ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>
                  Run all 3 strategies on the current job queue and compare results side-by-side.
                </p>
                <NeonButton onClick={runCompare} color={C.violet}>Run all 3 strategies</NeonButton>
              </div>
            ) : (
              <div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols3}, 1fr)`,
                  gap: 12, marginBottom: 20,
                }}>
                  {compareData.map((r, i) => {
                    const s = STRATEGIES[i];
                    const bestLatency = compareData.reduce((best, x) => x.avg_latency_ms < best.avg_latency_ms ? x : best, compareData[0]);
                    const bestBalance = compareData.reduce((best, x) => x.balance_pct > best.balance_pct ? x : best, compareData[0]);
                    const isBestLatency = r.avg_latency_ms === bestLatency.avg_latency_ms;
                    const isBestBalance = r.balance_pct === bestBalance.balance_pct;

                    return (
                      <div key={s.id} style={{
                        background: C.card,
                        border: `1.5px solid ${s.accent}`,
                        borderRadius: 12, padding: "18px 20px",
                        boxShadow: `0 0 24px ${s.glow}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                          <span style={{ fontSize: 20 }}>{s.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: s.accent }}>{s.label}</span>
                        </div>

                        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: C.muted }}>Avg latency</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isBestLatency && <Tag color={C.green}>BEST</Tag>}
                              <span style={{ fontWeight: 700, color: isBestLatency ? C.green : C.text }}>{r.avg_latency_ms}ms</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: C.muted }}>Balance</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isBestBalance && <Tag color={C.green}>BEST</Tag>}
                              <span style={{ fontWeight: 700, color: isBestBalance ? C.green : C.text }}>{r.balance_pct}%</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: C.muted }}>Jobs placed</span>
                            <span style={{ fontWeight: 700 }}>{r.jobs_placed}/{r.jobs_total}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: C.muted }}>Std dev utilization</span>
                            <span style={{ fontWeight: 700, color: C.muted }}>{r.balance_score}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Node CPU utilization</div>
                        {r.nodes.map(n => (
                          <div key={n.id} style={{ marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 3 }}>
                              <span>{n.label}</span><span>{n.cpu_pct}%</span>
                            </div>
                            <Bar pct={n.cpu_pct} color={s.accent} animated={false} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: `${C.violet}08`, border: `1px solid ${C.violet}44`, borderRadius: 12, padding: "18px 20px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.violet, marginBottom: 8 }}>Key insight</div>
                  <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>
                    <span style={{ color: C.cyan }}>Network-Aware</span> achieves lowest latency by routing jobs to Node A (10ms).{" "}
                    <span style={{ color: C.violet }}>Least-Loaded</span> achieves best balance (lowest std dev across nodes).{" "}
                    <span style={{ color: C.pink }}>Binpack</span> concentrates load — fewest active nodes, useful for cost savings but creates risk of hotspots.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ BENCHMARK TAB ══ */}
        {tab === "benchmark" && <BenchmarkSection cols={cols3} />}

        {/* ══ ABOUT TAB ══ */}
        {tab === "about" && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.violet, letterSpacing: "0.06em", marginBottom: 10 }}>WHAT THIS DEMONSTRATES</div>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: 0 }}>
                A full-stack OS scheduling case study: a FastAPI backend exposes a <span style={{ color: C.cyan }}>/schedule</span> API that runs real scheduling logic server-side, a React frontend calls it and animates job placement, and real Kubernetes cgroup benchmark data shows what OS-level resource isolation actually does to performance.
              </p>
            </div>

            {STRATEGIES.map(s => (
              <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.accent}`, borderRadius: 12, padding: "18px 20px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontWeight: 700, color: s.accent }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 13, color: C.muted, margin: "0 0 6px", lineHeight: 1.6 }}>{s.desc}</p>
                <p style={{ fontSize: 12, color: s.accent, margin: 0, fontStyle: "italic" }}>{s.tradeoff}</p>
              </div>
            ))}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, letterSpacing: "0.06em", marginBottom: 10 }}>TECH STACK</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["React + Vite", "FastAPI (Python)", "Railway", "Kubernetes", "Docker", "Linux cgroups", "Vercel"].map(t => (
                  <Tag key={t} color={C.cyan}>{t}</Tag>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

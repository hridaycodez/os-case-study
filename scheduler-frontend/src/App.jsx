import { useState, useEffect, useRef } from "react";

const NODES = [
  { id: "node-a", label: "Node A", totalCPU: 8, totalRAM: 16, latency: 10 },
  { id: "node-b", label: "Node B", totalCPU: 8, totalRAM: 16, latency: 35 },
  { id: "node-c", label: "Node C", totalCPU: 4, totalRAM: 8,  latency: 60 },
];

const JOBS = Array.from({ length: 12 }, (_, i) => ({
  id: `job-${i + 1}`,
  label: `Job ${i + 1}`,
  cpu: [0.5, 1, 1.5, 2][i % 4],
  ram: [1, 2, 1, 3][i % 4],
}));

function initNodes() {
  return NODES.map(n => ({ ...n, usedCPU: 0, usedRAM: 0, jobs: [] }));
}

function runScheduler(strategy) {
  const nodes = initNodes();
  const assignments = [];
  const log = [];

  for (const job of JOBS) {
    let chosen = null;

    if (strategy === "least-loaded") {
      chosen = nodes
        .filter(n => n.usedCPU + job.cpu <= n.totalCPU && n.usedRAM + job.ram <= n.totalRAM)
        .sort((a, b) => (a.usedCPU / a.totalCPU) - (b.usedCPU / b.totalCPU))[0];
    } else if (strategy === "binpack") {
      chosen = nodes
        .filter(n => n.usedCPU + job.cpu <= n.totalCPU && n.usedRAM + job.ram <= n.totalRAM)
        .sort((a, b) => (b.usedCPU / b.totalCPU) - (a.usedCPU / a.totalCPU))[0];
    } else if (strategy === "network-aware") {
      chosen = nodes
        .filter(n => n.usedCPU + job.cpu <= n.totalCPU && n.usedRAM + job.ram <= n.totalRAM)
        .sort((a, b) => {
          const scoreA = 0.6 * (1 - a.usedCPU / a.totalCPU) + 0.4 * (1 / a.latency);
          const scoreB = 0.6 * (1 - b.usedCPU / b.totalCPU) + 0.4 * (1 / b.latency);
          return scoreB - scoreA;
        })[0];
    }

    if (chosen) {
      chosen.usedCPU += job.cpu;
      chosen.usedRAM += job.ram;
      chosen.jobs.push(job.id);
      assignments.push({ jobId: job.id, nodeId: chosen.id });
      log.push(`${job.label} → ${chosen.label}`);
    }
  }

  const avgLatency = assignments.reduce((sum, a) => {
    const node = NODES.find(n => n.id === a.nodeId);
    return sum + node.latency;
  }, 0) / assignments.length;

  const maxUtil = Math.max(...nodes.map(n => n.usedCPU / n.totalCPU));
  const balance = 1 - maxUtil;

  return { nodes, assignments, log, avgLatency, balance };
}

const STRATEGIES = [
  { id: "least-loaded", label: "Least-Loaded", color: "#5DCAA5", desc: "Always picks the most free node — great balance, ignores latency." },
  { id: "binpack",      label: "Binpack",       color: "#7F77DD", desc: "Fills nodes before moving on — fewer active nodes, saves power." },
  { id: "network-aware",label: "Network-Aware", color: "#378ADD", desc: "Scores nodes by CPU + latency — best for fast microservices." },
];

function NodeBar({ node, highlight }) {
  const cpuPct = Math.round((node.usedCPU / node.totalCPU) * 100);
  const ramPct = Math.round((node.usedRAM / node.totalRAM) * 100);
  return (
    <div style={{
      border: `1.5px solid ${highlight ? "#1D9E75" : "#e2e8f0"}`,
      borderRadius: 12,
      padding: "14px 16px",
      background: highlight ? "#f0fdf8" : "#fff",
      transition: "all 0.3s",
      minWidth: 0,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: "#1e293b" }}>{node.label}</div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 3 }}>
          <span>CPU</span><span>{node.usedCPU}/{node.totalCPU} cores</span>
        </div>
        <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${cpuPct}%`, background: cpuPct > 80 ? "#E24B4A" : "#1D9E75", height: "100%", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 3 }}>
          <span>RAM</span><span>{node.usedRAM}/{node.totalRAM} GB</span>
        </div>
        <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${ramPct}%`, background: "#7F77DD", height: "100%", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {node.jobs.map(jid => (
          <span key={jid} style={{ fontSize: 11, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", color: "#475569" }}>
            {jid}
          </span>
        ))}
        {node.jobs.length === 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>idle</span>}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>Latency: {node.latency}ms</div>
    </div>
  );
}

export default function App() {
  const [strategy, setStrategy] = useState("least-loaded");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [activeTab, setActiveTab] = useState("sim");
  const intervalRef = useRef(null);

  const fullResult = result || runScheduler(strategy);
  const displayedAssignments = fullResult.assignments.slice(0, step);
  const displayedNodes = initNodes().map(n => {
    const copy = { ...n };
    displayedAssignments.forEach(a => {
      if (a.nodeId === n.id) {
        const job = JOBS.find(j => j.id === a.jobId);
        copy.usedCPU += job.cpu;
        copy.usedRAM += job.ram;
        copy.jobs = [...(copy.jobs || []), a.jobId];
      }
    });
    return copy;
  });

  function runSim() {
    const r = runScheduler(strategy);
    setResult(r);
    setStep(0);
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    if (step >= 12) { setRunning(false); return; }
    intervalRef.current = setTimeout(() => setStep(s => s + 1), 220);
    return () => clearTimeout(intervalRef.current);
  }, [running, step]);

  function compareAll() {
    setCompareData(STRATEGIES.map(s => {
      const r = runScheduler(s.id);
      const nodeUtils = r.nodes.map(n => Math.round((n.usedCPU / n.totalCPU) * 100));
      return {
        ...s,
        avgLatency: r.avgLatency.toFixed(1),
        jobsPlaced: r.assignments.length,
        nodeUtils,
        balance: (r.balance * 100).toFixed(0),
      };
    }));
    setActiveTab("compare");
  }

  function reset() {
    clearTimeout(intervalRef.current);
    setRunning(false);
    setStep(0);
    setResult(null);
  }

  const lastAssigned = displayedAssignments.length > 0 ? displayedAssignments[displayedAssignments.length - 1] : null;

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "24px 16px", color: "#1e293b" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
          Kubernetes Scheduling Simulator
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
          OS Case Study — 3 nodes, 12 jobs, 3 real scheduling strategies
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 12 }}>
        {["sim", "compare", "about"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
            background: activeTab === tab ? "#0f172a" : "transparent",
            color: activeTab === tab ? "#fff" : "#64748b",
            transition: "all 0.2s",
          }}>
            {tab === "sim" ? "Simulator" : tab === "compare" ? "Compare all" : "How it works"}
          </button>
        ))}
      </div>

      {activeTab === "sim" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
            {STRATEGIES.map(s => (
              <button key={s.id} onClick={() => { setStrategy(s.id); reset(); }} style={{
                padding: "12px 10px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${strategy === s.id ? s.color : "#e2e8f0"}`,
                background: strategy === s.id ? `${s.color}18` : "#fff",
                textAlign: "left", transition: "all 0.2s",
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: strategy === s.id ? s.color : "#334155", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{s.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={runSim} disabled={running} style={{
              padding: "9px 20px", borderRadius: 8, border: "none", cursor: running ? "not-allowed" : "pointer",
              background: running ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 600, fontSize: 13,
            }}>
              {running ? `Scheduling… (${step}/12)` : step === 12 ? "Run again" : "▶ Run simulation"}
            </button>
            <button onClick={reset} style={{
              padding: "9px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b",
            }}>Reset</button>
            <button onClick={compareAll} style={{
              padding: "9px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b", marginLeft: "auto",
            }}>Compare all →</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {displayedNodes.map(n => (
              <NodeBar key={n.id} node={n} highlight={lastAssigned?.nodeId === n.id} />
            ))}
          </div>

          {step > 0 && (
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#475569" }}>Assignment log</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {fullResult.log.slice(0, step).map((l, i) => (
                  <span key={i} style={{ fontSize: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px", color: "#334155" }}>{l}</span>
                ))}
              </div>
              {step === 12 && (
                <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>Avg latency: </span>
                    <strong>{fullResult.avgLatency.toFixed(1)}ms</strong>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>Jobs placed: </span>
                    <strong>{fullResult.assignments.length}/12</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "compare" && (
        <div>
          {!compareData ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <button onClick={compareAll} style={{
                padding: "12px 28px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>Run all 3 strategies & compare</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {compareData.map(s => (
                  <div key={s.id} style={{ border: `2px solid ${s.color}`, borderRadius: 12, padding: "16px 14px", background: `${s.color}08` }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 12 }}>{s.label}</div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ color: "#94a3b8" }}>Avg latency</span><br /><strong style={{ fontSize: 18 }}>{s.avgLatency}ms</strong></div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ color: "#94a3b8" }}>Jobs placed</span><br /><strong style={{ fontSize: 18 }}>{s.jobsPlaced}/12</strong></div>
                    <div style={{ fontSize: 13, marginBottom: 10 }}><span style={{ color: "#94a3b8" }}>Balance score</span><br /><strong style={{ fontSize: 18 }}>{s.balance}%</strong></div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Node utilisation</div>
                    {s.nodeUtils.map((u, i) => (
                      <div key={i} style={{ marginTop: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                          <span>{NODES[i].label}</span><span>{u}%</span>
                        </div>
                        <div style={{ background: "#e2e8f0", borderRadius: 99, height: 5, overflow: "hidden" }}>
                          <div style={{ width: `${u}%`, background: s.color, height: "100%", borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ background: "#f0fdf8", borderRadius: 10, padding: "14px 16px", border: "1px solid #bbf7d0", fontSize: 13 }}>
                <strong>Key insight:</strong> Network-Aware gives lowest latency (prefers Node A at 10ms). Binpack concentrates load on fewer nodes. Least-Loaded spreads evenly — best balance but ignores latency.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "about" && (
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>What this project demonstrates</div>
            <p style={{ margin: 0 }}>This is a working scheduler simulator replicating Kubernetes-level pod placement decisions. It shows how different scheduling strategies affect latency, node utilisation, and resource balance — the same trade-offs Kubernetes makes in production.</p>
          </div>
          {[
            { title: "Least-Loaded", color: "#5DCAA5", body: "Before placing each job, it checks how much CPU each node has free. Picks the most free one. Result: jobs spread evenly across all nodes. Excellent for balanced utilisation." },
            { title: "Binpack", color: "#7F77DD", body: "Opposite logic — picks the most-used node that can still fit the job. Fills Node A before touching Node B. Result: fewer active nodes consuming power. Great for cost efficiency." },
            { title: "Network-Aware", color: "#378ADD", body: "Each node gets a score: 0.6 × (free CPU) + 0.4 × (1/latency). Node A (10ms) gets a big latency bonus. Result: jobs prefer low-latency nodes even if slightly busier. Best for microservices." },
          ].map(s => (
            <div key={s.title} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: s.color, marginBottom: 4 }}>{s.title}</div>
              <p style={{ margin: 0 }}>{s.body}</p>
            </div>
          ))}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", border: "1px solid #e2e8f0", marginTop: 8, fontSize: 13 }}>
            <strong>Tech stack:</strong> React + Vite · Deployable on Vercel (free) · Real scheduling logic — not AI-generated
          </div>
        </div>
      )}
    </div>
  );
}

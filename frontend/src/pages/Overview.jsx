import { useEffect, useState } from "react";
import { getAnomalySummary } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ShieldAlert, TrendingUp, Table2, AlertTriangle } from "lucide-react";
import FileUpload from "../components/FileUpload";

export default function Overview({ health, onRefresh }) {
  const [summary, setSummary] = useState(null);

  const load = async () => {
    if (!health?.anomaly_results_count) return;
    try {
      const res = await getAnomalySummary();
      setSummary(res.data);
    } catch {}
  };

  useEffect(() => { load(); }, [health]);

  const metrics = summary ? [
    { label: "Tables Analysed",  value: summary.total_tables,       icon: Table2,      cls: "accent"  },
    { label: "Anomalies Found",  value: summary.total_anomalies,    icon: AlertTriangle, cls: "danger" },
    { label: "Z-Score Flags",    value: summary.total_zscore_flags, icon: TrendingUp,  cls: "warning" },
    { label: "High Risk Tables", value: summary.high_risk_tables,   icon: ShieldAlert, cls: "danger"  },
  ] : null;

  const chartData = summary?.summary?.map(r => ({
    name: r.Source?.split(".")[0] || r.Source,
    anomalies: r["IF Anomalies"],
    risk: r["Risk Level"],
  })) || [];

  const colorMap = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#10b981" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          Audit Risk Intelligence
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
          AI-powered financial document analysis · Groq LLaMA3 · ChromaDB · Isolation Forest
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Metrics */}
          {metrics ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {metrics.map(({ label, value, icon: Icon, cls }, i) => (
                <div key={label} className={`metric-card ${cls}`} style={{ animation: `fadeUp 0.5s ease forwards`, animationDelay: `${i * 80}ms`, opacity: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "Syne", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      {label}
                    </span>
                    <div style={{ padding: 6, borderRadius: 8, background: "var(--bg-tertiary)" }}>
                      <Icon size={15} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "Syne", color: "var(--text-primary)" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyMetrics />
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" }}>
                Anomalies by Source
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontFamily: "DM Sans" }}
                    cursor={{ fill: "var(--bg-tertiary)" }}
                  />
                  <Bar dataKey="anomalies" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={colorMap[entry.risk] || "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
                {Object.entries(colorMap).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: v }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Syne" }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk table */}
          {summary?.summary?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Risk Summary</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th><th>Sheet</th><th>Rows</th><th>Anomalies</th><th>Z-Flags</th><th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.summary.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{r.Source}</td>
                        <td>{r.Sheet}</td>
                        <td>{r["Total Rows"]}</td>
                        <td style={{ color: r["IF Anomalies"] > 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                          {r["IF Anomalies"]}
                        </td>
                        <td style={{ color: r["Z-Score Flags"] > 0 ? "var(--warning)" : "var(--text-secondary)" }}>
                          {r["Z-Score Flags"]}
                        </td>
                        <td>
                          <span className={`badge-${r["Risk Level"]?.toLowerCase()}`} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "Syne" }}>
                            {r["Risk Level"]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right — upload panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
              Upload Documents
            </h3>
            <FileUpload onSuccess={() => { onRefresh?.(); load(); }} />
          </div>

          {/* How it works */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>How it works</h3>
            {[
              ["01", "Upload", "Drop a PDF report or CSV table"],
              ["02", "Analyse", "AI detects anomalies automatically"],
              ["03", "Ask",    "Query documents in plain English"],
              ["04", "Export", "Download a full PDF risk report"],
            ].map(([n, t, d]) => (
              <div key={n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "Syne", color: "var(--accent)" }}>{n}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Syne" }}>{t}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMetrics() {
  return (
    <div className="card" style={{ padding: 40, textAlign: "center" }}>
      <ShieldAlert size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne", marginBottom: 6 }}>
        No data yet
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Upload a PDF or CSV using the panel on the right to get started
      </div>
    </div>
  );
}

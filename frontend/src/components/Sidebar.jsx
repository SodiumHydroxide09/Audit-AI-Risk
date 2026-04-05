import { NavLink } from "react-router-dom";
import { LayoutDashboard, AlertTriangle, MessageSquare, FileText, RotateCcw, Sun, Moon, Zap } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { resetState } from "../api";
import toast from "react-hot-toast";

const NAV = [
  { to: "/",         icon: LayoutDashboard, label: "Overview"   },
  { to: "/anomaly",  icon: AlertTriangle,   label: "Anomalies"  },
  { to: "/qa",       icon: MessageSquare,   label: "Q & A"      },
  { to: "/report",   icon: FileText,        label: "Report"     },
];

export default function Sidebar({ health }) {
  const { dark, toggle } = useTheme();

  const handleReset = async () => {
    try {
      await resetState();
      toast.success("Reset complete — ready for new documents");
      window.location.reload();
    } catch {
      toast.error("Could not reset. Is the backend running?");
    }
  };

  return (
    <aside style={{
      width: 240,
      minHeight: "100vh",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 16px",
      gap: 8,
      position: "fixed",
      top: 0, left: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 20px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Zap size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            AuditRisk
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>AI Intelligence</div>
        </div>
      </div>

      {/* Backend status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 8,
        background: health ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${health ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        marginBottom: 8,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: health ? "var(--success)" : "var(--danger)",
          boxShadow: health ? "0 0 6px var(--success)" : "none",
        }} />
        <span style={{ fontSize: 12, color: health ? "var(--success)" : "var(--danger)", fontWeight: 500 }}>
          {health ? "Backend connected" : "Backend offline"}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Stats */}
      {health && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Syne", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
            Session
          </div>
          <StatRow label="Vector store" value={health.vector_store_ready ? "Ready" : "Empty"} ok={health.vector_store_ready} />
          <StatRow label="Questions asked" value={health.rag_history_count} />
          <StatRow label="Tables loaded" value={health.anomaly_results_count} />
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={toggle}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? "Light mode" : "Dark mode"}
        </button>
        <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13, color: "var(--danger)" }} onClick={handleReset}>
          <RotateCcw size={15} />
          Reset session
        </button>
      </div>
    </aside>
  );
}

function StatRow({ label, value, ok }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: ok !== undefined ? (ok ? "var(--success)" : "var(--text-muted)") : "var(--text-primary)" }}>
        {String(value)}
      </span>
    </div>
  );
}

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./ThemeContext";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import AnomalyPage from "./pages/AnomalyPage";
import QAPage from "./pages/QAPage";
import ReportPage from "./pages/ReportPage";
import { getHealth } from "./api";

function App() {
  const [health, setHealth] = useState(null);

  const refresh = async () => {
    try {
      const res = await getHealth();
      setHealth(res.data);
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar health={health} />
          <main style={{ marginLeft: 240, flex: 1, padding: "32px 36px", minHeight: "100vh", background: "var(--bg-primary)" }}>
            <Routes>
              <Route path="/"        element={<Overview    health={health} onRefresh={refresh} />} />
              <Route path="/anomaly" element={<AnomalyPage health={health} />} />
              <Route path="/qa"      element={<QAPage      health={health} />} />
              <Route path="/report"  element={<ReportPage  health={health} />} />
            </Routes>
          </main>
        </div>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontFamily: "DM Sans",
              fontSize: 14,
            },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

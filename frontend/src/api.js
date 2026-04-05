import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export const getHealth       = ()         => api.get("/");
export const uploadPDF       = (file)     => {
  const fd = new FormData(); fd.append("file", file);
  return api.post("/upload/pdf", fd);
};
export const uploadTable     = (file)     => {
  const fd = new FormData(); fd.append("file", file);
  return api.post("/upload/table", fd);
};
export const askQuestion     = (question) => api.post("/ask", { question });
export const getHistory      = ()         => api.get("/ask/history");
export const getAnomalySummary = ()       => api.get("/anomaly/summary");
export const getFlaggedRows  = (i)        => api.get(`/anomaly/flagged/${i}`);
export const generateReport  = ()         => api.get("/report/generate", { responseType: "blob" });
export const resetState      = ()         => api.post("/reset");

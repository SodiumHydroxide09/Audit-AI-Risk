# AI-Powered Audit Risk Intelligence System

An end-to-end AI/ML project that automates financial document analysis using RAG, anomaly detection, and LLMs — built to simulate real-world use cases at firms like Deloitte.

## Tech Stack
- **LLM**: Groq (LLaMA3) — free, fast
- **RAG**: LangChain + ChromaDB
- **Embeddings**: sentence-transformers (local, free)
- **Anomaly Detection**: Scikit-learn (Isolation Forest) + Z-Score
- **Dashboard**: Streamlit + Plotly
- **Report**: fpdf2
- **MLOps**: MLflow
- **Deployment**: Docker

## Setup

### 1. Clone and create virtual environment
```bash
git clone https://github.com/YOUR_USERNAME/audit-risk-ai.git
cd audit-risk-ai
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env and add your Groq API key
# Get a free key at: https://console.groq.com
```

### 4. Run the dashboard
```bash
streamlit run dashboard/app.py
```

Open http://localhost:8501 in your browser.

## Usage
1. Upload PDF financial reports and/or Excel/CSV tables in the sidebar
2. Click **Process Documents**
3. Go to **Anomaly Detection** tab to see flagged financial rows
4. Go to **Document Q&A** tab to ask questions about the reports
5. Go to **Risk Report** tab to generate and download a PDF report

## Run with Docker
```bash
docker build -t audit-risk-ai .
docker run -p 8501:8501 --env-file .env audit-risk-ai
```

## Project Structure
```
audit-risk-ai/
├── src/
│   ├── ingestion/       # PDF and Excel loaders
│   ├── preprocessing/   # Text chunker and embedder
│   ├── rag/             # RAG engine (Groq + ChromaDB)
│   ├── anomaly/         # Anomaly detection (Isolation Forest)
│   └── report/          # PDF report generator
├── dashboard/           # Streamlit app
├── data/
│   ├── raw/             # Drop your input files here
│   └── processed/       # Generated reports saved here
├── notebooks/           # Jupyter notebooks for EDA
├── tests/               # Unit tests
├── requirements.txt
├── Dockerfile
└── .env.example
```



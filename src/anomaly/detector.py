"""
Layer 3 - Anomaly Detection
Detects unusual patterns in financial tables using:
- Isolation Forest (fast, unsupervised, great for tabular data)
- Z-Score method (simple statistical flagging)
Outputs a DataFrame with an 'anomaly' column and risk scores.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import mlflow


def detect_with_isolation_forest(
    df: pd.DataFrame,
    contamination: float = 0.05
) -> pd.DataFrame:
    """
    Run Isolation Forest on numeric columns of a DataFrame.
    contamination = expected proportion of anomalies (5% by default).
    Returns the original DataFrame with added columns:
    - 'anomaly_score': lower = more anomalous
    - 'is_anomaly': True/False flag
    """
    # Select only numeric columns and drop NaNs
    numeric_df = df.select_dtypes(include=["number"]).dropna(axis=1)

    if numeric_df.empty or numeric_df.shape[1] == 0:
        print("[Anomaly] No numeric columns found.")
        df["anomaly_score"] = 0.0
        df["is_anomaly"] = False
        return df

    # Scale the data
    scaler = StandardScaler()
    scaled = scaler.fit_transform(numeric_df)

    # Fit Isolation Forest
    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100
    )
    model.fit(scaled)

    # Predict: -1 = anomaly, 1 = normal
    predictions = model.predict(scaled)
    scores = model.score_samples(scaled)  # raw anomaly scores

    # Add results back to original DataFrame
    result_df = df.copy()
    result_df["anomaly_score"] = scores
    result_df["is_anomaly"] = predictions == -1

    n_anomalies = result_df["is_anomaly"].sum()
    print(f"[Anomaly] Isolation Forest found {n_anomalies} anomalies out of {len(result_df)} rows")

    return result_df


def detect_with_zscore(df: pd.DataFrame, threshold: float = 3.0) -> pd.DataFrame:
    """
    Flag rows where any numeric column exceeds 'threshold' standard deviations.
    Simple and interpretable — good for showing in a Deloitte interview.
    """
    numeric_df = df.select_dtypes(include=["number"]).dropna(axis=1)

    if numeric_df.empty:
        df["zscore_flag"] = False
        return df

    z_scores = np.abs((numeric_df - numeric_df.mean()) / numeric_df.std())
    flagged = (z_scores > threshold).any(axis=1)

    result_df = df.copy()
    result_df["zscore_flag"] = flagged
    result_df["max_zscore"] = z_scores.max(axis=1)

    n_flagged = flagged.sum()
    print(f"[Anomaly] Z-Score flagged {n_flagged} rows with z > {threshold}")

    return result_df


def run_anomaly_detection(tables: list[dict], log_to_mlflow: bool = True) -> list[dict]:
    """
    Run both anomaly detection methods on all loaded financial tables.
    Optionally logs results to MLflow for experiment tracking.
    Returns updated list of table dicts with anomaly columns added.
    """
    results = []

    if log_to_mlflow:
        mlflow.set_experiment("audit-anomaly-detection")
        mlflow.start_run(run_name="isolation_forest_run")

    for table in tables:
        df = table["dataframe"]
        source = table["source"]
        sheet = table["sheet"]

        print(f"\n[Anomaly] Processing: {source} — sheet: {sheet}")

        # Run both methods
        df_if = detect_with_isolation_forest(df)
        df_final = detect_with_zscore(df_if)

        n_anomalies = df_final["is_anomaly"].sum()
        n_zscore = df_final["zscore_flag"].sum()

        if log_to_mlflow:
            mlflow.log_metric(f"{source}_{sheet}_if_anomalies", int(n_anomalies))
            mlflow.log_metric(f"{source}_{sheet}_zscore_flags", int(n_zscore))

        results.append({
            "source": source,
            "sheet": sheet,
            "dataframe": df_final,
            "n_anomalies": int(n_anomalies),
            "n_zscore_flags": int(n_zscore)
        })

    if log_to_mlflow:
        mlflow.end_run()

    return results


def get_anomaly_summary(results: list[dict]) -> pd.DataFrame:
    """
    Create a summary DataFrame of anomaly counts per table.
    Used by the dashboard and report generator.
    """
    summary_rows = []
    for r in results:
        summary_rows.append({
            "Source": r["source"],
            "Sheet": r["sheet"],
            "Total Rows": len(r["dataframe"]),
            "IF Anomalies": r["n_anomalies"],
            "Z-Score Flags": r["n_zscore_flags"],
            "Risk Level": "HIGH" if r["n_anomalies"] > 5 else "MEDIUM" if r["n_anomalies"] > 0 else "LOW"
        })
    return pd.DataFrame(summary_rows)


if __name__ == "__main__":
    # Generate dummy financial data for testing
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({
        "Revenue": np.random.normal(500000, 50000, n),
        "Expenses": np.random.normal(400000, 40000, n),
        "Net_Profit": np.random.normal(100000, 15000, n),
        "Tax": np.random.normal(30000, 5000, n),
    })

    # Inject obvious anomalies
    df.loc[10, "Revenue"] = 9999999
    df.loc[50, "Expenses"] = -500000

    test_tables = [{"source": "test.csv", "sheet": "main", "dataframe": df}]
    results = run_anomaly_detection(test_tables, log_to_mlflow=False)

    print("\n--- Anomaly Summary ---")
    summary = get_anomaly_summary(results)
    print(summary)

    print("\n--- Flagged Rows ---")
    flagged = results[0]["dataframe"][results[0]["dataframe"]["is_anomaly"]]
    print(flagged[["Revenue", "Expenses", "Net_Profit", "anomaly_score", "is_anomaly"]].head(10))

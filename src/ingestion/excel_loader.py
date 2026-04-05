"""
Layer 1 - Excel / CSV Ingestion
Reads financial tables from Excel and CSV files.
Returns clean DataFrames ready for anomaly detection.
"""

import pandas as pd
from pathlib import Path


def load_excel(file_path: str) -> dict[str, pd.DataFrame]:
    """
    Load all sheets from an Excel file.
    Returns a dict where keys are sheet names and values are DataFrames.
    """
    sheets = pd.read_excel(file_path, sheet_name=None)
    print(f"[Excel Loader] Loaded {len(sheets)} sheet(s) from {Path(file_path).name}")
    for sheet_name, df in sheets.items():
        print(f"  Sheet: '{sheet_name}' — {df.shape[0]} rows x {df.shape[1]} cols")
    return sheets


def load_csv(file_path: str) -> pd.DataFrame:
    """
    Load a single CSV file into a DataFrame.
    """
    df = pd.read_csv(file_path)
    print(f"[CSV Loader] Loaded {df.shape[0]} rows x {df.shape[1]} cols from {Path(file_path).name}")
    return df


def load_all_tables(folder_path: str = "data/raw") -> list[dict]:
    """
    Load all Excel and CSV files from a folder.
    Returns a list of dicts with 'source', 'sheet', and 'dataframe'.
    """
    all_tables = []
    folder = Path(folder_path)

    # Load Excel files
    for excel_file in folder.glob("*.xlsx"):
        sheets = load_excel(str(excel_file))
        for sheet_name, df in sheets.items():
            all_tables.append({
                "source": excel_file.name,
                "sheet": sheet_name,
                "dataframe": df
            })

    # Load CSV files
    for csv_file in folder.glob("*.csv"):
        df = load_csv(str(csv_file))
        all_tables.append({
            "source": csv_file.name,
            "sheet": "main",
            "dataframe": df
        })

    print(f"[Table Loader] Total tables loaded: {len(all_tables)}")
    return all_tables


def get_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract only numeric columns from a DataFrame.
    Used as input for the anomaly detection module.
    """
    numeric_df = df.select_dtypes(include=["number"]).dropna()
    return numeric_df


if __name__ == "__main__":
    tables = load_all_tables("data/raw")
    if tables:
        df = tables[0]["dataframe"]
        print("\n--- Sample Data ---")
        print(df.head())
        print("\n--- Numeric Columns ---")
        print(get_numeric_columns(df).head())

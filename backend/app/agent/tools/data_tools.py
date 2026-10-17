"""Data-analysis tools (pandas) — load & summarize local CSV/Excel offline."""
from __future__ import annotations

from ..registry import registry
from ..safety import resolve_path, workspace_out


def _load(path):
    import pandas as pd
    p = resolve_path(path, must_exist=True)
    if p.suffix.lower() in (".xlsx", ".xls"):
        return pd.read_excel(p)
    return pd.read_csv(p)


@registry.tool(
    "analyze_data",
    "Load a local CSV/Excel file and return a summary: shape, columns, dtypes, and "
    "descriptive statistics.",
    {"path": {"type": "string", "description": "Path to a .csv or .xlsx file"}},
    plugin="data",
)
def analyze_data(path: str) -> str:
    try:
        df = _load(path)
    except Exception as e:
        return f"Could not load data: {e}"
    rows, cols = df.shape
    out = [f"{rows} rows × {cols} columns",
           "Columns: " + ", ".join(f"{c} ({df[c].dtype})" for c in df.columns[:30]),
           "", "First rows:", df.head(5).to_string(max_cols=12), "", "Summary:"]
    try:
        out.append(df.describe(include="all").transpose().to_string()[:4000])
    except Exception:
        pass
    return "\n".join(out)[:12000]


@registry.tool(
    "data_aggregate",
    "Group a CSV/Excel by a column and aggregate another (sum/mean/count/min/max).",
    {
        "path": {"type": "string", "description": "Path to a .csv or .xlsx file"},
        "group_by": {"type": "string", "description": "Column to group by"},
        "value_col": {"type": "string", "description": "Numeric column to aggregate"},
        "how": {"type": "string", "description": "sum | mean | count | min | max", "_optional": True},
    },
    plugin="data",
)
def data_aggregate(path: str, group_by: str, value_col: str, how: str = "sum") -> str:
    try:
        df = _load(path)
    except Exception as e:
        return f"Could not load data: {e}"
    if group_by not in df.columns or value_col not in df.columns:
        return f"Columns must be in: {', '.join(map(str, df.columns))}"
    how = how if how in ("sum", "mean", "count", "min", "max") else "sum"
    try:
        result = getattr(df.groupby(group_by)[value_col], how)().sort_values(ascending=False)
    except Exception as e:
        return f"Aggregation failed: {e}"
    return f"{value_col} by {group_by} ({how}):\n" + result.head(30).to_string()


@registry.tool(
    "data_to_chart",
    "Aggregate a CSV/Excel by a category column and save a chart PNG of the result.",
    {
        "path": {"type": "string", "description": "Path to a .csv or .xlsx file"},
        "category_col": {"type": "string", "description": "Category (x-axis) column"},
        "value_col": {"type": "string", "description": "Numeric (y-axis) column"},
        "filename": {"type": "string", "description": "Output PNG name", "_optional": True},
        "chart_type": {"type": "string", "description": "bar | line | pie", "_optional": True},
    },
    plugin="data",
)
def data_to_chart(path: str, category_col: str, value_col: str,
                  filename: str = "data_chart.png", chart_type: str = "bar") -> str:
    try:
        df = _load(path)
    except Exception as e:
        return f"Could not load data: {e}"
    if category_col not in df.columns or value_col not in df.columns:
        return f"Columns must be in: {', '.join(map(str, df.columns))}"
    grouped = df.groupby(category_col)[value_col].sum().sort_values(ascending=False).head(12)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    if not filename.lower().endswith(".png"):
        filename += ".png"
    out = workspace_out(filename)
    plt.figure(figsize=(8, 5))
    colors = ["#ef4444", "#10b981", "#3b82f6", "#f5b301", "#a855f7", "#737373"]
    ct = (chart_type or "bar").lower()
    if ct == "line":
        plt.plot(grouped.index.astype(str), grouped.values, color="#10b981", marker="o")
    elif ct == "pie":
        plt.pie(grouped.values, labels=grouped.index.astype(str), autopct="%1.0f%%",
                colors=colors * 3)
    else:
        plt.bar(grouped.index.astype(str), grouped.values,
                color=[colors[i % len(colors)] for i in range(len(grouped))])
        plt.xticks(rotation=45, ha="right")
    plt.title(f"{value_col} by {category_col}")
    plt.tight_layout()
    plt.savefig(str(out), dpi=110)
    plt.close()
    return f"Saved chart of {value_col} by {category_col}: {out}"

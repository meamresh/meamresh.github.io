"""Market risk demo entrypoint.

Summarizes committed notebook and figure artifacts for quick validation.
"""

from __future__ import annotations

import json
from pathlib import Path


def count_markdown_cells(nb_path: Path) -> int:
    with nb_path.open("r", encoding="utf-8") as f:
        nb = json.load(f)
    return sum(1 for cell in nb.get("cells", []) if cell.get("cell_type") == "markdown")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    notebook = root / "finance/notebooks/market_risk_filter_stability.ipynb"
    figure = root / "hidden_markov_model/assets/img/act2_nees.png"

    print("Market Risk - artifact check")
    print(f"Notebook: {notebook} (markdown cells: {count_markdown_cells(notebook)})")
    print(f"Figure:   {figure} (bytes: {figure.stat().st_size})")


if __name__ == "__main__":
    main()

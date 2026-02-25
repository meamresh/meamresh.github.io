"""Sentiment demo entrypoint.

Summarizes committed notebook and figure artifacts for quick validation.
"""

from __future__ import annotations

import json
from pathlib import Path


def count_total_cells(nb_path: Path) -> int:
    with nb_path.open("r", encoding="utf-8") as f:
        nb = json.load(f)
    return len(nb.get("cells", []))


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    notebook = root / "finance/notebooks/sentiment_signal_filtering.ipynb"
    figure = root / "hidden_markov_model/assets/img/particle_cloud.gif"

    print("Sentiment - artifact check")
    print(f"Notebook: {notebook} (total cells: {count_total_cells(notebook)})")
    print(f"Figure:   {figure} (bytes: {figure.stat().st_size})")


if __name__ == "__main__":
    main()

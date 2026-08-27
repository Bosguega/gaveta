"""Testes do reader.py (pyembroidery) usando fixtures reais do monorepo.

Requer `pyembroidery` e `pillow` instalados (pip install pyembroidery pillow).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY_DIR = HERE.parent.parent.parent / "apps" / "embroidery-viewer" / "src-tauri" / "py"
FIXTURES = (
    HERE.parent.parent.parent
    / "apps"
    / "pdf-collection-viewer"
    / "src-tauri"
    / "tests"
    / "fixtures"
    / "pes"
)


def _run(pes: Path, png: Path | None = None) -> dict:
    cmd = [sys.executable, str(PY_DIR / "reader.py"), str(pes)]
    if png is not None:
        cmd += ["--png", str(png)]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    assert proc.returncode == 0, f"reader.py falhou: {proc.stderr}"
    return json.loads(proc.stdout)


def test_simple_matches_expected_stats() -> None:
    data = _run(FIXTURES / "simple.pes")
    assert data["version"] == "pyembroidery"
    # simple.pes contém apenas stitches; bbox não deve ser zerado.
    assert data["bounds"]["max_x"] > 0 or data["bounds"]["max_y"] > 0
    assert data["plainStitchCount"] >= 1
    assert data["stitches"]


def test_png_render_creates_file(tmp_path: Path) -> None:
    png = tmp_path / "thumb.png"
    data = _run(FIXTURES / "simple.pes", png)
    assert data["thumbnail"] == str(png)
    assert png.exists() and png.stat().st_size > 0


def test_multicolor_has_threads() -> None:
    data = _run(FIXTURES / "multicolor.pes")
    assert len(data["threads"]) > 1
    assert data["plainStitchCount"] >= 1

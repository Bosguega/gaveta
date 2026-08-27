"""Extrai métricas de referência via pyembroidery para o teste de regressão Rust.

Uso: python pes_pyembroidery.py <fixture...>
Emite uma linha JSON por arquivo:
    {"file":..., "plainStitchCount":N, "colorCount":N, "jumpCount":N,
     "colorChangeCount":N, "hasEnd":bool, "bboxMm":{w,h,"min_x","min_y","max_x","max_y"}}

Usado pelos testes pes_compare e pela CI.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pyembroidery
from pyembroidery import STITCH, JUMP, END, COLOR_CHANGE


def metrics(path: Path) -> dict:
    pattern = pyembroidery.read(str(path))
    if pattern is None:
        raise RuntimeError(f"pyembroidery não decodificou {path}")

    min_x, min_y, max_x, max_y = pattern.bounds()
    plain = 0
    jumps = 0
    color_changes = 0
    has_end = False
    for _, _, cmd in pattern.stitches:
        if cmd & END:
            has_end = True
        if cmd & JUMP:
            jumps += 1
        elif cmd & STITCH and not (cmd & JUMP):
            plain += 1
        if cmd & COLOR_CHANGE:
            color_changes += 1

    color_count = len(pattern.threadlist) if pattern.threadlist else color_changes + 1
    return {
        "file": str(path),
        "plainStitchCount": plain,
        "colorCount": color_count,
        "jumpCount": jumps,
        "colorChangeCount": color_changes,
        "hasEnd": has_end,
        "bboxMm": {
            "width": (max_x - min_x) / 10.0,
            "height": (max_y - min_y) / 10.0,
            "min_x": min_x / 10.0,
            "min_y": min_y / 10.0,
            "max_x": max_x / 10.0,
            "max_y": max_y / 10.0,
        },
    }


def main() -> int:
    ok = True
    for p in sys.argv[1:]:
        path = Path(p)
        if not path.is_file():
            print(json.dumps({"file": str(path), "error": "not found"}))
            ok = False
            continue
        try:
            out = metrics(path)
        except Exception as exc:  # noqa: BLE001
            out = {"file": str(path), "error": str(exc)}
            ok = False
        print(json.dumps(out))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

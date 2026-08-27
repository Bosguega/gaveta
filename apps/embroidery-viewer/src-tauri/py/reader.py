"""Lê arquivos .pes/.pec usando pyembroidery e emite JSON + miniatura PNG.

Uso: python reader.py <arquivo> [--png <saida>]
O JSON é escrito em stdout (UTF-8). Diagnostics vão para stderr.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pyembroidery
from pyembroidery import (
    STITCH,
    JUMP,
    TRIM,
    STOP,
    END,
    COLOR_CHANGE,
)


def cmd_label(cmd: int) -> str:
    """Devolve o nome canônico do comando pyembroidery.

    As constantes de pyembroidery são códigos sequenciais (STITCH=0, JUMP=1,
    TRIM=2, STOP=3, END=4, COLOR_CHANGE=5), não bit-flags — portanto o comando
    de cada ponto é comparado por igualdade.
    """
    if cmd == STITCH:
        return "STITCH"
    if cmd == JUMP:
        return "JUMP"
    if cmd == TRIM:
        return "TRIM"
    if cmd == STOP:
        return "STOP"
    if cmd == END:
        return "END"
    if cmd == COLOR_CHANGE:
        return "COLOR_CHANGE"
    return "STITCH"


def thread_rgb(t: pyembroidery.EmbThread) -> tuple[int, int, int]:
    """Extrai (r,g,b) de uma thread, robusto entre versões."""
    hex_color = getattr(t, "color", None)
    if not hex_color:
        return (0, 0, 0)
    s = str(hex_color).lstrip("#")
    try:
        n = int(s, 16)
        return ((n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF)
    except ValueError:
        return (0, 0, 0)


def threads_of(pattern: pyembroidery.EmbPattern) -> list[dict]:
    out: list[dict] = []
    for idx, t in enumerate(pattern.threadlist):
        r, g, b = thread_rgb(t)
        desc = t.description or t.catalog_number or f"cor {idx}"
        color_index = -1
        if hasattr(t, "color_index"):
            try:
                color_index = int(t.color_index)
            except (TypeError, ValueError):
                color_index = -1
        out.append(
            {
                "index": idx,
                "rgb": [r, g, b],
                "description": desc,
                "colorIndex": color_index,
            }
        )
    return out


def stitches_of(pattern: pyembroidery.EmbPattern) -> list[dict]:
    out: list[dict] = []
    for x, y, cmd in pattern.stitches:
        out.append({"x": x / 10.0, "y": y / 10.0, "type": cmd_label(cmd), "cmd": int(cmd)})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Lê bordados via pyembroidery -> JSON")
    ap.add_argument("file", help="arquivo .pes/.pec")
    ap.add_argument("--png", help="miniatura PNG de saída")
    args = ap.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"arquivo não encontrado: {path}", file=sys.stderr)
        return 2

    pattern = pyembroidery.read(str(path))
    if pattern is None:
        print("pyembroidery não conseguiu decodificar o arquivo", file=sys.stderr)
        return 3

    # bbox em mm (coordenadas já vêm em 1/10 mm).
    min_x, min_y, max_x, max_y = pattern.bounds()
    width_mm = float(max_x - min_x) / 10.0
    height_mm = float(max_y - min_y) / 10.0

    threads = threads_of(pattern)
    plain = sum(1 for _, _, cmd in pattern.stitches if cmd == STITCH)
    jumps = sum(1 for _, _, cmd in pattern.stitches if cmd == JUMP)
    ends = sum(1 for _, _, cmd in pattern.stitches if cmd == END)

    result = {
        "version": "pyembroidery",
        "paletteIndex": [0] * 0,
        "threads": threads,
        "stitches": stitches_of(pattern),
        "bounds": {
            "min_x": float(min_x) / 10.0,
            "min_y": float(min_y) / 10.0,
            "max_x": float(max_x) / 10.0,
            "max_y": float(max_y) / 10.0,
        },
        "designWidthMm": width_mm,
        "designHeightMm": height_mm,
        "plainStitchCount": plain,
        "jumpCount": jumps,
        "endCount": ends,
        "pageCount": None,
        "thumbnail": None,
    }

    if args.png:
        ok = pyembroidery.write_png(pattern, args.png)
        if not ok:
            print("falha ao escrever PNG", file=sys.stderr)
        result["thumbnail"] = args.png

    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())


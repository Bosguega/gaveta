"""Shared runtime state (loaded generators) and generation progress.

Progress is kept intentionally lightweight: VRAM is sampled only inside
step callbacks (once per diffusion step), which is negligible overhead.
"""

import threading
import time
from dataclasses import dataclass, field

from src.generator.base import Generator

generators: dict[str, Generator] = {}


@dataclass
class Progress:
    phase: str = "idle"  # idle | loading | generating | done | error
    step: int = 0
    total_steps: int = 0
    model: str | None = None
    vram_used_gb: float = 0.0
    vram_total_gb: float = 0.0
    peak_vram_used_gb: float = 0.0
    ram_used_gb: float = 0.0
    ram_total_gb: float = 0.0
    cpu_percent: float = 0.0
    updated_at: float = field(default_factory=time.time)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def update(self, **kwargs) -> None:
        with self._lock:
            self.updated_at = time.time()
            for key, value in kwargs.items():
                setattr(self, key, value)

    def note_peak_vram(self, used_gb: float) -> None:
        with self._lock:
            self.peak_vram_used_gb = max(self.peak_vram_used_gb, used_gb)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "phase": self.phase,
                "step": self.step,
                "total_steps": self.total_steps,
                "model": self.model,
                "vram_used_gb": round(self.vram_used_gb, 2),
                "vram_total_gb": round(self.vram_total_gb, 2),
                "peak_vram_used_gb": round(self.peak_vram_used_gb, 2),
                "ram_used_gb": round(self.ram_used_gb, 2),
                "ram_total_gb": round(self.ram_total_gb, 2),
                "cpu_percent": round(self.cpu_percent, 1),
                "updated_at": self.updated_at,
            }


progress = Progress()

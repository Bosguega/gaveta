"""HTTP API routes."""

import threading
import time
import uuid
from datetime import datetime, timezone
from functools import lru_cache

import torch
import psutil
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.config import OUTPUT_DIR, get_device, load_model_configs
from src.generator.base import GenerateParams
from src.generator.registry import create_generator
from src.state import generators, progress
from src.api.jobs import job_queue

router = APIRouter()
_generators_lock = threading.Lock()


@lru_cache(maxsize=1)
def _cached_model_configs():
    """Load models.json once and cache the result for the lifetime of the process."""
    return load_model_configs()


class GenerateRequest(BaseModel):
    model: str = "sdxl"
    prompt: str
    negative_prompt: str = ""
    seed: int | None = None
    steps: int = Field(default=30, ge=1, le=100)
    guidance: float = Field(default=7.0, ge=0.0, le=30.0)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)


@router.get("/models")
def list_models():
    return [
        {
            "id": cfg.id,
            "model_id": cfg.model_id,
            "type": cfg.type,
            "loaded": cfg.id in generators and generators[cfg.id].is_loaded(),
            "defaults": {
                "steps": cfg.default_steps,
                "guidance": cfg.default_guidance,
                "width": cfg.default_size,
                "height": cfg.default_size,
            },
        }
        for cfg in generators_configs()
    ]


def generators_configs():
    return _cached_model_configs().values()


@router.post("/generate")
def generate(request: GenerateRequest):
    configs = _cached_model_configs()
    if request.model not in configs:
        raise HTTPException(status_code=404, detail=f"Unknown model '{request.model}'")

    device = get_device()
    if device.type != "cuda":
        print(f"[generate] WARNING: running on {device} — generation will be very slow")

    # Thread-safe lazy load: acquire lock only when the generator is missing.
    with _generators_lock:
        generator = generators.get(request.model)
        if generator is None:
            generator = create_generator(configs[request.model])
            generators[request.model] = generator

    params = GenerateParams(
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        seed=request.seed,
        steps=request.steps,
        guidance=request.guidance,
        width=request.width,
        height=request.height,
    )

    def run():
        start = time.perf_counter()
        result = generator.generate(params)
        elapsed = time.perf_counter() - start

        OUTPUT_DIR.mkdir(exist_ok=True)
        filename = f"{datetime.now(timezone.utc):%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}.png"
        result.image.save(OUTPUT_DIR / filename)

        log_msg = (
            f"[generate] model={request.model} seed={result.seed} "
            f"{params.width}x{params.height} time={elapsed:.1f}s"
        )
        if device.type == "cuda":
            vram = torch.cuda.max_memory_allocated() / 1024**3
            log_msg += f" peak_vram={vram:.2f}GB"
            torch.cuda.reset_peak_memory_stats()
        strategy = getattr(generator, "strategy", None)
        if strategy:
            log_msg += f" strategy={strategy}"
        rss = psutil.Process().memory_info().rss / 1024**3
        log_msg += f" rss={rss:.2f}GB"
        print(log_msg)

        return {
            "status": "completed",
            "image": f"/images/{filename}",
            "seed": result.seed,
            "model": request.model,
            "generation_time": round(elapsed, 2),
        }

    job = job_queue.submit(run)
    job_queue.wait(job)
    if job.status == "failed":
        progress.update(phase="error")
        raise HTTPException(status_code=500, detail=job.error)
    return job.result


@router.get("/progress")
def get_progress():
    # Live system metrics, sampled on demand (cheap, once per poll request).
    import psutil

    ram = psutil.virtual_memory()
    progress.update(
        ram_used_gb=ram.used / 1024**3,
        ram_total_gb=ram.total / 1024**3,
        cpu_percent=psutil.cpu_percent(interval=None),
    )
    return progress.snapshot()


@router.get("/images/{filename}")
def get_image(filename: str):
    path = OUTPUT_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type="image/png")

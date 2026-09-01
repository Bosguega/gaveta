"""FastAPI entrypoint for the local image generation server."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch
import torch.cuda
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.config import STATIC_DIR, get_device
from src.api.jobs import job_queue
from src.api.routes import router
import src.generator.pipelines  # noqa: F401  (populates the generator registry)


@asynccontextmanager
async def lifespan(app: FastAPI):
    job_queue.start()
    device = get_device()
    print("=" * 50)
    print(f"[image-gen] device: {device}")
    if device.type == "cuda":
        total = torch.cuda.get_device_properties(device).total_memory / 1024**3
        free, _ = torch.cuda.mem_get_info(device)
        print(f"[image-gen] gpu: {torch.cuda.get_device_name(device)}")
        print(f"[image-gen] vram: {free / 1024**3:.1f}GB free / {total:.1f}GB total")
    print("[image-gen] ui: http://127.0.0.1:8000")
    print("=" * 50)
    yield


app = FastAPI(title="image-gen", version="0.1.0", lifespan=lifespan)
app.include_router(router)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

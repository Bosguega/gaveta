"""Application configuration: paths, device detection and model registry loading."""

import json
from dataclasses import dataclass
from pathlib import Path

import torch

APP_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = APP_ROOT / "outputs"
STATIC_DIR = APP_ROOT / "static"
MODELS_CONFIG_PATH = APP_ROOT / "models.json"


@dataclass(frozen=True)
class ModelConfig:
    id: str
    model_id: str
    type: str
    default_steps: int = 30
    default_guidance: float = 7.0
    default_size: int = 1024


def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def get_dtype(device: torch.device) -> torch.dtype:
    return torch.float16 if device.type == "cuda" else torch.float32


def load_model_configs() -> dict[str, ModelConfig]:
    raw = json.loads(MODELS_CONFIG_PATH.read_text(encoding="utf-8"))
    configs = {}
    for entry in raw["models"]:
        config = ModelConfig(
            id=entry["id"],
            model_id=entry["model_id"],
            type=entry["type"],
            default_steps=entry.get("default_steps", 30),
            default_guidance=entry.get("default_guidance", 7.0),
            default_size=entry.get("default_size", 1024),
        )
        configs[config.id] = config
    return configs

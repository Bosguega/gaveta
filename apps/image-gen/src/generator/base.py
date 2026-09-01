"""Generic generator interface.

Concrete pipelines (SDXL, and future models) implement this protocol. Each
implementation fully encapsulates its own components (text encoders,
tokenizers, transformer/unet, VAE, scheduler...). No component is shared
between generators.
"""

from dataclasses import dataclass
from typing import Any, Protocol

from src.config import ModelConfig


@dataclass(frozen=True)
class GenerateParams:
    prompt: str
    negative_prompt: str = ""
    seed: int | None = None
    steps: int = 30
    guidance: float = 7.0
    width: int = 1024
    height: int = 1024


@dataclass(frozen=True)
class GenerationResult:
    image: Any  # PIL.Image
    seed: int


class Generator(Protocol):
    """A loaded, ready-to-use image generation pipeline."""

    config: ModelConfig

    def load(self) -> None: ...

    def is_loaded(self) -> bool: ...

    def generate(self, params: GenerateParams) -> GenerationResult: ...

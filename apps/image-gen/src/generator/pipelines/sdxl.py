"""SDXL text-to-image pipeline.

Encapsulates both text encoders, both tokenizers, the UNet, the VAE and the
scheduler. GPU-first: the whole pipeline fits in a 12GB card at <=1024px,
with model CPU offload kept only as an OOM fallback.
"""

import gc
import random
import time

import torch

from src.config import ModelConfig, get_device, get_dtype
from src.generator.base import GenerateParams, GenerationResult
from src.generator.registry import register
from src.state import progress


def _sample_vram() -> tuple[float, float] | None:
    """Return (app_used_gb, total_gb) or None if CUDA is unavailable.

    `used` reflects only this process's allocations (torch.cuda.
    max_memory_allocated, includes the caching allocator's peak); `total` is
    the card's physical capacity. Cheap: called once per step.
    """
    if not torch.cuda.is_available():
        return None
    used = torch.cuda.max_memory_allocated() / 1024**3
    _, total = torch.cuda.mem_get_info()
    return used, total / 1024**3


@register("text2img.sdxl")
class SDXLGenerator:
    def __init__(self, config: ModelConfig) -> None:
        self.config = config
        self._pipe = None
        self.strategy: str | None = None  # full_gpu | cpu_offload

    def is_loaded(self) -> bool:
        return self._pipe is not None

    def _release(self) -> None:
        """Drop the pipeline and free as much VRAM as possible."""
        self._pipe = None
        self.strategy = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def load(self, *, cpu_offload: bool = False) -> None:
        if self.is_loaded():
            return

        from diffusers import StableDiffusionXLPipeline

        progress.update(phase="loading", model=self.config.id)
        device = get_device()
        dtype = get_dtype(device)
        print(f"[sdxl] loading '{self.config.model_id}' on {device} ({dtype})...")
        start = time.perf_counter()

        pipe = StableDiffusionXLPipeline.from_pretrained(
            self.config.model_id,
            dtype=dtype,
            variant="fp16" if dtype == torch.float16 else None,
            use_safetensors=True,
        )
        if cpu_offload:
            pipe.enable_model_cpu_offload()
            self.strategy = "cpu_offload"
        else:
            pipe.to(device)
            self.strategy = "full_gpu"
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()

        self._pipe = pipe
        elapsed = time.perf_counter() - start
        print(f"[sdxl] model loaded in {elapsed:.1f}s (strategy={self.strategy})")

    def generate(self, params: GenerateParams) -> GenerationResult:
        try:
            return self._generate(params)
        except torch.OutOfMemoryError:
            print(f"[sdxl] OOM with strategy={self.strategy}; falling back to cpu_offload")
            self._release()
            self.load(cpu_offload=True)
            return self._generate(params)

    def _generate(self, params: GenerateParams) -> GenerationResult:
        self.load()
        assert self._pipe is not None

        seed = params.seed if params.seed is not None else random.randint(0, 2**32 - 1)
        device = get_device()
        generator = torch.Generator(device=device).manual_seed(seed)

        progress.update(
            phase="generating",
            step=0,
            total_steps=params.steps,
            model=self.config.id,
            peak_vram_used_gb=0.0,  # reset peak for this generation
        )

        def on_step_end(pipe, step_index, timestep, callback_kwargs):
            vram = _sample_vram()
            if vram:
                progress.note_peak_vram(vram[0])
            progress.update(
                step=step_index + 1,
                total_steps=params.steps,
                vram_used_gb=vram[0] if vram else 0.0,
                vram_total_gb=vram[1] if vram else 0.0,
            )
            return callback_kwargs

        result = self._pipe(
            prompt=params.prompt,
            negative_prompt=params.negative_prompt or None,
            num_inference_steps=params.steps,
            guidance_scale=params.guidance,
            width=params.width,
            height=params.height,
            generator=generator,
            callback_on_step_end=on_step_end,
        )
        # Sample after the VAE decode: the true VRAM peak can happen here,
        # after the last diffusion step.
        vram = _sample_vram()
        if vram:
            progress.note_peak_vram(vram[0])
            progress.update(vram_used_gb=vram[0], vram_total_gb=vram[1])
        progress.update(phase="done")
        return GenerationResult(image=result.images[0], seed=seed)

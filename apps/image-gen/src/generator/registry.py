"""Registry of available generator implementations, keyed by pipeline type."""

from collections.abc import Callable

from src.config import ModelConfig
from src.generator.base import Generator

_REGISTRY: dict[str, Callable[[ModelConfig], Generator]] = {}


def register(pipeline_type: str) -> Callable:
    def decorator(factory: Callable[[ModelConfig], Generator]):
        _REGISTRY[pipeline_type] = factory
        return factory

    return decorator


def create_generator(config: ModelConfig) -> Generator:
    if config.type not in _REGISTRY:
        raise ValueError(f"No generator registered for pipeline type '{config.type}'")
    return _REGISTRY[config.type](config)

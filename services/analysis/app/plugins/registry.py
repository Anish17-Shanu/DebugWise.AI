from collections.abc import Callable
from typing import Any


AnalyzerPlugin = Callable[[str, str], list[dict[str, Any]]]


class PluginRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, list[AnalyzerPlugin]] = {}

    def register(self, language: str, plugin: AnalyzerPlugin) -> None:
        self._plugins.setdefault(language, []).append(plugin)

    def run(self, language: str, source: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for plugin in self._plugins.get(language, []):
            results.extend(plugin(language, source))
        return results


registry = PluginRegistry()


# Ollama Setup

DebugWise.AI is designed to run fully offline with local models through Ollama.

## Install Ollama

1. Install Ollama for your platform.
2. Start the Ollama service locally.

## Pull recommended models

```bash
ollama pull deepseek-coder
ollama pull deepseek-r1
ollama pull codellama
```

## Verify

```bash
ollama list
curl http://localhost:11434/api/tags
```

## Model policy

- `deepseek-coder`: default for coding fixes and patch generation.
- `deepseek-r1`: default for root-cause reasoning and deeper explanations.
- `codellama`: resilience fallback if primary models are unavailable.

## Offline note

If Ollama is not running, DebugWise.AI still provides deterministic rule-based diagnostics and fix suggestions. The assistant degrades gracefully and tells the user that local reasoning is unavailable.


---
summary: "Run MrBeanBot with Ollama (local LLM runtime)"
read_when:
  - You want to run MrBeanBot with local models via Ollama
  - You need Ollama setup and configuration guidance
---
# Ollama

Ollama is a local LLM runtime that makes it easy to run open-source models on your machine. MrBeanBot integrates with Ollama's OpenAI-compatible API and can **auto-discover tool-capable models** when you opt in with `OLLAMA_API_KEY` (or an auth profile) and do not define an explicit `models.providers.ollama` entry.

## Quick start

1) Install Ollama: https://ollama.ai

2) Pull a model:

```bash
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3) Enable Ollama for MrBeanBot (any value works; Ollama doesn't require a real key):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
MrBeanBot config set models.providers.ollama.apiKey "ollama-local"
```

4) Use Ollama models:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/llama3.3" }
    }
  }
}
```

## Model discovery (implicit provider)

When you set `OLLAMA_API_KEY` (or an auth profile) and **do not** define `models.providers.ollama`, MrBeanBot discovers models from the local Ollama instance at `http://127.0.0.1:11434`:

- Queries `/api/tags` and `/api/show`
- Keeps only models that report `tools` capability
- Marks `reasoning` when the model reports `thinking`
- Reads `contextWindow` from `model_info["<arch>.context_length"]` when available
- Sets `maxTokens` to 10× the context window
- Sets all costs to `0`

This avoids manual model entries while keeping the catalog aligned with Ollama's capabilities.

To see what models are available:

```bash
ollama list
MrBeanBot models list
```

To add a new model, simply pull it with Ollama:

```bash
ollama pull mistral
```

The new model will be automatically discovered and available to use.

If you set `models.providers.ollama` explicitly, auto-discovery is skipped and you must define models manually (see below).

## Configuration

### Basic setup (implicit discovery)

The simplest way to enable Ollama is via environment variable:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Explicit setup (manual models)

Use explicit config when:
- Ollama runs on another host/port.
- You want to force specific context windows or model lists.
- You want to include models that do not report tool support.

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "llama3.3",
            name: "Llama 3.3",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

If `OLLAMA_API_KEY` is set, you can omit `apiKey` in the provider entry and MrBeanBot will fill it for availability checks.

### Custom base URL (explicit config)

If Ollama is running on a different host or port (explicit config disables auto-discovery, so define models manually):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1"
      }
    }
  }
}
```

### Model selection

Once configured, all your Ollama models are available:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/llama3.3",
        fallback: ["ollama/qwen2.5-coder:32b"]
      }
    }
  }
}
```

## Setup via Ollama Launch

If MrBeanBot is registered in Ollama's integration registry, you can configure it directly from Ollama:

```bash
# Launch MrBeanBot with Ollama as the backend
ollama launch mrbeanbot

# Configure MrBeanBot with discovered Ollama models
ollama launch mrbeanbot --config
```

The `--config` flag discovers your local Ollama models and writes the provider configuration to `~/.mrbeanbot/mrbeanbot.json`.

## Self-service setup

If you prefer to configure Ollama from the MrBeanBot side (or Ollama hasn't merged the integration yet), use the built-in setup command:

```bash
MrBeanBot ollama setup
```

This probes your local Ollama instance, discovers available models, and writes the provider configuration to your config file.

### Options

| Option | Description |
|--------|-------------|
| `--base-url <url>` | Ollama base URL (default: `http://127.0.0.1:11434`) |
| `--set-default` | Set the first discovered model as the default model |
| `--yes` | Skip confirmation prompts |

### Examples

```bash
# Basic setup (auto-detect models on localhost)
MrBeanBot ollama setup

# Setup with a remote Ollama instance
MrBeanBot ollama setup --base-url http://ollama-host:11434

# Setup and set the first model as default
MrBeanBot ollama setup --set-default
```

## Advanced

### Reasoning models

MrBeanBot marks models as reasoning-capable when Ollama reports `thinking` in `/api/show`:

```bash
ollama pull deepseek-r1:32b
```

### Model Costs

Ollama is free and runs locally, so all model costs are set to $0.

### Context windows

For auto-discovered models, MrBeanBot uses the context window reported by Ollama when available, otherwise it defaults to `8192`. You can override `contextWindow` and `maxTokens` in explicit provider config.

## Troubleshooting

### Ollama not detected

Make sure Ollama is running and that you set `OLLAMA_API_KEY` (or an auth profile), and that you did **not** define an explicit `models.providers.ollama` entry:

```bash
ollama serve
```

And that the API is accessible:

```bash
curl http://localhost:11434/api/tags
```

### No models available

MrBeanBot only auto-discovers models that report tool support. If your model isn't listed, either:
- Pull a tool-capable model, or
- Define the model explicitly in `models.providers.ollama`.

To add models:

```bash
ollama list  # See what's installed
ollama pull llama3.3  # Pull a model
```

### Connection refused

Check that Ollama is running on the correct port:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

## See Also

- [Model Providers](/concepts/model-providers) - Overview of all providers
- [Model Selection](/concepts/models) - How to choose models
- [Configuration](/gateway/configuration) - Full config reference

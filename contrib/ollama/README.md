# Ollama Integration for MrBeanBot

This directory contains the Go source file for registering MrBeanBot in Ollama's integration registry.

## What this enables

Once merged into `github.com/ollama/ollama`, users can run:

```bash
# Launch MrBeanBot with Ollama as the backend
ollama launch mrbeanbot

# Configure MrBeanBot with discovered Ollama models
ollama launch mrbeanbot --config
```

## File overview

- **mrbeanbot.go** -- Implements Ollama's `Runner` + `Editor` interfaces:
  - `Run(model)` -- Launches `MrBeanBot gateway run --force` with `OLLAMA_API_KEY=ollama-local`
  - `Edit(models)` -- Reads/creates `~/.mrbeanbot/mrbeanbot.json` and merges an `ollama` provider
  - `Models()` -- Returns current Ollama model IDs from the config file
  - `Paths()` -- Returns `["~/.mrbeanbot/mrbeanbot.json"]`
  - `String()` -- Returns `"MrBeanBot"`

## Submitting the PR to Ollama

1. Fork `github.com/ollama/ollama`
2. Copy `mrbeanbot.go` into the appropriate integration package (check Ollama's current registry structure)
3. Register the integration in Ollama's integration registry (typically a map in a central file)
4. Run `go vet ./...` to verify the file compiles
5. Open a PR referencing this integration

## Self-service alternative

Users who don't want to wait for the Ollama PR can use MrBeanBot's built-in command:

```bash
MrBeanBot ollama setup
```

This performs the same config write that `ollama launch mrbeanbot --config` would do.

See the [Ollama provider docs](https://docs.molt.bot/providers/ollama) for full details.

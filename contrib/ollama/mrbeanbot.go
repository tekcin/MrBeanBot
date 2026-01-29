// Package mrbeanbot implements the Ollama integration for MrBeanBot.
//
// This file is intended for submission as a PR to github.com/ollama/ollama
// to register MrBeanBot in Ollama's integration registry, enabling:
//
//	ollama launch mrbeanbot
//	ollama launch mrbeanbot --config
//
// It implements the Runner and Editor interfaces expected by Ollama's
// launch command infrastructure.
package mrbeanbot

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// configPath returns the path to the MrBeanBot config file.
func configPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".mrbeanbot", "mrbeanbot.json")
}

// String returns the display name for this integration.
func String() string {
	return "MrBeanBot"
}

// Paths returns the config file paths managed by this integration.
func Paths() []string {
	p := configPath()
	if p == "" {
		return nil
	}
	return []string{p}
}

// Run launches the MrBeanBot gateway with Ollama as the backing provider.
// It sets OLLAMA_API_KEY=ollama-local so MrBeanBot's implicit Ollama provider
// activates without additional user configuration.
func Run(model string) error {
	cmd := exec.Command("MrBeanBot", "gateway", "run", "--force")
	cmd.Env = append(os.Environ(), "OLLAMA_API_KEY=ollama-local")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// Models reads the current Ollama model IDs from the MrBeanBot config file.
func Models() ([]string, error) {
	p := configPath()
	if p == "" {
		return nil, fmt.Errorf("could not determine home directory")
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading config: %w", err)
	}

	var cfg struct {
		Models struct {
			Providers map[string]struct {
				Models []struct {
					ID string `json:"id"`
				} `json:"models"`
			} `json:"providers"`
		} `json:"models"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	ollama, ok := cfg.Models.Providers["ollama"]
	if !ok {
		return nil, nil
	}
	var ids []string
	for _, m := range ollama.Models {
		if m.ID != "" {
			ids = append(ids, m.ID)
		}
	}
	return ids, nil
}

// Edit reads (or creates) the MrBeanBot config file and merges an Ollama
// provider section with the selected models. This is called by
// `ollama launch mrbeanbot --config`.
func Edit(models []string) error {
	p := configPath()
	if p == "" {
		return fmt.Errorf("could not determine home directory")
	}

	// Ensure config directory exists.
	dir := filepath.Dir(p)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	// Read existing config or start fresh.
	var cfg map[string]interface{}
	data, err := os.ReadFile(p)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("reading config: %w", err)
		}
		cfg = make(map[string]interface{})
	} else {
		if err := json.Unmarshal(data, &cfg); err != nil {
			return fmt.Errorf("parsing config: %w", err)
		}
	}

	// Build model definitions.
	modelDefs := make([]interface{}, 0, len(models))
	for _, m := range models {
		modelDefs = append(modelDefs, map[string]interface{}{
			"id":            m,
			"name":          m,
			"reasoning":     false,
			"input":         []string{"text"},
			"cost":          map[string]int{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
			"contextWindow": 128000,
			"maxTokens":     8192,
		})
	}

	// Merge into config.
	modelsSection, _ := cfg["models"].(map[string]interface{})
	if modelsSection == nil {
		modelsSection = make(map[string]interface{})
	}
	providers, _ := modelsSection["providers"].(map[string]interface{})
	if providers == nil {
		providers = make(map[string]interface{})
	}
	providers["ollama"] = map[string]interface{}{
		"baseUrl": "http://127.0.0.1:11434/v1",
		"apiKey":  "ollama-local",
		"api":     "openai-completions",
		"models":  modelDefs,
	}
	modelsSection["providers"] = providers
	cfg["models"] = modelsSection

	// Write back.
	out, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling config: %w", err)
	}
	if err := os.WriteFile(p, out, 0o644); err != nil {
		return fmt.Errorf("writing config: %w", err)
	}

	fmt.Printf("MrBeanBot config updated: %s\n", p)
	fmt.Printf("Configured %d Ollama model(s)\n", len(models))
	return nil
}

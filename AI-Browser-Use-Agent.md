# Agent-Based AI-Driven Browsing — Implementation Complete

> **Status: IMPLEMENTED** — All 10 tasks completed. Dual-mode extraction is live.

## Modules Now Active in Agent Mode

Four modules that were previously unused are now **active** when `EXTRACTION_MODE=agent`:

| Module | Status | Purpose |
|--------|--------|---------|
| `flight_parser.py` | **Active** | 7-strategy parser for Agent history output |
| `build_flight_search_prompt()` | **Active** | Full multi-step Agent prompt (175+ lines) |
| `build_extraction_prompt()` | **Active** | Structured output schema prompt |
| `FlightResultsOutput` | **Active** | Pydantic model for `output_model_schema` |

All four are tested and wired into the agent pipeline via `_run_search_agent()` in `app/services/search.py`.

---

## Problem Solved

The original challenge was:

> The Agent creates a new tab/target which lacks the stealth JS. Direct `page.goto()` on the stealth-injected target works reliably.

**Solution: Option (c) — browser-use's built-in stealth.** The library already includes comprehensive stealth features (strips `--enable-automation`, loads stealth extensions, uses CDP protocol). `create_agent_browser()` leverages the library's native stealth config instead of manual CDP injection.

---

## What Was Implemented

### 1. Dual-Mode Configuration

New settings in `app/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `EXTRACTION_MODE` | `direct` | `direct` (page.goto + JS) or `agent` (browser-use Agent + LLM) |
| `AGENT_MAX_STEPS` | `10` | Maximum Agent reasoning steps before timeout |
| `AGENT_MAX_FAILURES` | `3` | Agent retry limit before giving up |
| `OPENAI_MODEL` | `gpt-4.1-mini` | OpenAI model (used when `OPENAI_API_KEY` is set) |
| `OPENAI_API_KEY` | `""` | Optional — enables OpenAI instead of local Ollama |

### 2. Dual Browser Factories (`app/services/browser.py`)

| Factory | Mode | Stealth Approach |
|---------|------|------------------|
| `create_stealth_browser()` | `direct` | Manual CDP `Page.addScriptToEvaluateOnNewDocument` injection |
| `create_agent_browser()` | `agent` | Library built-in stealth (strips automation flags, loads extensions) |

### 3. Search Dispatcher (`app/services/search.py`)

`_run_search()` dispatches based on `EXTRACTION_MODE`:

- **`direct`** → `_run_search_direct()` — Original 6-step pipeline: goto → wait → evaluate JS → text_parser
- **`agent`** → `_run_search_agent()` — Agent pipeline: pre-navigate → build prompt → create LLM → create Agent → run with step callbacks → parse_flight_results(history)

### 4. LLM Factory (`_create_llm()`)

- **Default (local):** `ChatOllama(model="qwen3:8b", host="http://ollama:11434")`
- **Optional (cloud):** `ChatOpenAI(model="gpt-4.1-mini", api_key=OPENAI_API_KEY)` — when env var is set

### 5. Agent Step Callbacks

`on_step_start` callback emits `ProgressEvent`s in real time — each Agent reasoning step is streamed to the WebSocket timeline.

### 6. Parser Integration

Agent mode routes extraction through the 7-strategy `parse_flight_results(history)` pipeline:

```
Agent history → flight_parser.py (7 strategies) → json_fixer.py → text_parser.py (fallback)
```

### 7. Test Coverage

19 new tests cover both extraction modes:

| File | New Tests | Coverage |
|------|-----------|----------|
| `test_config.py` | 4 | extraction_mode, agent_max_steps, agent_max_failures, openai_model |
| `test_enums.py` | 1 | SearchStatusValue count (3→4 for CANCELLED) |
| `test_browser_service.py` | 4 | create_agent_browser, stealth config, headless mode |
| `test_search_service.py` | 10 | agent pipeline, LLM factory, dispatcher, callbacks, error handling |

---

## Implementation Order (All Completed)

| # | Task | Status |
|---|------|--------|
| 1 | Add `EXTRACTION_MODE` config (`direct` / `agent`) | **COMPLETED** |
| 2 | Solve stealth + Agent compatibility (option c — library built-in) | **COMPLETED** |
| 3 | Create `_run_search_agent()` using Agent + existing prompts | **COMPLETED** |
| 4 | Hook Agent step callback → `ProgressEvent` streaming | **COMPLETED** |
| 5 | Route results through `flight_parser.py` instead of `_parse_extraction()` | **COMPLETED** |
| 6 | Update `_run_search()` to dispatch based on `EXTRACTION_MODE` | **COMPLETED** |
| 7 | Adjust frontend timeouts for Agent mode (60s+) | **COMPLETED** |
| 8 | Test with local Ollama (qwen3:8b) and optional OpenAI | **COMPLETED** |
| 9 | Update tests (mock Agent, test both paths) | **COMPLETED** |
| 10 | Update docs (SPECS, README, CLAUDE.md) | **COMPLETED** |

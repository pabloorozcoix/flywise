# Claude Code Skills — Canonical Reference

> **Source of truth** for creating, maintaining, and evolving `.claude/skills/` in this project.
> Based on [Anthropic's official Skills documentation](https://code.claude.com/docs/en/skills).

---

## What Are Skills?

Skills extend what Claude Code can do. A skill is a directory containing a `SKILL.md` file with instructions. Claude uses skills when relevant to the conversation, or the user can invoke one directly with `/skill-name`.

Skills follow the [Agent Skills](https://agentskills.io/) open standard. Claude Code extends the standard with invocation control, subagent execution, and dynamic context injection.

---

## Directory Structure

### Placement & Priority

| Scope | Location | Visibility |
|-------|----------|------------|
| Enterprise | Managed via IT/DevOps | All organization users |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<skill-name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | Where plugin is enabled |

Priority (highest wins): **enterprise > personal > project**. Plugin skills use namespaced names and cannot conflict.

### Skill Directory Layout

Each skill is a directory with `SKILL.md` as the entrypoint:

```
<skill-name>/
├── SKILL.md           # Main instructions (REQUIRED)
├── template.md        # Template for Claude to fill in (optional)
├── examples/
│   └── sample.md      # Example output showing expected format (optional)
├── reference.md       # Detailed API/reference docs (optional)
└── scripts/
    └── helper.sh      # Script Claude can execute (optional)
```

### Auto-Discovery

- Skills in `.claude/skills/` at the project root are discovered automatically.
- Nested `.claude/skills/` directories (e.g., `packages/frontend/.claude/skills/`) are discovered when Claude works with files in those subtrees.
- Skills from `--add-dir` directories are loaded automatically.

---

## SKILL.md Format

### Structure

Every `SKILL.md` has two parts:

1. **YAML frontmatter** (between `---` markers) — tells Claude when/how to use the skill
2. **Markdown content** — instructions Claude follows when the skill is invoked

### Frontmatter Reference

```yaml
---
name: my-skill                        # Display name & /slash-command (optional; defaults to directory name)
description: What this skill does      # RECOMMENDED — Claude uses this for auto-invocation
argument-hint: "[arg1] [arg2]"         # Hint shown in autocomplete (optional)
disable-model-invocation: true         # Prevent Claude from auto-loading (optional; default: false)
user-invocable: false                  # Hide from / menu (optional; default: true)
allowed-tools: Read, Grep, Bash(git *) # Tools allowed without asking (optional)
model: claude-sonnet-4-20250514                 # Model override (optional)
context: fork                          # Run in forked subagent (optional)
agent: Explore                         # Subagent type when context: fork (optional)
hooks: {}                              # Lifecycle hooks (optional)
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | No | Lowercase letters, numbers, hyphens (max 64 chars). Defaults to directory name. |
| `description` | Recommended | What the skill does and when to use it. Claude uses this for auto-selection. |
| `argument-hint` | No | Displayed during autocomplete. E.g., `[issue-number]` or `[filename] [format]`. |
| `disable-model-invocation` | No | `true` = only user can invoke (for side-effect workflows like deploy). |
| `user-invocable` | No | `false` = hidden from / menu (for background knowledge Claude auto-loads). |
| `allowed-tools` | No | Tools Claude can use without per-use approval when skill is active. |
| `model` | No | Override model for this skill. |
| `context` | No | `fork` = run in isolated subagent context. |
| `agent` | No | Subagent type: `Explore`, `Plan`, `general-purpose`, or custom from `.claude/agents/`. |

### String Substitutions

| Placeholder | Expansion |
|-------------|-----------|
| `$ARGUMENTS` | All arguments passed when invoking |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID |

### Dynamic Context Injection

Use `` !`command` `` syntax to run shell commands before the skill content is sent to Claude:

```markdown
## Current branch
- Branch: !`git branch --show-current`
- Status: !`git status --short`
```

### Ultrathink

Include the word "ultrathink" anywhere in skill content to enable extended thinking.

---

## Types of Skills

### Reference Skills (Knowledge)

Background conventions, patterns, style guides. Run inline alongside conversation context.

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---
```

### Task Skills (Actions)

Step-by-step instructions for specific actions. Often invoked manually with `/skill-name`.

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---
```

### Research Skills (Exploration)

Run in forked subagent for read-only codebase exploration.

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---
```

---

## Invocation Control

| Configuration | User Can Invoke | Claude Can Auto-Invoke | Behavior |
|---------------|----------------|----------------------|----------|
| (default) | Yes | Yes | Description in context; full skill loads on invocation |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; loads only when user invokes |
| `user-invocable: false` | No | Yes | Description in context; loads when Claude decides |

---

## Best Practices

### Content Guidelines

- Keep `SKILL.md` under **500 lines**. Move detailed reference to separate files.
- Reference supporting files from SKILL.md so Claude knows what to load and when.
- Be specific in descriptions — include keywords users would naturally say.
- Use action-oriented language in task skills.

### Architectural Principles (This Project)

1. **Atomic**: Each skill covers one domain or action. No multi-domain monoliths.
2. **Reusable**: Skills should work across similar tasks within their domain.
3. **Domain-specific**: Separate skills by service boundary (frontend, browser-use, supabase, devops).
4. **Composable**: Skills can reference each other's conventions without duplicating content.
5. **Auto-selectable**: Descriptions must be clear enough for Claude to pick the right skill.
6. **Minimal overlap**: No two skills should cover the same ground.
7. **Maintainable**: Delete unused skills. Refactor unclear instructions. Evolve with the project.

### Naming Conventions (This Project)

- Use lowercase kebab-case: `add-api-route`, `browser-use-patterns`
- Prefix domain skills: domain name as natural prefix when helpful
- Action skills: verb-noun format (`add-component`, `debug-container`)
- Reference skills: domain-descriptor format (`frontend-patterns`, `supabase-schema`)

---

## Skill Lifecycle

### Creation
1. Create directory: `.claude/skills/<skill-name>/`
2. Write `SKILL.md` with frontmatter + instructions
3. Add supporting files if needed (templates, examples, scripts)
4. Test: ask Claude something matching the description, or invoke with `/skill-name`

### Maintenance
- Review skills when project structure changes
- Update descriptions when new patterns emerge
- Delete skills that no longer apply
- Keep aligned with CLAUDE.md and project conventions

### Troubleshooting
- **Skill not triggering**: Check description keywords match natural language. Verify with "What skills are available?"
- **Triggers too often**: Make description more specific, or add `disable-model-invocation: true`.
- **Not all skills visible**: Skills share a character budget (2% of context window, ~16K chars fallback). Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var.

---

## Skills vs Other Memory

| Mechanism | Location | Purpose |
|-----------|----------|---------|
| **Skills** | `.claude/skills/` | Actionable instructions with invocation control |
| **CLAUDE.md** | `./CLAUDE.md` or `.claude/CLAUDE.md` | Always-loaded project memory |
| **Rules** | `.claude/rules/*.md` | Modular, path-scoped project rules |
| **Auto Memory** | `~/.claude/projects/<project>/memory/` | Claude's own notes per project |

Skills are the right choice when you need:
- Slash-command invocation (`/skill-name`)
- Claude auto-selection based on task type
- Supporting files (templates, scripts, examples)
- Invocation control (user-only, claude-only)
- Subagent isolation (`context: fork`)

---

## Project Skill Inventory

### Required Domains

| Domain | Skills | Purpose |
|--------|--------|---------|
| **browser-use** | Patterns, endpoint creation | Python FastAPI service conventions |
| **frontend** | Patterns, component creation, API route creation | Next.js/TypeScript conventions |
| **supabase** | Schema patterns, migrations | Database conventions |
| **DevOps** | Container ops, debugging, env config | Docker Compose operations |
| **Workflow** | Task implementation, spec review | Project management |

### Skill Design Matrix

Each skill should specify:
- **Type**: Reference, Task, or Research
- **Invocation**: Auto (default) / User-only (`disable-model-invocation`) / Claude-only (`user-invocable: false`)
- **Context**: Inline (default) / Fork (`context: fork`)
- **Domain**: Which service/area it covers

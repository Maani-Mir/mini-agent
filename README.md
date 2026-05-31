# mini-agent

A mini coding agent CLI that implements the [Agent Skills open standard](https://agentskills.io/).

Powered by Claude Sonnet via the Anthropic API.

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Anthropic API key required**

Go to [console.anthropic.com](https://console.anthropic.com), create an account, generate an API key and incorporate in your codebase through .env.

## Run

```bash
mini-agent
```

## Skills Installed

| Skill | Triggers when… |
|-------|---------------|
| `welcome-me` | User says they're new, wants orientation, asks where to start |
| `changelog` | User asks for a changelog, release notes, or git log summary |
| `documentation` | User wants to document code, write docstrings, or improve a README |

## How it works (Agent Skills spec)

**Progressive disclosure** — 3 tiers:

1. **Discovery** at startup: only the `name` and `description` of each skill is loaded into the system prompt (~50–100 tokens per skill). The agent knows *what* skills exist.
2. **Activation** on demand: when the user's prompt matches a skill's description, the model calls `activate_skill(skill_name)` and the full `SKILL.md` body enters the context.
3. **Execution**: the agent follows the skill's instructions, optionally loading referenced resources.

Skills that don't match the current task are never loaded — keeping context efficient.

## Example prompts to test

```
# Triggers welcome-me (must print "> Welcome to the mini-agent!")
Don't know much about the project, where should i start?

# Triggers changelog
Can you generate a changelog from my recent git commits?

# Triggers documentation
Help me write JSDoc comments for this function:
function add(a, b) { return a + b; }

# Triggers NO skill (general question)
Who do you think will win the premier league. Arsenal or Manchester City? 
```

## Project structure

```
mini-agent/
└── .agents/skills/              # Project-level skills directory
    ├── change-log/
    │   └── SKILL.md
    ├── documentation/
    │   └── SKILL.md
    └── welcome-me/
        └── SKILL.md
├── index.js              # CLI entry point — implements the Agent Skills spec
├── package.json
├── package-lock.json
├── README.md
├── .env                  
├── .gitignore            

```

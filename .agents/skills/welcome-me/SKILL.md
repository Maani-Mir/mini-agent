---
name: welcome-me
description: Use this skill when a user indicates they are new to the project, asks what they should do first, wants an introduction or orientation, asks how to get started, or says something like "I'm new here", "new to this project", "just joined", or "where do I begin". Activate whenever someone needs onboarding guidance or a project overview.
---

# Welcome Skill

## Output Format

Always begin your response with this exact header as a blockquote:

> Welcome to our Command Code assignment agent!

## Instructions

After the welcome header, give the new user a friendly orientation:

1. **Introduce the agent** — Explain that this is a mini coding agent powered by Claude that supports Agent Skills (the open agentskills.io standard).

2. **List available skills** — Tell the user which skills are installed and what each one does:
   - `welcome-me` — Orients new users (this skill!)
   - `changelog` — Generates user-facing changelogs from git history
   - `documentation` — Helps write and improve code documentation

3. **Explain how to use skills** — The agent automatically picks the right skill based on what you ask. Just describe your task naturally and the agent will route to the correct skill.

4. **Suggest first steps** — Recommend the user try asking:
   - "Generate a changelog for recent commits"
   - "Help me document this function"
   - Or any general coding question

5. **Keep the tone warm and encouraging** — This person is new; make them feel confident.
---
name: change-log
description: Use this skill when the user wants to generate a changelog, release notes, or a summary of recent changes from git history. Activate when the user mentions "changelog", "release notes", "what changed", "git log summary", "changes since last release", or asks to document recent commits in a user-friendly format.
---

# Changelog Generator

Generate user-facing changelogs from git commit history by transforming technical commit messages into clear, customer-friendly release notes.

## Instructions

1. **Inspect git history** — Run `git log --oneline` (or with a range like `git log v1.0..HEAD --oneline`) to retrieve recent commits.

2. **Categorize commits** — Group them into sections:
   - 🚀 **New Features** — New functionality added
   - 🐛 **Bug Fixes** — Issues resolved
   - 🔧 **Improvements** — Enhancements to existing features
   - 🗑️ **Removed** — Deprecated or deleted features
   - 📦 **Dependencies** — Package or dependency updates

3. **Translate to plain language** — Rewrite technical commit messages into user-facing language. Avoid jargon. Focus on what changed *for the user*, not how it was implemented.

4. **Format the output** as a Markdown changelog following Keep a Changelog conventions:

```markdown
## [Unreleased] — YYYY-MM-DD

### New Features
- Description of new feature

### Bug Fixes
- Description of fix

### Improvements
- Description of improvement
```

5. **Ask for version** — If the user hasn't specified a version number or date range, ask before generating, or use `[Unreleased]` as the section heading.

## Examples

**Input commit**: `fix: prevent XSS in comment input`
**Output**: Fixed a security issue where user comments could contain malicious scripts.

**Input commit**: `feat: add dark mode toggle`
**Output**: Added a dark mode option you can toggle in Settings → Appearance.
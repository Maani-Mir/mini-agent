#!/usr/bin/env node

/**
 * mini-agent — A CLI coding agent implementing the Agent Skills open standard.
 * https://agentskills.io/
 *
 * Progressive disclosure in 3 tiers:
 *   1. Discovery  — Load name + description for every skill at startup (~50-100 tokens each)
 *   2. Activation — Load full SKILL.md body only when a skill is matched
 *   3. Execution  — Follow instructions; load referenced resources on demand
 */

import 'dotenv/config';
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

// ─── Configuration ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// Scan these directories for skills (project-level first, per spec precedence rules)
// See: https://agentskills.io/client-implementation/adding-skills-support#where-to-scan
const SKILL_SEARCH_PATHS = [
  // Project-level (relative to working directory)
  path.join(__dirname, ".mini-agent", "skills"), // client-specific
  path.join(__dirname, ".agents", "skills"),     // cross-client interop convention
  // User-level (relative to home directory)
  path.join(os.homedir(), ".mini-agent", "skills"), // client-specific
  path.join(os.homedir(), ".agents", "skills"),     // cross-client interop convention
];

// ─── Skill Discovery (Tier 1) ─────────────────────────────────────────────────

/**
 * Parse a SKILL.md file and extract frontmatter + body.
 * Handles the common malformed-YAML edge case of unquoted colons in values.
 *
 * @param {string} filePath  Absolute path to SKILL.md
 * @returns {{ name, description, body, location } | null}
 */
function parseSkillFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  // Split on the closing frontmatter delimiter
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    console.warn(`[skills] Skipping ${filePath}: no valid frontmatter found`);
    return null;
  }

  const [, frontmatterRaw, body] = fmMatch;

  let frontmatter;
  try {
    frontmatter = yaml.load(frontmatterRaw);
  } catch {
    // Fallback: wrap bare values containing colons (common cross-client issue)
    const fixed = frontmatterRaw.replace(
      /^(description|compatibility):\s*(.+)$/gm,
      (_, key, val) => `${key}: "${val.replace(/"/g, '\\"')}"`
    );
    try {
      frontmatter = yaml.load(fixed);
    } catch {
      console.warn(`[skills] Skipping ${filePath}: YAML could not be parsed`);
      return null;
    }
  }

  if (!frontmatter?.description) {
    console.warn(`[skills] Skipping ${filePath}: missing required 'description' field`);
    return null;
  }

  // Per spec: name should match the parent directory name; warn but load anyway
  const dirName = path.basename(path.dirname(filePath));
  if (frontmatter.name && frontmatter.name !== dirName) {
    console.warn(
      `[skills] Warning: skill name "${frontmatter.name}" does not match directory "${dirName}"`
    );
  }

  const name = frontmatter.name || dirName;

  return {
    name,
    description: frontmatter.description,
    body: body.trim(),
    location: filePath,
  };
}

/**
 * Scan skill search paths and return a map of { name -> skill }.
 * Project-level skills take precedence over user-level ones (spec §Handling name collisions).
 *
 * @returns {Map<string, { name, description, body, location }>}
 */
function discoverSkills() {
  const skills = new Map(); // name -> skill record

  for (const searchPath of SKILL_SEARCH_PATHS) {
    if (!fs.existsSync(searchPath)) continue;

    let entries;
    try {
      entries = fs.readdirSync(searchPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(searchPath, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;

      const skill = parseSkillFile(skillMdPath);
      if (!skill) continue;

      if (skills.has(skill.name)) {
        // Earlier paths (project-level) win — log the shadow
        console.warn(`[skills] "${skill.name}" shadowed by earlier definition; skipping ${skillMdPath}`);
      } else {
        skills.set(skill.name, skill);
      }
    }
  }

  return skills;
}

// ─── Skill Catalog (Tier 1 → model context) ──────────────────────────────────

/**
 * Build the XML skill catalog injected into the system prompt.
 * Only name + description are included — no body. This is tier 1 of progressive disclosure.
 *
 * @param {Map} skills
 * @returns {string}
 */
function buildSkillCatalog(skills) {
  if (skills.size === 0) return "";

  const entries = [...skills.values()]
    .map(
      (s) =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.location}</location>\n  </skill>`
    )
    .join("\n");

  return `<available_skills>\n${entries}\n</available_skills>`;
}

/**
 * Build the system prompt: instructions + skill catalog.
 *
 * @param {Map} skills
 * @returns {string}
 */
function buildSystemPrompt(skills) {
  const catalog = buildSkillCatalog(skills);

  const skillInstructions =
    catalog.length > 0
      ? `
You have access to a set of Agent Skills (https://agentskills.io/). Skills provide specialized instructions for specific tasks.

When a user's request matches a skill's description, call the \`activate_skill\` tool with that skill's name BEFORE responding. The tool will return the full skill instructions; follow them carefully.

Only activate a skill when the task genuinely matches its description. Do NOT activate a skill for unrelated requests.

${catalog}
`
      : "";

  return `You are a helpful coding assistant CLI agent.${skillInstructions}
Answer questions clearly and helpfully. For coding tasks, provide working, well-explained code.`;
}

// ─── Skill Activation Tool (Tier 2) ──────────────────────────────────────────

/**
 * The tool definition passed to the Anthropic API.
 * The model calls this to activate a skill and receive its full instructions.
 *
 * @param {Map} skills
 * @returns {object}  Anthropic tool schema
 */
function buildActivateSkillTool(skills) {
  const validNames = [...skills.keys()];
  return {
    name: "activate_skill",
    description:
      "Load the full instructions for a skill. Call this when the user's request matches a skill's description.",
    input_schema: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          enum: validNames,
          description: "The name of the skill to activate.",
        },
      },
      required: ["skill_name"],
    },
  };
}

/**
 * Handle the activate_skill tool call — return skill body wrapped in structured tags.
 * This is tier 2: full SKILL.md body enters the context only now.
 *
 * @param {string} skillName
 * @param {Map} skills
 * @returns {string}  Tool result content
 */
function handleActivateSkill(skillName, skills) {
  const skill = skills.get(skillName);
  if (!skill) {
    return `Error: skill "${skillName}" not found.`;
  }

  const skillDir = path.dirname(skill.location);

  // List bundled resources (spec §Listing bundled resources) but don't eagerly load them
  const resourceFiles = [];
  for (const subdir of ["scripts", "references", "assets"]) {
    const subdirPath = path.join(skillDir, subdir);
    if (fs.existsSync(subdirPath)) {
      const files = fs.readdirSync(subdirPath).map((f) => `${subdir}/${f}`);
      resourceFiles.push(...files);
    }
  }

  const resourcesSection =
    resourceFiles.length > 0
      ? `\n<skill_resources>\n${resourceFiles.map((f) => `  <file>${f}</file>`).join("\n")}\n</skill_resources>`
      : "";

  // Structured wrapping per spec §Structured wrapping
  return (
    `<skill_content name="${skill.name}">\n` +
    skill.body +
    `\n\nSkill directory: ${skillDir}\nRelative paths in this skill are relative to the skill directory.` +
    resourcesSection +
    `\n</skill_content>`
  );
}

// ─── Anthropic API ─────────────────────────────────────────────────────────────

/**
 * Call the Anthropic messages API, handling multi-turn tool use automatically.
 * The agentic loop runs until the model returns a final text response with no
 * pending tool calls.
 *
 * @param {string} systemPrompt
 * @param {object[]} messages   Conversation history
 * @param {object[]} tools      Tool definitions
 * @param {Map} skills          Skills map (for tool execution)
 * @returns {string}            Final text response
 */
async function callClaude(systemPrompt, messages, tools, skills) {
  const activatedSkills = new Set(); // track to deduplicate (spec §Deduplicate activations)

  while (true) {
    const body = {
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      ...(tools.length > 0 && { tools }),
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();

    if (data.stop_reason === "tool_use") {
      // Collect all tool calls in this turn
      const toolUseBlocks = data.content.filter((b) => b.type === "tool_use");
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        if (toolUse.name === "activate_skill") {
          const skillName = toolUse.input.skill_name;

          let resultContent;
          if (activatedSkills.has(skillName)) {
            // Deduplication: skill already in context this session
            resultContent = `Skill "${skillName}" is already active in this conversation.`;
          } else {
            resultContent = handleActivateSkill(skillName, skills);
            activatedSkills.add(skillName);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: resultContent,
          });
        }
      }

      // Append assistant message + tool results to history, then loop
      messages = [
        ...messages,
        { role: "assistant", content: data.content },
        { role: "user", content: toolResults },
      ];
      continue;
    }

    // stop_reason === "end_turn" — extract the final text
    const textBlock = data.content.find((b) => b.type === "text");
    return textBlock?.text ?? "(no response)";
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Set it with: export ANTHROPIC_API_KEY=your-key-here");
    process.exit(1);
  }

  // ── Tier 1: Discover all skills at startup ──
  const skills = discoverSkills();

  if (skills.size === 0) {
    console.warn("[skills] No skills found. Running without skill support.\n");
  } else {
    const names = [...skills.keys()].join(", ");
    console.log(`[skills] Loaded ${skills.size} skill(s): ${names}\n`);
  }

  const systemPrompt = buildSystemPrompt(skills);
  const tools = skills.size > 0 ? [buildActivateSkillTool(skills)] : [];

  // Conversation history — persists across turns in this session
  let conversationHistory = [];

  console.log("mini-agent — type your prompt and press Enter (Ctrl+C to exit)\n");
  console.log("─".repeat(60));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question("\nYou: ", async (userInput) => {
      userInput = userInput.trim();
      if (!userInput) {
        prompt();
        return;
      }

      // Append user message to history
      conversationHistory = [
        ...conversationHistory,
        { role: "user", content: userInput },
      ];

      try {
        process.stdout.write("\nAssistant: ");
        const reply = await callClaude(
          systemPrompt,
          conversationHistory,
          tools,
          skills
        );

        console.log(reply);
        console.log("─".repeat(60));

        // Append assistant reply to history for next turn
        conversationHistory = [
          ...conversationHistory,
          { role: "assistant", content: reply },
        ];
      } catch (err) {
        console.error(`\n[error] ${err.message}`);
      }

      prompt();
    });
  };

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });

  prompt();
}

main();
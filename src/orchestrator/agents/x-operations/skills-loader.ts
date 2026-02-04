/**
 * X運用スキルローダー
 *
 * .claude/skills/ からX運用に関連するスキルを読み込む
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
}

const X_OPERATIONS_SKILLS = [
  "x-post-structure",
  "x-post-compose",
  "x-algorithm-evaluate",
  "x-post-refine",
  "news-content-fetch",
];
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../../..");

/**
 * スキルファイルを読み込む
 */
async function loadSkillFile(skillDir: string): Promise<string | null> {
  const skillPath = join(skillDir, "SKILL.md");
  try {
    return await readFile(skillPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * スキル定義をパース
 */
function parseSkillContent(
  name: string,
  content: string,
): SkillDefinition | null {
  // frontmatterからdescriptionを抽出
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let description = `Skill: ${name}`;

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  return {
    name,
    description,
    content,
  };
}

/**
 * X運用に必要なスキルを全て読み込む
 */
export async function loadXOperationsSkills(
  projectRoot: string = PROJECT_ROOT,
): Promise<SkillDefinition[]> {
  const skillsDir = join(projectRoot, ".claude", "skills");
  const skills: SkillDefinition[] = [];

  for (const skillName of X_OPERATIONS_SKILLS) {
    const skillDir = join(skillsDir, skillName);
    const content = await loadSkillFile(skillDir);

    if (content) {
      const skill = parseSkillContent(skillName, content);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * 利用可能な全スキルをリスト
 */
export async function listAvailableSkills(
  projectRoot: string = PROJECT_ROOT,
): Promise<string[]> {
  const skillsDir = join(projectRoot, ".claude", "skills");

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * スキルをツール形式に変換
 */
export function skillToToolDescription(skill: SkillDefinition): string {
  return `## ${skill.name}

${skill.description}

${skill.content}`;
}

/**
 * 全スキルを結合したシステムプロンプト用テキスト
 */
export function buildSkillsPrompt(skills: SkillDefinition[]): string {
  if (skills.length === 0) {
    return "";
  }

  const skillTexts = skills.map(skillToToolDescription);
  return `# Available Skills

${skillTexts.join("\n\n---\n\n")}`;
}

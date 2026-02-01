/**
 * リサーチスキルローダー
 *
 * .claude/skills/ からリサーチ関連スキルを読み込む
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
}

const RESEARCH_SKILLS = ["research-report"];

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
 * リサーチに必要なスキルを全て読み込む
 */
export async function loadResearchSkills(
  projectRoot: string = process.cwd(),
): Promise<SkillDefinition[]> {
  const skillsDir = join(projectRoot, ".claude", "skills");
  const skills: SkillDefinition[] = [];

  for (const skillName of RESEARCH_SKILLS) {
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

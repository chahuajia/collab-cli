// scripts/split-collab.mjs
// 用法：node scripts/split-collab.mjs <bundle.md> <output-dir>
// node scripts/split-collab.mjs COLLABORATION-v4.1-bundle.md COLLABORATION/
import fs from "node:fs";
import path from "node:path";

const [, , bundlePath, outDir] = process.argv;
if (!bundlePath || !outDir) {
  console.error("Usage: node split-collab.mjs <bundle.md> <output-dir>");
  process.exit(1);
}

const content = fs.readFileSync(bundlePath, "utf8");

// 用 `**未来文件路径**：\`path\`` 作为分割标记
const sections = content.split(/\*\*未来文件路径\*\*：`([^`]+)`/g);
// sections[0] = 前言, sections[1] = path1, sections[2] = content1, ...

for (let i = 1; i < sections.length; i += 2) {
  const relPath = sections[i];
  let body = sections[i + 1];

  // 截取下一个 section 之前的内容（到下一个 `---` 分隔）
  const endIdx = body.indexOf("\n---\n");
  if (endIdx !== -1) body = body.slice(0, endIdx);

  // 去掉首尾空行，只保留代码块内的内容
  const codeMatch = body.match(/```markdown\n([\s\S]*?)```/);
  const finalContent = codeMatch ? codeMatch[1] : body.trim();

  const fullPath = path.join(outDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, finalContent, "utf8");
  console.log(`✓ ${relPath}`);
}

console.log("\nDone.");

// 从会话日志提取文件的恢复工具
import fs from 'fs';

const TRANSCRIPT = 'C:/Users/lenovo/.claude/projects/D--actto-front-mock-test-collaboration/8484d728-9132-455b-bf05-950dd3ec2e38.jsonl';

const raw = fs.readFileSync(TRANSCRIPT, 'utf8');
const lines = raw.split('\n').filter(Boolean);
console.log(`transcript lines: ${lines.length}`);

const writes = [];
for (const line of lines) {
  let d;
  try { d = JSON.parse(line); } catch { continue; }
  const content = d?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === 'tool_use' && block.name === 'Write') {
      const p = block.input?.file_path ?? '';
      if (/collab-audit/.test(p)) {
        writes.push({ path: p, content: block.input.content, len: (block.input.content ?? '').length });
      }
    }
  }
}

console.log(`Write calls for collab-audit: ${writes.length}`);
for (const w of writes) {
  console.log(`  ${w.path}  (${w.len} chars)`);
}

// Restore
const outDir = 'D:/actto/front/mock/test-collaboration/.landing';
fs.mkdirSync(outDir, { recursive: true });
for (const w of writes) {
  const base = w.path.split(/[\\/]/).pop();
  const dest = `${outDir}/${base}`;
  fs.writeFileSync(dest, w.content, 'utf8');
  console.log(`  restored -> ${dest}`);
}

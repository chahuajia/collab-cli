// 追踪文件生命周期
import fs from 'fs';
const T = 'C:/Users/lenovo/.claude/projects/D--actto-front-mock-test-collaboration/8484d728-9132-455b-bf05-950dd3ec2e38.jsonl';
const lines = fs.readFileSync(T, 'utf8').split('\n').filter(Boolean);
let i = 0;
for (const line of lines) {
  let d; try { d = JSON.parse(line); } catch { continue; }
  const c = d?.message?.content;
  if (!Array.isArray(c)) continue;
  for (const b of c) {
    if (b?.type !== 'tool_use') continue;
    i++;
    const s = JSON.stringify(b.input ?? {});
    if (/rm -f/.test(s) || /landing/.test(s) || /collab-audit/.test(s)) {
      const cmd = b.input?.command ?? b.input?.file_path ?? '';
      console.log(`[${i}] ${b.name}: ${String(cmd).slice(0, 220)}`);
    }
  }
}

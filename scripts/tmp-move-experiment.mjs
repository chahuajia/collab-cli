// 一次性：把实验记录移出被试项目（F1 —— 判据表不得住在被试读得到的地方）
import fs from "node:fs";
import path from "node:path";

const REPO = "D:/actto/front/project/evolutionary_start/evolutionary";
const SRC = path.join(REPO, "specs");
const DST = "D:/actto/front/project/evolutionary_start/_experiment";

if (!fs.existsSync(SRC)) {
  console.log("specs/ 不存在，无需移动");
  process.exit(0);
}

fs.mkdirSync(DST, { recursive: true });

const moved = [];
for (const name of fs.readdirSync(SRC)) {
  fs.renameSync(path.join(SRC, name), path.join(DST, name));
  moved.push(name);
}
fs.rmdirSync(SRC);

console.log(`moved ${moved.length} file(s) → ${DST}`);
for (const m of moved) console.log("  " + m);

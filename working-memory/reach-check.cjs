// 一次性分析脚本：核对 mark-and-sweep 的两种读法各扫出多少条。
// 结论写进 meta/pruning-policy.md；本脚本留作证据（可重跑）。
const B = "D:/actto/front/project/collab-cli/collab-cli/dist";
const { FileWorkspaceLoader } = require(B + "/infrastructure/fs/FileWorkspaceLoader.js");
const { extractLinks, lastSegmentOf } = require(B + "/domain/validation/rules/_shared.js");
const { fileNameOf } = require(B + "/domain/validation/resolvesRef.js");

const KB = "D:/actto/front/project/collaboration_aggregate/collaboration";
const ws = new FileWorkspaceLoader(KB).load();
const entries = ws.entries.filter((l) => l.entry);

const nodes = new Map();
for (const l of entries) {
  nodes.set(l.entry.frontmatter.id, {
    id: l.entry.frontmatter.id,
    fileName: fileNameOf(l.path),
    body: l.entry.body,
  });
}

function findNode(ref) {
  const last = lastSegmentOf(ref);
  for (const n of nodes.values()) if (last === n.id || last === n.fileName) return n.id;
  return null;
}

const adj = new Map();
function addEdge(a, b) {
  if (!adj.has(a)) adj.set(a, new Set());
  if (!adj.has(b)) adj.set(b, new Set());
  adj.get(a).add(b);
  adj.get(b).add(a);
}

for (const n of nodes.values())
  for (const ref of extractLinks(n.body)) {
    const t = findNode(ref);
    if (t && t !== n.id) addEdge(n.id, t);
  }

const rootIds = [...ws.rootDocs.keys()];
for (const [rel, c] of ws.rootDocs)
  for (const ref of extractLinks(c)) {
    const t = findNode(ref);
    if (t) addEdge(rel, t);
  }

function bfs(seeds, extraEdges) {
  const g = new Map(adj);
  if (extraEdges) for (const [a, b] of extraEdges) {
    if (!g.has(a)) g.set(a, new Set());
    g.get(a).add(b);
  }
  const seen = new Set(seeds);
  const q = [...seeds];
  while (q.length) {
    const c = q.shift();
    for (const nb of g.get(c) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  return seen;
}

const allIds = [...nodes.keys()];

console.log("条目总数:", allIds.length);
console.log("");

// 读法 A：字面 —— _index.md 也是种子
const idxNodes = [...ws.indexFiles.keys()].map((d) => d + "/_index.md");
const idxEdges = [];
for (const [dir, content] of ws.indexFiles) {
  for (const ref of extractLinks(content)) {
    const t = findNode(ref);
    if (t) idxEdges.push([dir + "/_index.md", t]);
  }
}
const rA = bfs([...rootIds, ...idxNodes], idxEdges);
console.log("=== 读法 A：种子含 _index.md（pruning-policy 字面读法）===");
console.log("  不可达:", allIds.filter((i) => !rA.has(i)).length, "→", allIds.filter((i) => !rA.has(i)).join(", ") || "(空)");

// 读法 B：指数不进图，种子只有根文档，边无向
const rB = bfs(rootIds);
const unB = allIds.filter((i) => !rB.has(i));
console.log("");
console.log("=== 读法 B：种子=根文档，索引不进图，无向 ===");
console.log("  不可达:", unB.length, "→", unB.join(", "));

// 读法 C：同上但有向
const out = new Map();
for (const n of nodes.values()) out.set(n.id, new Set());
function addDir(a, b) {
  if (!out.has(a)) out.set(a, new Set());
  out.get(a).add(b);
}
for (const n of nodes.values())
  for (const ref of extractLinks(n.body)) {
    const t = findNode(ref);
    if (t && t !== n.id) addDir(n.id, t);
  }
for (const [rel, c] of ws.rootDocs)
  for (const ref of extractLinks(c)) {
    const t = findNode(ref);
    if (t) addDir(rel, t);
  }
const rC = bfs(rootIds, []);
// 有向 BFS 需单独实现
const seenC = new Set(rootIds);
const qC = [...rootIds];
while (qC.length) {
  const c = qC.shift();
  for (const nb of out.get(c) || []) if (!seenC.has(nb)) { seenC.add(nb); qC.push(nb); }
}
const unC = allIds.filter((i) => !seenC.has(i));
console.log("");
console.log("=== 读法 C：种子=根文档，有向 ===");
console.log("  不可达:", unC.length, "→", unC.join(", "));

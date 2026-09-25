# 两个 CI 从来没跑起来（红着）—— 2026-09-26 发现并修

**性质**：本仓 + KB 仓的基础设施缺陷。**不是"CI 绿不绿"的问题，是"CI 根本不在"的问题。**

## 一、证据（不是推理，是 API 读出来的）

```bash
curl -s "https://api.github.com/repos/chahuajia/collaboration/actions/runs?per_page=5"
curl -s "https://api.github.com/repos/chahuajia/collab-cli/actions/runs?per_page=5"
curl -s "https://api.github.com/repos/<owner>/<repo>/actions/runs/<id>/jobs"
```

2026-09-25 两个仓各 5 次运行，**全部 `conclusion = failure`**。
失败的**不是** validate / test，而是第 3 步：

| 仓 | 失败步骤 | 之后的步骤 |
| :--- | :--- | :--- |
| `collaboration` | `actions/setup-node@v4` | Install / Build / validate 全部 `skipped` |
| `collab-cli` | `actions/setup-node@v4` | `npm ci` / `npm run check` / `test:ci` 全部 `skipped` |

## 二、根因（一句话）

**两个 workflow 都写 `cache: npm` + `npm ci`，而两个仓都只有 `pnpm-lock.yaml`。**
`actions/setup-node` 的 `cache: npm` 找不到 `package-lock.json` → 当场失败。

为什么一直没人发现：**本地 `npm run check` 是绿的**。
"本地绿" 和 "CI 绿" 是两条独立的线 —— 这条教训和 KB 里那条
"证据必须在仓里、在 CI 里，不能是'我试过'"是同一形状，只是这次踩在自己的门禁上。

## 三、修了什么

| 改动 | 文件 |
| :--- | :--- |
| 两个 workflow 改走 pnpm（`pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`） | `.github/workflows/ci.yml`、KB 的 `.github/workflows/validate.yml` |
| CI 里 checkout KB 并设 `COLLAB_REAL_KB` → 三条"要真库才跑"的测试**从静默 skip 变成真跑** | 两份 workflow + `.vitest-skip-allowlist.json` 的说明 |
| KB CI 里新增一步：跑 collab-cli 的 `kb-command-docs` / `kb-templates`（**"KB 文档错就红 CI"** 终于接上线） | KB 的 `validate.yml` |
| **锁文件本身也是陈旧的**：`prettier` 早已从 `package.json` 删掉、锁文件里还留着三处引用 → `pnpm install --frozen-lockfile` 在本地直接失败。外科式删掉那 10 行 | `pnpm-lock.yaml` |

## 四、没做什么（**故意**，别当成已经做了）

1. **没用 `package.json` 的 `packageManager` 字段**做 pnpm 版本的单一真相源。
   实测：本机 pnpm 12 一加那个字段，就把 `pnpm-lock.yaml` 改写成**双 YAML 文档**
   （多出一段 `packageManagerDependencies` + `@pnpm/exe` 平台包）。
   那是本机这个 pnpm 构建的行为，**上游是否接受没验过** —— 不拿没验过的产物去赌 CI。
   代价：pnpm 的 major 在两条 workflow 里各写一次（已互相注明"改要同步"）。
2. **真正的绿灯还没看到**。本地跑不了 GitHub Actions；本次只做到
   "本地按 CI 的命令逐条跑通"（`pnpm install --frozen-lockfile` → `pnpm run check` →
   `pnpm run test:ci` → `kb-*.test.ts`）。**下一次 push 之后才是证据。**
3. 没动 `evolutionary` 仓的 CI（它有没有 workflow、是否同病，**这次没查**）。

## 五、下次可以顺手做的一件事

给 `evolutionary` 也查一遍：`actions/runs` 的最近 5 次是什么结论。
同一个"本地绿、CI 红"的形状，很可能在那也成立 —— 而它的证据（wave 报告）比这里更依赖 CI。

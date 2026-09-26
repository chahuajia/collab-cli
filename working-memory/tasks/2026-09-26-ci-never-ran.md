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

## 六、第二阶段：CI 真的跑起来之后，它**立刻**抓到一个本地抓不到的缺陷

（2026-09-26 晚补）修完 pnpm 之后，`collab-cli` 最近一次 run **#38**（sha `cce5199`）
的逐步结论是：

```
Set up job ✅ · checkout ×2 ✅ · pnpm/action-setup ✅ · setup-node ✅
pnpm install --frozen-lockfile ✅        ← 锁文件那处修好了
pnpm run check ❌                        ← 卡在这里
pnpm run test:ci  ⏭ skipped
```

**失败原文（不用登录就能拿到）**——两把扳手：

```bash
curl -s "https://api.github.com/repos/<owner>/<repo>/commits/<sha>/check-runs"
curl -s "https://api.github.com/repos/<owner>/<repo>/check-runs/<id>/annotations"
```

```
[failure] src/cli/commands/__tests__/testHelpers.ts:79
Error: Expected CLI to fail, but it succeeded
STDOUT: ⚠ 仓 "evolutionary" 在本机不可达 —— 跳过存在性检查（validate 仍会查形态）。
❯ src/cli/commands/__tests__/retire.test.ts:178
```

**根因**：那条测试**编码了"业务仓在本机可达"这个机器假设**（`patterns/tests-encode-assumptions`）。
本地那份路径真实存在 → 走"目标不存在 → 硬失败"；runner 上没有那个仓 →
走"无法判定 → 警告放行"（exit 0）→ 断言"应当失败"落空。

**本机复现（不用等 CI，10 秒）**：

```bash
# 把"本机有那三个仓"这件事拿掉 —— CI 就是这个环境
COLLAB_PROJECTS_DIR=/nonexistent EVOLUTIONARY_DIR= COLLAB_KB_DIR= COLLAB_CLI_DIR= \
  pnpm exec vitest run src/cli/commands/__tests__/retire.test.ts
# → 红，且报错与 CI **逐字一致**
```

**修法**（都进了代码）：

1. `src/cli/commands/__tests__/testHelpers.ts` 的 `envOverrides` **钉死仓位置**
   （`COLLAB_PROJECTS_DIR` → 临时目录下不存在的路径；三个逐仓变量显式置空）——
   从此**任何** CLI 测试都不许继承开发机的仓。
2. 那条用例**自造**"可达、但没有那个文件"的临时仓 → 硬失败分支在任何机器上都成立。
3. 新增一条用例钉住另一条分支："仓不可达 → **警告后放行**（刻意，不是漏了）"。

**结论（这一节最值钱的一句）**：
**"CI 绿"不是"CI 在真执行"的证据；"CI 抓到了本地抓不到的东西"才是。**

## 七、以后怎么确认 CI 真的在执行（四层，按成本排）

| 层 | 查什么 | 命令 / 接口 |
| :--- | :--- | :--- |
| 0 | **该不该触发**：`on.push.branches` 里有没有你推的分支；事件是 `push` 还是 `pull_request` | 看 workflow 文件 + 你实际推的分支 |
| 1 | **有没有 run，而且是不是你那次**：`head_sha` 必须与你推的 commit 对得上 | `GET /repos/{o}/{r}/actions/runs?per_page=5`（`gh run list -R {o}/{r}`） |
| 2 | **逐步结论**：任何一个 `skipped` 都要问为什么 —— 我们上次的故障就是 `setup-node` 失败 → 后面**全 skipped**，**看起来像跑了** | `GET /actions/runs/{id}/jobs`（`gh run view {id}`） |
| 3 | **日志里有"只有真跑才可能出现"的东西**：KB 那条必须打印 `✔ COLLABORATION validated: 129 entries, 0 issues`；本仓那条必须打印 `N 通过 · **0 跳过**（3 条已在允许清单中声明）` —— **"0 跳过"是接线成功的指纹**（从前这里是 3 条静默跳过） | run 日志 |

红的时候：用第六节的 `check-runs` / `annotations` 两把扳手（**免登录**）。
想更硬：加 job summary / artifact（runner 的 `GITHUB_RUN_ID` 本地伪造不出来）；
再狠一点：把这条 check 设成 **required**（不绿不能合）—— 那是把"CI 绿"从提示变成门禁。

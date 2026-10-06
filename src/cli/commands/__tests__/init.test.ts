// collab init —— 验收测试（W8：先写测试，红；再写实现，绿）
//
// 规格：working-memory/tasks/collab-init/spec.md
// 约定：E2E —— 跑 dist/cli/index.js，每个用例一个临时工作区。
//
// 注意：本文件写于**实现之前**，初始状态全部失败（`Unknown command: init`）。
// 这正是红的状态；实现落地后应转绿，且不得修改断言去迁就实现。
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractLinks } from '@/domain/validation/rules/_shared';
import { COLLAB_NPM_RANGE } from '@/infrastructure/version';
import { CLI_ENTRY } from './testHelpers.js';

let root: string;
let envOverrides: Record<string, string>;

/** 规格里的生成清单（profile=kb）。 */
const EXPECTED = [
  'AGENTS.md',
  'README.md',
  'meta/interceptions.md',
  'meta/known-gaps.md',
  'meta/pruning-policy.md',
  // 六个 kind 目录的空索引 —— 空目录进不了 git，没有它们 clone 后工作区识别不到
  'agreements/_index.md',
  'workflows/_index.md',
  'skills/_index.md',
  'patterns/_index.md',
  'meta/decision-records/_index.md',
  'integrations/_index.md',
];

async function runCli(args: string[]) {
  return execa('node', [CLI_ENTRY, ...args], {
    cwd: root,
    reject: false,
    env: { ...process.env, ...envOverrides },
  });
}

/**
 * 把临时根变成 git 仓库。
 *
 * @remarks
 * 工作区**自动识别**是"向上找到 `.git`，再看布局"，所以不 git init 就测不到它 ——
 * 只有显式 `--dir` 才不需要 git。这两条测试关心的正是"不带 `--dir` 也能用"。
 */
async function initGitRepo(): Promise<void> {
  const env = { ...process.env, ...envOverrides };
  await execa('git', ['init', '-q'], { cwd: root, env });
  // `collab new` 的 author 取自 git 身份（见 decisions：author 的语义是"人"）
  await execa('git', ['config', '--local', 'user.name', 'Test'], { cwd: root, env });
  await execa('git', ['config', '--local', 'user.email', 'test@example.com'], {
    cwd: root,
    env,
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'collab-init-'));
  const emptyGitConfig = path.join(root, '.empty-gitconfig');
  await writeFile(emptyGitConfig, '');
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
    // 开发机在**用户级**设了 `COLLAB_DIR=<共享库>`，而它优先于"向上找 `.git`" ——
    // 不钉死的话，本文件里"不带 --dir 也能用"那几条会在**真库**上跑（详见 testHelpers）。
    COLLAB_DIR: '',
  };
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('collab init — profile=kb', () => {
  it('I1 空目录：生成清单里的文件，且随后 validate 为 0 issues', async () => {
    await initGitRepo();
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(r.exitCode, r.stderr).toBe(0);
    for (const f of EXPECTED) {
      expect(existsSync(path.join(root, f)), `${f} 未生成`).toBe(true);
    }
    // 不带 --dir：骨架必须能被**自动识别**（这正是 2026-09-26 修的那个 bug）
    const v = await runCli(['validate']);
    expect(v.exitCode, v.stdout + v.stderr).toBe(0);
  });

  it('I1b 骨架立刻可用：不指定 --dir 也能落第一条条目', async () => {
    await initGitRepo();
    await runCli(['init', '--profile', 'kb', '--dir', '.']);

    // 修 bug 之前这里五条命令全部报 "no COLLABORATION workspace found"
    const created = await runCli(['new', 'pattern', 'first']);
    expect(created.exitCode, created.stdout + created.stderr).toBe(0);
    expect(existsSync(path.join(root, 'patterns/first.md'))).toBe(true);

    expect((await runCli(['catalog'])).exitCode).toBe(0);
    expect((await runCli(['index'])).exitCode).toBe(0);

    const v = await runCli(['validate']);
    expect(v.exitCode, v.stdout + v.stderr).toBe(0);
    expect(v.stdout).toContain('1 entries');
  });

  it('I2 幂等：第二次全部 skip，两次之后内容逐字节不变', async () => {
    await runCli(['init', '--profile', 'kb', '--dir', '.']);
    const before = new Map<string, string>();
    for (const f of EXPECTED) {
      before.set(f, await readFile(path.join(root, f), 'utf8'));
    }

    const second = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(second.exitCode, second.stderr).toBe(0);

    for (const f of EXPECTED) {
      expect(await readFile(path.join(root, f), 'utf8'), `${f} 被改写`).toBe(
        before.get(f),
      );
    }
  });

  it('I3 只增不改：已存在的用户自写 AGENTS.md 不被覆盖', async () => {
    const mine = '# 我的入口\n\n用户自己写的，不许被动。\n';
    await writeFile(path.join(root, 'AGENTS.md'), mine, 'utf8');

    const r = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(await readFile(path.join(root, 'AGENTS.md'), 'utf8')).toBe(mine);
  });

  it('I4 --dry-run：打印计划，但不产生任何生成物', async () => {
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.', '--dry-run']);
    expect(r.exitCode, r.stderr).toBe(0);
    for (const f of EXPECTED) {
      expect(existsSync(path.join(root, f)), `${f} 在 dry-run 下被写入`).toBe(
        false,
      );
    }
  });

  it('I5 编码：生成物为 UTF-8 无 BOM、LF 行尾', async () => {
    await runCli(['init', '--profile', 'kb', '--dir', '.']);
    for (const f of EXPECTED) {
      const buf = await readFile(path.join(root, f));
      expect(buf[0], `${f} 带 BOM`).not.toBe(0xef);
      expect(buf.includes(Buffer.from('\r\n')), `${f} 含 CRLF`).toBe(false);
    }
  });

  it('I8 --with-hook 且无 .husky：不生成 hook，但 exit 0 并说明原因', async () => {
    const r = await runCli(['init', '--profile', 'consumer', '--kb', 'D:/fake-kb', '--dir', '.', '--with-hook']);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(path.join(root, '.husky', 'pre-push'))).toBe(false);
    expect(r.stdout + r.stderr).toMatch(/husky/i);
  });

  it('I9 未知 profile：报错退出，且不写任何文件', async () => {
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.', '--profile', 'full']);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/profile/i);
    for (const f of EXPECTED) {
      expect(existsSync(path.join(root, f))).toBe(false);
    }
  });

  it('I11 目标目录不存在：创建目录树并成功', async () => {
    const nested = path.join(root, 'nested', 'kb');
    const r = await runCli(['init', '--profile', 'kb', '--dir', nested]);
    expect(r.exitCode, r.stderr).toBe(0);
    expect((await stat(nested)).isDirectory()).toBe(true);
    expect(existsSync(path.join(nested, 'AGENTS.md'))).toBe(true);
  });

  it('I12 生成的 AGENTS.md 不含指向未落盘条目的**链接**', async () => {
    await runCli(['init', '--profile', 'kb', '--dir', '.']);
    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');

    // 判据用**项目自己的链接提取器**，不是裸正则 —— base-contract 第五条第 3 项：
    // 「围栏与行内代码里的双括号**不算链接**」。骨架里可以有 `` `[[id]]` `` 这种**示例**
    // （它在教怎么写关联），但不能有**真链接** —— 一个刚 init 的库里一条条目都没有。
    const links = extractLinks(agents).filter((s) => s.trim() !== '');
    expect(links, `kb 骨架不应制造死链：${links.join(', ')}`).toEqual([]);
  });

  it('I12b kb profile 不承诺它不生成的 wrapper 脚本', async () => {
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(r.exitCode, r.stderr).toBe(0);

    // 生成物里不能让人去**跑**一个不存在的文件（可以提到它不存在这件事本身）
    const readme = await readFile(path.join(root, 'README.md'), 'utf8');
    expect(readme).not.toContain('node scripts/collab-validate.mjs');
    expect(readme).toContain('npx --yes @chahuajia/collab-cli');

    // 输出里的"下一步"同理：只指真实存在的动作
    expect(r.stdout).not.toContain('node scripts/collab-validate.mjs');
    expect(r.stdout).toMatch(/npx --yes/);
  });

  // 回归：安装范围曾在四处**手写** `@^0.5`，升到 0.6.0 时会把用户钉回旧线且不报错。
  it('I12c 生成物里的安装范围跟着 package.json 走，不手写', async () => {
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(r.exitCode, r.stderr).toBe(0);

    const readme = await readFile(path.join(root, 'README.md'), 'utf8');
    expect(readme).toContain(`@chahuajia/collab-cli@${COLLAB_NPM_RANGE} validate`);
    expect(r.stdout).toContain(`@chahuajia/collab-cli@${COLLAB_NPM_RANGE}`);
  });

  // 同 I13c：kb profile 的入口也必须**点名工具**（2026-10-06 事故：入口只写"读什么"，没写"有工具"）
  it('I12d kb 的 AGENTS.md 必须点名工具，并写清"选项的权威是 --help"', async () => {
    await runCli(['init', '--profile', 'kb', '--dir', '.']);
    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('@chahuajia/collab-cli');
    expect(agents).toContain('--help');
    expect(agents, '必备的确认门不能漏（照抄会报错）').toContain('--confirm');
    // 协议五条（2026-10-06 实测事故：入口只写"读什么"，agent 整段会话 0 次用工具）
    expect(agents).toContain('接在哪');
    expect(agents).toContain('红灯协议');
    expect(agents, '两本账本都要点名（收益侧 / 缺口侧）').toContain('interceptions');
  });
});


describe('collab init — profile=consumer（默认）', () => {
  it('I13 默认 consumer + --kb：生成项目侧 4 件，且不建知识库', async () => {
    const r = await runCli(['init', '--dir', '.', '--kb', 'D:/fake-kb']);
    expect(r.exitCode, r.stderr).toBe(0);
    for (const f of [
      'AGENTS.md',
      'working-memory/README.md',
      'working-memory/interceptions-candidates.md',
    
    ]) {
      expect(existsSync(path.join(root, f)), `${f} 未生成`).toBe(true);
    }
    expect(existsSync(path.join(root, 'meta')), 'consumer 不该造 KB').toBe(false);
    // 这一路**确实**生成了 wrapper —— 才允许让人去跑它
    expect(r.stdout).toContain('node scripts/collab-validate.mjs');
  });

  it('I14 未指定 --kb：跳过 wrapper，并出声说明门禁未接线', async () => {
    const r = await runCli(['init', '--dir', '.', '--with-ci']);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(path.join(root, 'scripts/collab-validate.mjs'))).toBe(false);
    expect(r.stdout + r.stderr).toMatch(/kb/i);
    // 没生成就不能让人去跑：指向 --kb 重跑才是真动作
    expect(r.stdout).not.toContain('node scripts/collab-validate.mjs');
    expect(r.stdout).toContain('--kb');
  });

  /**
   * 事故回归（2026-10-06）：消费者入口**通篇没提 CLI** → 某项目的 agent 通读入口后，
   * 整段会话 `collab` 用了 **0 次**：判据全写进 `working-memory/`（下一个人读不到），
   * `catalog.json` 停在很久以前，知识库一次都没增长。
   * **入口只说"去哪读"，不说"有工具"，等于这条规范不存在。**
   */
  it('I13c consumer 的 AGENTS.md 必须点名工具、并指回真 KB', async () => {
    const r = await runCli(['init', '--dir', '.', '--kb', 'D:/fake-kb']);
    expect(r.exitCode, r.stderr).toBe(0);

    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents, '入口必须点名 CLI').toContain('@chahuajia/collab-cli');
    expect(agents, '命令要指回真 KB，而不是本仓').toMatch(/fake-kb/);
    expect(agents, '要写清"选项的权威是 --help"（防表格漂移）').toContain('--help');
    expect(agents, '要写清"别对本仓 validate"（尺子拿错）').toContain('UNDECLARED_DIR');
    expect(agents).toContain('接在哪');
    expect(agents).toContain('红灯协议');
  });

  it('I13b consumer wrapper：安装范围派生，且**校验对象**被钉在 KB 上', async () => {
    const r = await runCli(['init', '--dir', '.', '--kb', 'D:/fake-kb']);
    expect(r.exitCode, r.stderr).toBe(0);

    const wrapper = await readFile(
      path.join(root, 'scripts/collab-validate.mjs'),
      'utf8',
    );
    expect(wrapper).toContain(`@chahuajia/collab-cli@${COLLAB_NPM_RANGE}`);

    // **校验对象**必须写死在 wrapper 里，而且必须带 `--dir`。
    //
    // 为什么单列一条断言：2026-10-06 实测到一份**手写的** wrapper
    // （`"npx --yes collab-cli@^1" validate` —— 既没有 KB 常量、也没有 `--dir`），
    // 它 `validate` 的是**当前目录**，于是把业务仓的 `docs/` `packages/` `working-memory/`
    // 全报成 `UNDECLARED_DIR`（10 条），而所有人以为那是"知识库的缺陷"。
    // **"用 KB 的尺子量业务仓"是这套工具最贵的误用。**
    expect(wrapper).toContain('const KB =');
    expect(wrapper).toContain('--dir ${KB} validate');
    // 路径可能被 resolve 成反斜杠，所以只断言"指回了那个库"这件事
    expect(wrapper, 'wrapper 必须指回 --kb 给的共享库').toMatch(/fake-kb/);
  });

  it('I15 --with-ci 生成的 CI：调唯一调用点 + 最小权限 + 取消旧轮 + 不用过时的 action', async () => {
    const r = await runCli(['init', '--dir', '.', '--kb', 'D:/fake-kb', '--with-ci']);
    expect(r.exitCode, r.stderr).toBe(0);

    const yml = await readFile(path.join(root, '.github/workflows/validate.yml'), 'utf8');
    // 唯一调用点：CLI 来源的差异（本机装 / npx / 本地构建）都收在 wrapper 里
    expect(yml).toContain('node scripts/collab-validate.mjs');
    expect(yml).toContain('permissions:');
    expect(yml).toContain('cancel-in-progress: true');
    // 2026-10-06 实测：`@v4` 会被强制跑在 node24 上并报弃用注解 —— 生成物不该教用户踩这个
    expect(yml, '别生成已弃用的 action major').not.toContain('@v4');
  });
});

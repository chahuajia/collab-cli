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
import { CLI_ENTRY } from './testHelpers.js';

let root: string;
let envOverrides: Record<string, string>;

/** 规格里的生成清单（profile=starter）。 */
const EXPECTED = [
  'AGENTS.md',
  'README.md',
  'meta/interceptions.md',
  'meta/known-gaps.md',
  'meta/pruning-policy.md',

];

async function runCli(args: string[]) {
  return execa('node', [CLI_ENTRY, ...args], {
    cwd: root,
    reject: false,
    env: { ...process.env, ...envOverrides },
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'collab-init-'));
  const emptyGitConfig = path.join(root, '.empty-gitconfig');
  await writeFile(emptyGitConfig, '');
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('collab init — profile=starter', () => {
  it('I1 空目录：生成清单里的文件，且随后 validate 为 0 issues', async () => {
    const r = await runCli(['init', '--profile', 'kb', '--dir', '.']);
    expect(r.exitCode, r.stderr).toBe(0);
    for (const f of EXPECTED) {
      expect(existsSync(path.join(root, f)), `${f} 未生成`).toBe(true);
    }
    const v = await runCli(['validate', '--dir', '.']);
    expect(v.exitCode, v.stdout + v.stderr).toBe(0);
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

  it('I12 生成的 AGENTS.md 不含指向未落盘条目的双链', async () => {
    await runCli(['init', '--profile', 'kb', '--dir', '.']);
    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    const links = [...agents.matchAll(/\[\[([^\]]+)\]\]/g)]
      .map((m) => (m[1] ?? '').trim())
      .filter((s) => s !== '');
    expect(links, `starter 不应制造死链：${links.join(', ')}`).toEqual([]);
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
  });

  it('I14 未指定 --kb：跳过 wrapper，并出声说明门禁未接线', async () => {
    const r = await runCli(['init', '--dir', '.', '--with-ci']);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(path.join(root, 'scripts/collab-validate.mjs'))).toBe(false);
    expect(r.stdout + r.stderr).toMatch(/kb/i);
  });
});
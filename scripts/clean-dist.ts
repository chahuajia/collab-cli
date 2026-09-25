#!/usr/bin/env node
// scripts/clean-dist.ts
//
// 构建前清空 `dist/`。
//
// 为什么需要它：`tsc` **不会**清理 `outDir`。源文件一旦改名/移动/删除，
// 旧编译产物会原地留下，而 `package.json` 的 `files` 收的是整个 `dist/` ——
// 于是**删掉的模块照样发布出去**：
//
//   - 2026-09-26 实测：`renderIndex` / `parseIndex` 从 `cli/lib` 移到 `application` 后，
//     包里同时有 `dist/application/*.js`（新）与 `dist/cli/lib/*.js`（旧，已无源）。
//   - 包从 98 files 涨到 100，且多了一份"看起来是工具一部分"的过期代码。
//   - 已发布的 `0.5.1` 里就带着 5 个**早已无源**的模块（GitAdapter 等）。
//
// 同一类病还有更坏的一面：消费者若直接 `require('.../dist/cli/lib/renderIndex.js')`，
// 拿到的是**过期的实现**。清理是唯一便宜的解法 —— 构建必须从干净开始。

import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
rmSync(path.join(projectRoot, "dist"), { recursive: true, force: true });

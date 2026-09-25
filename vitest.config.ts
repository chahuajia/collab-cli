// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * E2E 测试的单测超时（毫秒）。
 *
 * @remarks
 * 默认 5000ms 对本项目不够：CLI 测试每条都要 `git init` + 起一个 node
 * 子进程（`dist/cli/index.js`），而 vitest 默认**并行跑测试文件**——
 * 文件一多，单条就会在负载下超过 5s（在 6 核 Windows 上实测 4-7s）。
 *
 * 这是"预算"问题，不是"正确性"问题：真正的卡死仍然会在 20s 后失败。
 */
const E2E_TIMEOUT_MS = 20000;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: E2E_TIMEOUT_MS,
    hookTimeout: E2E_TIMEOUT_MS,
    include: [
      "src/**/__tests__/**/*.test.ts",
      // 工具链的测试也要跑：门禁的判据（跳过记账）与仓库卫生都在 `scripts/` 下
      "scripts/**/__tests__/**/*.test.ts",
    ],
  },
});

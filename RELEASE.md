# 发布检查单（最小可用版）

## 一、发布（两条命令）

```bash
npm version 0.5.0        # 已 bump 可跳过
npm publish --access public
```

> 为什么是 `0.5.0` 而不是 `1.0.0`：核心命令稳定、734 测试全绿，
> 但**还没有第二个真实使用者**。"1.0" 是承诺，现在给不出。

## 二、发布前已验证（2026-09-25）

| 项 | 结果 |
| :--- | :--- |
| 测试 | **734 / 734** · 52 files |
| 类型 | `tsc --noEmit` 干净 |
| 打包 | `npm pack` → 97 files / 103 kB |
| 包内容 | `dist/` 下 `.test.js` **0** · `.map` **0** · `bin/collab.js` 就位 |
| 装机 | 干净目录装 tgz → `--version` / `validate` 均通过 |
| 自举 | 对真实 KB 跑 `validate` → **127 entries / 0 issues** |

## 三、发布后可以做的两件小事

1. **wrapper 默认值改回来**：生成物 `scripts/collab-validate.mjs` 里的
   `const CLI = process.env.COLLAB_CLI ?? "";` → `?? "npx --yes collab-cli@^1"`
   （留空是因为还没发布；生成物里写了 TODO 注释）
2. `collab init` 的 `--with-ci` / `--with-hook` 可以改成默认开

## 四、release note 必须带的一段（别省）

> **诚实边界**：这套东西里被证据支持的是**机制**（校验器 / 两账本 / 入库门槛 / 毕业退役），
> 不是条目内容。唯一干净的对照实验测出**零差异**，读库那一路墙钟 **+55%**。
> "读了有没有用"**至今不可判定**。

写不写这段，决定了这份 release 是技术说明还是宣传稿。

## 五、配套文章

`collaboration` 仓库的 `SHARE.md` ——《当生产免费，唯一稀缺的是判断》，
含"对 agent 的好处/坏处"各一节 + "什么值得推广、什么不值得"四层表。
// eslint.config.js
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";

export default [
  // ─────────────────────────────────────────────
  // 全局 settings
  // ─────────────────────────────────────────────
  {
    settings: {
      "import/resolver": {
        typescript: { project: ["./tsconfig.json", "./tsconfig.tooling.json"] },
      },
    },
  },

  // ─────────────────────────────────────────────
  // 基础规则：所有 TS 文件
  // ─────────────────────────────────────────────
  {
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // ⚠️ D2 修复：type-aware 规则需要 project。
        // 两个 project：产品在 `tsconfig.json`，工具链（`scripts/`）在
        // `tsconfig.tooling.json` —— 后者不能并进前者（rootDir 冲突，见那个文件）。
        project: ["./tsconfig.json", "./tsconfig.tooling.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    rules: {
      // ── 类型导入 ──
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // ── D3 修复：禁止 as 断言（brand.ts 会例外） ──
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],

      // ── D4 修复：基础健壮性 ──
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // ── 通用规则 ──
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",

      // ── D5 修复：先降级为 warn ──
      "no-magic-numbers": [
        "warn",
        {
          /**
           * 值相同不代表语义相同。当同一个值在不同上下文中有不同业务含义时，
           * 必须在各自的领域重新定义常量，不得共享跨域的"通用值";
           * 但此处是结构性边界值，允许使用;
           */
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],

      // ── import 顺序（自动修复） ──
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      // ── 禁止空导出（避免误写） ──
      "import/no-empty-named-blocks": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
    },
  },

  // ─────────────────────────────────────────────
  // D6 修复：特殊文件例外
  // ─────────────────────────────────────────────
  {
    // brand 构造器是全项目唯一允许 as 的地方
    files: ["src/shared/brands.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  {
    // 值对象的 create 里需要一次 brand 断言（依赖已校验的不变量）
    files: ["src/domain/entry/EntryId.ts", "src/domain/entry/ISODate.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
    },
  },

  // ─────────────────────────────────────────────
  // 分层约束（你已有的逻辑，保持）
  // ─────────────────────────────────────────────
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: "./src",
              except: ["./domain", "./shared"],
              message: "domain may only import from domain/ and shared/",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/shared",
              from: "./src",
              except: ["./shared"],
              message: "shared may not import from anywhere else",
            },
          ],
        },
      ],
      // 新增：禁止 import 外部包
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: false, peerDependencies: false },
      ],
    },
  },

  // ─────────────────────────────────────────────
  // 测试文件放宽
  // ─────────────────────────────────────────────
  {
    files: [
      "src/**/__tests__/**/*.ts",
      "src/**/*.test.ts",
      // 工具链的测试同样放宽 —— 它们与 src 里的测试是同一类东西
      "scripts/**/__tests__/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-magic-numbers": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },

  // ─────────────────────────────────────────────
  // 忽略编译产物与依赖
  // ─────────────────────────────────────────────
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "*.config.js"],
  },
];

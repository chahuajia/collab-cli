// src/infrastructure/fs/FileWorkspaceLoader.ts
import fs from "node:fs";
import path from "node:path";
import { Entry } from "@/domain/entry/Entry";
import { Frontmatter } from "@/domain/entry/Frontmatter";
import { EntryKindDir } from "@/domain/entry/types";
import { Issue } from "@/domain/validation/Issue";
import {
  parseDocument,
  parseFrontmatterInput,
} from "../parsing/FrontmatterParser.js";
import type { DocumentParseError } from "../parsing/FrontmatterParser.js";
import type {
  LoadedEntry,
  Workspace,
  WorkspaceLoader,
} from "@/domain/entry/WorkspaceLoader";

const MaxLayer = 999;

/**
 * 从真实文件系统加载 COLLABORATION 工作区。
 */
export class FileWorkspaceLoader implements WorkspaceLoader {
  constructor(private readonly collabDir: string) {}

  load(): Workspace {
    // D1: collabDir 必须存在且是目录
    if (!fs.existsSync(this.collabDir)) {
      throw new Error(`COLLABORATION directory not found: ${this.collabDir}`);
    }
    if (!fs.statSync(this.collabDir).isDirectory()) {
      throw new Error(
        `COLLABORATION path is not a directory: ${this.collabDir}`,
      );
    }

    const entries: LoadedEntry[] = [];
    const indexFiles = new Map<string, string>();
    const allMarkdownPaths = new Set<string>();
    const rootDocs = new Map<string, string>();
    // `_index.md` 之外的非条目文档（如 `domains/*/`）—— 它们是**路由面**，
    // 但 `indexFiles` 只覆盖 kind 目录、`rootDocs` 只覆盖仓库根。
    const extraDocs = new Map<string, string>();

    // 递归扫**整个 collabDir** —— 不只扫 EntryKindDir
    this.scanAll(
      this.collabDir,
      "",
      entries,
      indexFiles,
      allMarkdownPaths,
      rootDocs,
      extraDocs,
    );

    return {
      entries,
      indexFiles,
      allMarkdownPaths,
      catalogJson: this.readCatalog(),
      rootDocs,
      extraDocs,
    };
  }

  /**
   * 读取 `catalog.json`（生成物）。
   *
   * @remarks
   * 不存在时返回 `null` —— **不等于是错误**：不是每个工作区都需要 catalog，
   * 由 `catalogIsFresh` 决定"存在但过期"才报错。
   */
  private readCatalog(): string | null {
    const catalogPath = path.join(this.collabDir, "catalog.json");
    if (!fs.existsSync(catalogPath)) return null;
    return fs.readFileSync(catalogPath, "utf8");
  }

  /**
   * 递归扫整个工作区。
   *
   * @remarks
   * 排序约定（D8=A）：
   * - **目录**：`EntryKindDir` 顺序优先，其他按字母序。
   * - **文件**：按字母序。
   *
   * 保留"目录优先级"是兼容旧 `scanDir` 的行为。
   */
  private scanAll(
    absDir: string,
    relDir: string,
    entries: LoadedEntry[],
    indexFiles: Map<string, string>,
    allMarkdownPaths: Set<string>,
    rootDocs: Map<string, string>,
    extraDocs: Map<string, string>,
  ): void {
    const items = fs.readdirSync(absDir, { withFileTypes: true });
    items.sort((a, b) => {
      // 目录优先级：EntryKindDir 顺序优先
      const aPriority = this.dirPriority(relDir, a.name);
      const bPriority = this.dirPriority(relDir, b.name);
      if (aPriority !== bPriority) return aPriority - bPriority;
      // 同优先级：字母序
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      const itemAbs = path.join(absDir, item.name);
      const itemRel = relDir === "" ? item.name : `${relDir}/${item.name}`;

      if (item.isDirectory()) {
        if (item.name.startsWith(".")) continue;
        this.scanAll(
          itemAbs,
          itemRel,
          entries,
          indexFiles,
          allMarkdownPaths,
          rootDocs,
          extraDocs,
        );
        continue;
      }

      if (!item.isFile() || !item.name.endsWith(".md")) continue;

      allMarkdownPaths.add(itemRel.slice(0, -3));

      // 仓库根的 .md —— 入口文件（AGENTS.md / ROOT.md / README.md），单独收集
      if (relDir === "") {
        rootDocs.set(itemRel, fs.readFileSync(itemAbs, "utf8"));
        continue;
      }

      const isInEntryDir = this.isInEntryDir(itemRel);

      // `_index.md` 无论在哪一层都是**路由面**（`domains/*/_index.md` 不是 kind 目录，
      // 但它照样是"症状 → 先读"表）。kind 目录的进 `indexFiles`（索引增删用），
      // 其余进 `extraDocs`（路由面检查用）—— 用途不同的两张表。
      if (item.name === "_index.md") {
        const content = fs.readFileSync(itemAbs, "utf8");
        if (isInEntryDir) indexFiles.set(relDir, content);
        else extraDocs.set(itemRel, content);
        continue;
      }

      if (!isInEntryDir) continue;
      if (item.name.startsWith("_")) continue;

      if (item.name.startsWith("_")) continue;

      const content = fs.readFileSync(itemAbs, "utf8");
      entries.push(this.parseEntryFile(content, itemRel));
    }
  }

  /**
   * 判断路径是否在 `EntryKindDir` 下。
   *
   * @remarks
   * - `meta/decision-records/ADR-0001.md` → true（在 `meta/decision-records` 下）
   * - `meta/naming-conventions.md` → false（在 `meta/` 下，但不在 `meta/decision-records/` 下）
   * - `README.md` → false
   */
  private isInEntryDir(relPath: string): boolean {
    const normalized = relPath.replace(/\\/g, "/");
    for (const dir of Object.values(EntryKindDir)) {
      if (normalized.startsWith(dir + "/")) return true;
    }
    return false;
  }

  /**
   * 计算"目录优先级"。
   *
   * @remarks
   * - 返回 `EntryKindDir` 中的索引 —— 数字小 = 优先级高。
   * - 返回 `999` —— 不在 `EntryKindDir` 中 —— 排在后面。
   *
   * 用于保留 D8=A 的"目录按 EntryKindDir 顺序"约定。
   */
  private dirPriority(parentRel: string, name: string): number {
    const rel = parentRel === "" ? name : `${parentRel}/${name}`;
    const dirs = Object.values(EntryKindDir);
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      if (dir === undefined) continue;
      if (dir === rel || dir.startsWith(rel + "/")) return i;
    }
    return MaxLayer;
  }

  /**
   * 解析单个条目文件。
   */
  private parseEntryFile(content: string, relPath: string): LoadedEntry {
    // 1. 分离 frontmatter / body
    const docResult = parseDocument(content);
    if (!docResult.ok) {
      return {
        path: relPath,
        entry: null,
        parseIssues: [this.documentErrorToIssue(docResult.error, relPath)],
      };
    }

    // 2. 边界层：zod 校验形状
    const fmResult = parseFrontmatterInput(
      docResult.value.frontmatterRaw,
      relPath,
    );
    if (!fmResult.ok) {
      return { path: relPath, entry: null, parseIssues: fmResult.error };
    }

    // 3. 领域层：Frontmatter.create 校验不变量
    const domainResult = Frontmatter.create(fmResult.value);
    if (!domainResult.ok) {
      return { path: relPath, entry: null, parseIssues: domainResult.error };
    }

    return {
      path: relPath,
      entry: Entry.create(domainResult.value, docResult.value.body, relPath),
      parseIssues: [],
    };
  }

  /**
   * 把文档解析错误转换为领域 Issue。
   */
  private documentErrorToIssue(
    err: DocumentParseError,
    relPath: string,
  ): Issue {
    switch (err.kind) {
      case "missing-frontmatter":
        return Issue.missingFrontmatter(relPath);
      case "unclosed-frontmatter":
        return Issue.invalidYaml(
          relPath,
          "frontmatter is not closed (missing trailing ---)",
        );
      case "invalid-yaml":
        return Issue.invalidYaml(relPath, err.reason);
    }
  }
}

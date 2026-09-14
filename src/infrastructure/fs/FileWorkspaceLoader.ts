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

    // 递归扫**整个 collabDir** —— 不只扫 EntryKindDir
    this.scanAll(this.collabDir, "", entries, indexFiles, allMarkdownPaths);

    return { entries, indexFiles, allMarkdownPaths };
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
        this.scanAll(itemAbs, itemRel, entries, indexFiles, allMarkdownPaths);
        continue;
      }

      if (!item.isFile() || !item.name.endsWith(".md")) continue;

      allMarkdownPaths.add(itemRel.slice(0, -3));

      const isInEntryDir = this.isInEntryDir(itemRel);
      if (!isInEntryDir) continue;

      if (item.name === "_index.md") {
        const content = fs.readFileSync(itemAbs, "utf8");
        indexFiles.set(relDir, content);
        continue;
      }
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

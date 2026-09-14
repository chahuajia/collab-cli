// src/infrastructure/fs/FileWorkspaceLoader.ts
import fs from 'node:fs';
import path from 'node:path';
import {Entry} from "@/domain/entry/Entry";
import {Frontmatter} from "@/domain/entry/Frontmatter";
import {EntryKindDir} from "@/domain/entry/types";
import {Issue} from "@/domain/validation/Issue";
import {
    parseDocument,
    parseFrontmatterInput,
} from '../parsing/FrontmatterParser.js';
import type { DocumentParseError } from '../parsing/FrontmatterParser.js';
import type {LoadedEntry, Workspace, WorkspaceLoader} from "@/domain/entry/WorkspaceLoader";

/**
 * 从真实文件系统加载 COLLABORATION 工作区。
 *
 * @remarks
 * 扫描策略：
 * - 只扫描 `EntryKindDir` 定义的目录（递归子目录，D10=是）
 * - 已知目录不存在 → 跳过（D2=A）
 * - `collabDir` 本身不存在 → 抛异常（D1=A）
 * - 每个目录的 `_index.md` 读入 `indexFiles`（D7=A）
 * - 其他 `_` 开头的 `.md` 文件（如 `_template.md`）跳过
 * - 非 `.md` 文件跳过
 * - 未知目录不扫描
 *
 * 遍历顺序（D8=A）：
 * - 目录间：按 `EntryKindDir` 的定义顺序
 * - 目录内：按文件名字母序
 *
 * 为什么把扫描范围限定在 `EntryKindDir`：
 * `EntryKindDir` 是领域知识（类型 → 目录的映射），
 * 扫描由它驱动而非"全目录扫描后过滤"——
 * 这保证了领域知识是唯一真相来源。
 */
export class FileWorkspaceLoader implements WorkspaceLoader {
    constructor(private readonly collabDir: string) {}

    load(): Workspace {
        // D1: collabDir 必须存在且是目录
        if (!fs.existsSync(this.collabDir)) {
            throw new Error(
                `COLLABORATION directory not found: ${this.collabDir}`,
            );
        }
        if (!fs.statSync(this.collabDir).isDirectory()) {
            throw new Error(
                `COLLABORATION path is not a directory: ${this.collabDir}`,
            );
        }

        const entries: LoadedEntry[] = [];
        const indexFiles = new Map<string, string>();

        for (const dir of Object.values(EntryKindDir)) {
            const absDir = path.join(this.collabDir, dir);
            if (!fs.existsSync(absDir)) continue; // D2: 目录不存在 → 跳过
            this.scanDir(absDir, dir, entries, indexFiles);
        }

        return { entries, indexFiles };
    }

    /**
     * 递归扫描单个目录。
     *
     * @param absDir - 目录的绝对路径
     * @param relDir - 相对 `collabDir` 的路径（用作 indexFiles 的 key）
     * @param entries - 累积条目
     * @param indexFiles - 累积索引
     */
    private scanDir(
        absDir: string,
        relDir: string,
        entries: LoadedEntry[],
        indexFiles: Map<string, string>,
    ): void {
        const items = fs.readdirSync(absDir, { withFileTypes: true });
        // D8: 目录内按字母序
        items.sort((a, b) => a.name.localeCompare(b.name));

        for (const item of items) {
            const itemAbs = path.join(absDir, item.name);
            const itemRel = relDir === '' ? item.name : `${relDir}/${item.name}`;

            if (item.isDirectory()) {
                // D10: 递归
                this.scanDir(itemAbs, itemRel, entries, indexFiles);
                continue;
            }

            if (!item.isFile() || !item.name.endsWith('.md')) continue;

            if (item.name === '_index.md') {
                // D7: 读入 indexFiles，不作为条目
                const content = fs.readFileSync(itemAbs, 'utf8');
                indexFiles.set(relDir, content);
                continue;
            }

            if (item.name.startsWith('_')) {
                // _template.md 等其他下划线文件跳过
                continue;
            }

            const content = fs.readFileSync(itemAbs, 'utf8');
            entries.push(this.parseEntryFile(content, itemRel));
        }
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
        const fmResult = parseFrontmatterInput(docResult.value.frontmatterRaw, relPath);
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
            case 'missing-frontmatter':
                return Issue.missingFrontmatter(relPath);
            case 'unclosed-frontmatter':
                return Issue.invalidYaml(
                    relPath,
                    'frontmatter is not closed (missing trailing ---)',
                );
            case 'invalid-yaml':
                return Issue.invalidYaml(relPath, err.reason);
        }
    }
}
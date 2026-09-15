// src/infrastructure/parsing/__tests__/FrontmatterParser.test.ts
import { describe, it, expect } from 'vitest';
import { IssueCodeValues } from '@/domain/validation/IssueCode';
import {parseDocument, parseFrontmatterInput} from '@/infrastructure/parsing/FrontmatterParser';

describe('parseFrontmatterInput', () => {
    it('parses valid frontmatter', () => {
        const raw = {
            id: 'S12',
            type: 'skill',
            status: 'active',
            created: '2026-09-11',
            updated: '2026-09-11',
            author: 'test@example.com',
        };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.id).toBe('S12');
            expect(result.value.domains).toEqual([]);   // 默认值填充
            expect(result.value.supersedes).toBeNull();  // 默认值填充
        }
    });

    it('rejects invalid type', () => {
        const raw = { id: 'S12', type: 'invalid', status: 'active',
            created: '2026-09-11', updated: '2026-09-11', author: 'a@b.c' };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error[0]?.code).toBe(IssueCodeValues.InvalidShape);
        }
    });

    it('rejects missing author', () => {
        const raw = { id: 'S12', type: 'skill', status: 'active',
            created: '2026-09-11', updated: '2026-09-11' };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(false);
    });

    it('rejects empty author', () => {
        const raw = { id: 'S12', type: 'skill', status: 'active',
            created: '2026-09-11', updated: '2026-09-11', author: '' };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(false);
    });

    it('accepts optional provenance', () => {
        const raw = { id: 'S12', type: 'skill', status: 'active',
            created: '2026-09-11', updated: '2026-09-11',
            author: 'test@example.com', provenance: '源自 Rust RFC' };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.provenance).toBe('源自 Rust RFC');
        }
    });
});

describe('parseDocument', () => {
    describe('正常场景', () => {
        it('separates frontmatter and body', () => {
            const raw = '---\nid: S12\n---\n## 上下文\n\n正文\n';
            const result = parseDocument(raw);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.frontmatterRaw).toEqual({ id: 'S12' });
                expect(result.value.body).toBe('## 上下文\n\n正文\n');
            }
        });

        it('handles empty body', () => {
            const raw = '---\nid: S12\n---\n';
            const result = parseDocument(raw);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.body).toBe('');
            }
        });

        it('handles body with --- separator inside', () => {
            const raw = '---\nid: S12\n---\n正文\n\n---\n\n更多正文\n';
            const result = parseDocument(raw);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.body).toContain('---');
                expect(result.value.body).toContain('更多正文');
            }
        });

        it('handles Windows line endings (\\r\\n)', () => {
            const raw = '---\r\nid: S12\r\n---\r\n正文\r\n';
            const result = parseDocument(raw);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.frontmatterRaw).toEqual({ id: 'S12' });
            }
        });

        it('handles file starting with BOM', () => {
            const raw = '\uFEFF---\nid: S12\n---\n正文\n';
            const result = parseDocument(raw);
            expect(result.ok).toBe(true);
        });
    });

    describe("错误场景", () => {
      it("returns missing-frontmatter when file does not start with ---", () => {
        const raw = "## 上下文\n\n没有 frontmatter\n";
        const result = parseDocument(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("missing-frontmatter");
      });

      it("returns missing-frontmatter for empty file", () => {
        const result = parseDocument("");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("missing-frontmatter");
      });

      it("returns unclosed-frontmatter when end --- missing", () => {
        const raw = "---\nid: S12\n## 上下文\n";
        const result = parseDocument(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("unclosed-frontmatter");
      });

      it("returns invalid-yaml for malformed YAML", () => {
        const raw = "---\nid: [unclosed\n---\n正文\n";
        const result = parseDocument(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("invalid-yaml");
      });

      it("returns invalid-yaml when frontmatter is not an object", () => {
        const raw = "---\njust a string\n---\n正文\n";
        const result = parseDocument(raw);
        // YAML 解析成功但结果不是 object
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("invalid-yaml");
      });
    });


    describe("parseFrontmatterInput — status 按 kind 校验", () => {
      /** 构造最小合法 input（可覆盖字段）。 */
      function makeRaw(
        overrides: Record<string, unknown> = {},
      ): Record<string, unknown> {
        return {
          id: "S12",
          type: "skill",
          status: "active",
          created: "2026-09-14",
          updated: "2026-09-14",
          author: "test@example.com",
          ...overrides,
        };
      }

      describe("ADR 类型", () => {
        it('accepts ADR with status "accepted"', () => {
          const raw = makeRaw({
            id: "ADR-0001",
            type: "adr",
            status: "accepted",
          });
          const result = parseFrontmatterInput(raw, "adr.md");
          expect(result.ok).toBe(true);
        });

        it('accepts ADR with status "proposed"', () => {
          const raw = makeRaw({
            id: "ADR-0002",
            type: "adr",
            status: "proposed",
          });
          const result = parseFrontmatterInput(raw, "adr.md");
          expect(result.ok).toBe(true);
        });

        it('accepts ADR with status "superseded"', () => {
          const raw = makeRaw({
            id: "ADR-0003",
            type: "adr",
            status: "superseded",
          });
          const result = parseFrontmatterInput(raw, "adr.md");
          expect(result.ok).toBe(true);
        });

        it('rejects ADR with common status "active"', () => {
          const raw = makeRaw({
            id: "ADR-0004",
            type: "adr",
            status: "active",
          });
          const result = parseFrontmatterInput(raw, "adr.md");
          expect(result.ok).toBe(false);
          if (!result.ok) {
            const statusIssue = result.error.find((i) =>
              i.message.toLowerCase().includes("status"),
            );
            expect(statusIssue).toBeDefined();
          }
        });

        it('rejects ADR with common status "draft"', () => {
          const raw = makeRaw({
            id: "ADR-0005",
            type: "adr",
            status: "draft",
          });
          const result = parseFrontmatterInput(raw, "adr.md");
          expect(result.ok).toBe(false);
        });
      });

      describe("非 ADR 类型", () => {
        it('accepts skill with common status "active"', () => {
          const raw = makeRaw({ type: "skill", status: "active" });
          const result = parseFrontmatterInput(raw, "skill.md");
          expect(result.ok).toBe(true);
        });

        it('accepts agreement with common status "active"', () => {
          const raw = makeRaw({
            id: "A1",
            type: "agreement",
            status: "active",
          });
          const result = parseFrontmatterInput(raw, "agreement.md");
          expect(result.ok).toBe(true);
        });

        it('rejects skill with ADR-only status "accepted"', () => {
          const raw = makeRaw({ type: "skill", status: "accepted" });
          const result = parseFrontmatterInput(raw, "skill.md");
          expect(result.ok).toBe(false);
        });

        it('rejects skill with ADR-only status "superseded"', () => {
          const raw = makeRaw({ type: "skill", status: "superseded" });
          const result = parseFrontmatterInput(raw, "skill.md");
          expect(result.ok).toBe(false);
        });
      });

      describe("空 / 非法 status", () => {
        it("rejects empty status", () => {
          const raw = makeRaw({ status: "" });
          const result = parseFrontmatterInput(raw, "skill.md");
          expect(result.ok).toBe(false);
        });

        it("rejects unknown status", () => {
          const raw = makeRaw({ status: "whatever" });
          const result = parseFrontmatterInput(raw, "skill.md");
          expect(result.ok).toBe(false);
        });
      });
    });
});
import { describe, expect, it } from "vitest";
import { createSession, dispatch } from "@/mcp/server";
import { MCP_TOOLS } from "@/mcp/tools";
import type { ToolContext } from "@/mcp/handlers";

/** 一个不存在的目录：只测协议行为时用它，避免误读真实知识库。 */
const CTX: ToolContext = { cwd: process.cwd(), dir: null };

function send(line: string, ctx: ToolContext = CTX): unknown {
  const response = dispatch(line, ctx, createSession());
  expect(response).not.toBeNull();
  if (response === null) throw new Error("unreachable");
  // 每行必须是**一条**合法 JSON —— 这是 stdio 传输的硬要求
  expect(response.trimEnd().includes("\n")).toBe(false);
  return JSON.parse(response);
}

describe("MCP 服务器", () => {
  describe("initialize（旧协议握手）", () => {
    it("回显客户端支持的版本", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18", capabilities: {} },
        }),
      );
      expect(response).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        result: { protocolVersion: "2025-06-18" },
      });
    });

    it("客户端版本不认识 → 回一个自己支持的版本（不报错）", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "1999-01-01" },
        }),
      );
      expect(response).toMatchObject({
        result: { protocolVersion: "2026-07-28" },
      });
    });

    it("旧协议的结果**不带** resultType（严格客户端会拒绝未知字段）", () => {
      const session = createSession();
      const response = dispatch(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        }),
        CTX,
        session,
      );
      expect(response).not.toBeNull();
      const parsed = JSON.parse(response ?? "{}");
      expect(parsed.result.resultType).toBeUndefined();
    });
  });

  describe("server/discover（现代协议）", () => {
    it("返回支持的版本、能力、身份", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "d1",
          method: "server/discover",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        }),
      );
      expect(response).toMatchObject({
        id: "d1",
        result: {
          resultType: "complete",
          supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18"],
        },
      });
    });

    it("声明了不支持的版本 → -32022，并给出 supported 列表", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "1900-01-01" },
          },
        }),
      );
      expect(response).toMatchObject({
        error: {
          code: -32022,
          data: { requested: "1900-01-01" },
        },
      });
    });
  });

  describe("tools/list", () => {
    it("返回全部工具，每个都有 inputSchema 与只读提示", () => {
      const session = createSession();
      session.protocolVersion = "2026-07-28";
      const response = dispatch(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        CTX,
        session,
      );
      const parsed = JSON.parse(response ?? "{}");
      expect(parsed.result.tools).toHaveLength(MCP_TOOLS.length);
      for (const tool of parsed.result.tools) {
        expect(typeof tool.name).toBe("string");
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.annotations.readOnlyHint).toBe(true);
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it("顺序稳定（客户端会缓存工具表）", () => {
      const first = send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      );
      const second = send(
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      );
      const names = (value: unknown): string[] => {
        if (typeof value !== "object" || value === null) return [];
        const result = Reflect.get(value, "result");
        if (typeof result !== "object" || result === null) return [];
        const tools = Reflect.get(result, "tools");
        if (!Array.isArray(tools)) return [];
        return tools.map((tool) => String(Reflect.get(tool, "name")));
      };
      expect(names(first)).toEqual(names(second));
    });

    it("没有 commit / push 这类工具（规则靠'不存在'执行）", () => {
      const response = send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      );
      const text = JSON.stringify(response);
      expect(text).not.toContain("collab_commit");
      expect(text).not.toContain("collab_push");
    });
  });

  describe("tools/call", () => {
    it("未知工具 → JSON-RPC InvalidParams（协议错，不是工具错）", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "collab_nope", arguments: {} },
        }),
      );
      expect(response).toMatchObject({ error: { code: -32602 } });
    });

    it("参数类型不对 → InvalidParams", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "collab_search", arguments: { query: 42 } },
        }),
      );
      expect(response).toMatchObject({ error: { code: -32602 } });
    });

    it("没有工作区时给出可操作的提示（而不是崩溃）", () => {
      const response = send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "collab_catalog", arguments: {} },
        }),
      );
      expect(response).toMatchObject({
        error: { message: expect.stringContaining("pass `dir`") },
      });
    });
  });

  describe("协议琐事", () => {
    it("未知方法 → MethodNotFound", () => {
      const response = send(
        JSON.stringify({ jsonrpc: "2.0", id: 9, method: "no/such" }),
      );
      expect(response).toMatchObject({ error: { code: -32601 } });
    });

    it("通知永不应答", () => {
      const response = dispatch(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
        CTX,
        createSession(),
      );
      expect(response).toBeNull();
    });

    it("ping 有应答（旧协议的存活探测）", () => {
      const response = send(
        JSON.stringify({ jsonrpc: "2.0", id: 10, method: "ping" }),
      );
      expect(response).toMatchObject({ id: 10, result: {} });
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  JsonRpcErrorCode,
  encodeMessage,
  isModernVersion,
  isSupportedVersion,
  parseIncoming,
  readRequestedVersion,
  successResponse,
  withResultType,
} from "@/mcp/protocol";

describe("MCP 协议层", () => {
  describe("parseIncoming", () => {
    it("坏 JSON → ParseError（而不是抛异常）", () => {
      const parsed = parseIncoming("{not json");
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.code).toBe(JsonRpcErrorCode.ParseError);
    });

    it("不是对象 → InvalidRequest", () => {
      const parsed = parseIncoming("[1,2,3]");
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
    });

    it("缺 jsonrpc 版本 → InvalidRequest", () => {
      const parsed = parseIncoming('{"id":1,"method":"tools/list"}');
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
    });

    it("缺 method → InvalidRequest", () => {
      const parsed = parseIncoming('{"jsonrpc":"2.0","id":1}');
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
    });

    it("没有 id → 通知（JSON-RPC 规定通知不应答）", () => {
      const parsed = parseIncoming(
        '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.kind).toBe("notification");
    });

    it("id 为 null 仍是请求（JSON-RPC 允许 null id）", () => {
      const parsed = parseIncoming(
        '{"jsonrpc":"2.0","id":null,"method":"tools/list"}',
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.kind).toBe("request");
    });
  });

  describe("encodeMessage", () => {
    it("内容里的换行被转义 —— 产物必然是单行", () => {
      const line = encodeMessage(
        successResponse(1, { text: "第一行\n第二行\n第三行" }),
      );
      expect(line.endsWith("\n")).toBe(true);
      expect(line.trimEnd().includes("\n")).toBe(false);
      expect(JSON.parse(line).result.text).toBe("第一行\n第二行\n第三行");
    });
  });

  describe("版本", () => {
    it("只认已声明的版本", () => {
      expect(isSupportedVersion("2026-07-28")).toBe(true);
      expect(isSupportedVersion("2025-06-18")).toBe(true);
      expect(isSupportedVersion("1999-01-01")).toBe(false);
    });

    it("2026-07-28 起算现代协议（无握手）", () => {
      expect(isModernVersion("2026-07-28")).toBe(true);
      expect(isModernVersion("2025-11-25")).toBe(false);
    });

    it("resultType 只加在现代会话上", () => {
      expect(withResultType({ a: 1 }, "2026-07-28")).toEqual({
        a: 1,
        resultType: "complete",
      });
      expect(withResultType({ a: 1 }, "2025-06-18")).toEqual({ a: 1 });
      expect(withResultType({ a: 1 }, null)).toEqual({ a: 1 });
    });
  });

  describe("readRequestedVersion", () => {
    it("从 _meta 里取版本", () => {
      expect(
        readRequestedVersion({
          _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
        }),
      ).toBe("2026-07-28");
    });

    it("缺字段 / 形状不对 → null", () => {
      expect(readRequestedVersion(undefined)).toBeNull();
      expect(readRequestedVersion({})).toBeNull();
      expect(readRequestedVersion({ _meta: "nope" })).toBeNull();
      expect(readRequestedVersion({ _meta: { x: 1 } })).toBeNull();
    });
  });
});

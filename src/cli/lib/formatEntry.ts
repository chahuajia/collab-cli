// src/cli/lib/formatEntry.ts
/**
 * 用 Prettier 格式化 Markdown body（若可用）。
 *
 * @remarks
 * D8=B：尝试格式化，失败则跳过。
 * 仅格式化 body——frontmatter 由调用方手动序列化，避免 Prettier
 * 对 YAML 的激进处理（如重排字段、改引号风格）。
 */
export async function formatMarkdown(body: string): Promise<string> {
    try {
        const prettier = await import('prettier');
        return await prettier.format(body, {
            parser: 'markdown',
            proseWrap: 'preserve',
        });
    } catch {
        return body;
    }
}
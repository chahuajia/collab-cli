/**
 * 解析 `collab --help`，以及从 KB 文档里抽取 `collab …` 用法。
 *
 * @remarks
 * **纯逻辑**，不碰文件系统 —— 判据与 I/O 分开（见 `scripts/README.md` 第 1 条）。
 *
 * 为什么要它：2026-09-26 一天里抓到**五个**「照文档抄就报错」，形态全是
 * 「同一份事实写在两个载体里，只有一边被改」。第五个是 `usage-guide.md` 的
 * `retire --enforced … --confirm` 少了后来变成必填的 `--reason`。
 * 修那一条只是止血；**判据要变成检查**：KB 文档里出现的每个选项，
 * 都必须是 `--help` 承认的，且用在对的子命令上。
 */

export interface CliHelp {
    /** `--help` 列出的子命令。 */
    readonly commands: ReadonlySet<string>;
    /** 选项 → 允许它的子命令集合；`null` = 全局/不限。 */
    readonly flags: ReadonlyMap<string, ReadonlySet<string> | null>;
}

/** `collab …` 的一次用法：哪个子命令、带了哪些选项。 */
export interface Usage {
    readonly sub: string;
    readonly flags: readonly string[];
}

/** 选项组的形态：`--dry-run` / `--with-ci / --with-hook` / `-m, --message`。 */
const FLAG_GROUP =
    /^ {2}((?:--[A-Za-z][\w-]*|-[A-Za-z])(?:\s*,\s*(?:--[A-Za-z][\w-]*|-[A-Za-z]))*(?:\s*\/\s*--[A-Za-z][\w-]*)*)\s+(.*)$/;

/**
 * 解析 help 文本。
 *
 * @remarks
 * 只认列首（0 缩进）且以 `:` 结尾的行作为分节标题；续行（深缩进）自然被忽略。
 */
export function parseCliHelp(help: string): CliHelp {
    const commands = new Set<string>();
    const flags = new Map<string, Set<string> | null>();
    let section = "";

    for (const raw of help.split(/\r?\n/)) {
        if (/^\S/.test(raw) && raw.trim().endsWith(":")) {
            section = raw.trim().replace(/:$/, "");
            continue;
        }

        if (section === "Commands") {
            const m = /^ {2}([a-z][a-z-]*)\b/.exec(raw);
            if (m?.[1] !== undefined) commands.add(m[1]);
            continue;
        }

        const isGlobal = section === "Global options" || section === "Other";
        const isCommandOption = section.startsWith("Command options");
        if (!isGlobal && !isCommandOption) continue;

        const m = FLAG_GROUP.exec(raw);
        if (m?.[1] === undefined) continue;

        const names = m[1]
            .split(/[,\/]/)
            .map((s) => s.trim())
            .filter((s) => s.startsWith("-"));

        if (isGlobal) {
            for (const n of names) flags.set(n, null);
            continue;
        }

        // 描述形如 `new / apply / fix — 说明`：破折号之前是适用命令。
        //
        // 但破折号之前**还可能有选项的值占位符** ——
        // `-m, --message <message>      commit — …`、
        // `--reason "<分类>: <证据>"     retire — …`。
        // 所以按空白与 `/` 一起切，再只留认识的子命令。
        const head = (m[2] ?? "").split("—")[0] ?? "";
        const applies = head
            .split(/[\/\s]+/)
            .map((s) => s.trim())
            .filter((s) => commands.has(s));
        const set = applies.length > 0 ? new Set(applies) : null;
        for (const n of names) flags.set(n, set);
    }

    return { commands, flags };
}

/**
 * 从**一行**文本里抽出一次 `collab …` 用法。不是用法时返回 `null`。
 *
 * @remarks
 * 三个必须处理的形态：
 *
 * 1. `collab --dir <KB> validate` —— 全局选项在前、子命令在后；
 * 2. `node $COLLAB --dir $KB catalog` —— 变量代替可执行名；
 * 3. `codex mcp add collab -- node <repo>/bin/collab.js mcp --dir <KB>` ——
 *    这里的 `collab` 是**别人命令的参数**，真正的子命令是 `mcp`。
 *
 * 第 3 种先剥掉 `codex mcp add <name> --` 前缀，再看 `bin/collab.js` 之后的 token。
 * 判定「这是不是一次用法」的锚点是：**token 里出现了已知子命令** ——
 * 于是 `COLLAB=<collab-cli>/dist/cli/index.js` 这类赋值行自然被排除。
 */
export function extractUsage(line: string, commands: ReadonlySet<string>): Usage | null {
    const stripped = line.replace(/^\s*codex\s+mcp\s+add\s+\S+\s+--\s*/, "");
    const m = /(?:\$COLLAB\b|bin\/collab\.js|(?<![\w/-])collab)\b(.*)$/.exec(stripped);
    if (m?.[1] === undefined) return null;

    const tokens = m[1].split(/\s+/).filter((t) => t.length > 0);
    const sub = tokens.find((t) => commands.has(t));
    if (sub === undefined) return null;

    const flags = tokens.filter(
        (t) => /^--[A-Za-z][\w-]*$/.test(t) || /^-[A-Za-z]$/.test(t),
    );
    return { sub, flags };
}

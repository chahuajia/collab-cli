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
    /** 这个子命令 `--help` 认得吗？`false` = 打错了。 */
    readonly known: boolean;
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
 * 判定「子命令是哪个」分两步，顺序不能反：
 *
 * 1. **先找已知子命令** —— 只要 token 里有，就用它。
 *    这一步保证 `collab --remote origin push` 里的 `origin`（选项的值）
 *    不会被误当成子命令；
 * 2. 一个已知的都没有时，**退而取第一个形如标识符的 token** ——
 *    它是"打算当子命令用、但打错了"的位置（如 `collab retiree --candidates`）。
 *    这一步是为了堵住"打错子命令 → 静默跳过"。
 *
 * 于是 `COLLAB=<collab-cli>/dist/…`（rest 以 `-` 开头）与
 * `collab <cmd> --help`（占位符不是标识符）都被排除。
 */
export function extractUsage(line: string, commands: ReadonlySet<string>): Usage | null {
    const stripped = line.replace(/^\s*codex\s+mcp\s+add\s+\S+\s+--\s*/, "");
    // **作用域 = 行内代码 span**（没有反引号时才是整行）。
    //
    // 起因（2026-09-26 实测误报）：KB 里常见一行两个 span 的写法 ——
    // `` `collab retire <id> --enforced … --reason "<分类>: <证据>"` + `--check-enforced` ``，
    // 后一个 span 的 `--check-enforced` 是 **validate** 的选项，按整行收集却算到了 `retire` 头上。
    // 检查器当时指控的是**文档**，而文档是对的 —— 所以修的是检查器。
    //
    // 代价（写清楚）：同一行里出现两次 `collab …` 时，仍只看**第一处**；
    // 命令在反引号外、而选项被反引号隔在后面时，那个选项不再被收集。
    for (const scope of usageScopes(stripped)) {
        const usage = usageIn(scope, commands);
        if (usage !== null) return usage;
    }
    return null;
}

/**
 * 把一行切成**作用域**：反引号 span 各自成段，span 之外的文字也各成段，保持位置顺序。
 */
function usageScopes(line: string): string[] {
    const scopes: string[] = [];
    let cursor = 0;
    for (const m of line.matchAll(/`([^`]*)`/g)) {
        const start = m.index ?? cursor;
        if (start > cursor) scopes.push(line.slice(cursor, start));
        scopes.push(m[1] ?? "");
        cursor = start + m[0].length;
    }
    if (cursor < line.length) scopes.push(line.slice(cursor));
    return scopes;
}

/** 在**一个作用域**里抽一次 `collab …` 用法。 */
function usageIn(scope: string, commands: ReadonlySet<string>): Usage | null {
    // 注意 `(?![\w-])`：`collab-cli`（包名/仓库名）不能被当成一次调用 ——
    // 散文里它后面常跟着 `工具：validate / catalog …`，会造出假阳性。
    const m = /(?:\$COLLAB\b|bin\/collab\.js|(?<![\w/-])collab(?![\w-]))(.*)$/.exec(scope);
    if (m?.[1] === undefined) return null;

    // 先去掉行内代码的反引号/前后标点 —— 否则 `` `collab validate` `` 切出来的
    // token 是 `` validate` ``，认不出子命令，反而会把后面的散文词当候选（实测踩过）。
    const tokens = m[1]
        .replace(/`/g, " ")
        .split(/\s+/)
        .map((t) => t.replace(/^[^\w<>-]+/, "").replace(/[^\w<>-]+$/, ""))
        .filter((t) => t.length > 0);
    const flags = tokens.filter(
        (t) => /^--[A-Za-z][\w-]*$/.test(t) || /^-[A-Za-z]$/.test(t),
    );

    const knownSub = tokens.find((t) => commands.has(t));
    if (knownSub !== undefined) return { sub: knownSub, known: true, flags };

    // 位置必须像"命令位"：**第一个非空 token**；若它是个选项，则看紧跟其后的那个。
    // 再往后就是散文了 —— `| [[S10]] | collab CLI 使用 | meta, … |` 里的 `meta`
    // 曾被误判成子命令（实测，因为中文 token 被归一化清掉后 `meta` 落到了第二位）。
    // 注意不要写成 `t is string` 谓词：那会把 false 分支窄化成 `never`，
    // 于是 `first.startsWith(...)` 直接编译不过（`npm run check` 抓到过）。
    const isIdent = (t: string): boolean => /^[a-z][a-z0-9-]*$/.test(t);
    const first = tokens[0] ?? "";
    const second = tokens[1] ?? "";
    const candidate = isIdent(first)
        ? first
        : first.startsWith("-") && isIdent(second)
          ? second
          : undefined;
    if (candidate === undefined) return null;
    return { sub: candidate, known: false, flags };
}

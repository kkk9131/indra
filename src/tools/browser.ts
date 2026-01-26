import { execSync } from "node:child_process";

export interface BrowserToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

const DEFAULT_SESSION = "indra";

// Use global agent-browser to avoid local node_modules version without native binary
const AGENT_BROWSER_PATH =
  process.env.AGENT_BROWSER_PATH ??
  `${process.env.HOME}/.npm-global/bin/agent-browser`;

function exec(
  args: string[],
  options: { session?: string; json?: boolean } = {},
): BrowserToolResult {
  const session = options.session ?? DEFAULT_SESSION;
  const cmdArgs = ["--session", session, ...args];
  if (options.json) cmdArgs.push("--json");

  try {
    const output = execSync(`"${AGENT_BROWSER_PATH}" ${cmdArgs.join(" ")}`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    const error = err as Error & { stderr?: string };
    return {
      success: false,
      error: error.stderr ?? error.message,
    };
  }
}

/** Navigate to URL */
export function browserOpen(
  url: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["open", url], options);
}

/** Get accessibility tree with refs for AI decision making */
export function browserSnapshot(options?: {
  session?: string;
  interactive?: boolean;
  compact?: boolean;
  depth?: number;
  selector?: string;
}): BrowserToolResult {
  const args = ["snapshot"];
  if (options?.interactive) args.push("-i");
  if (options?.compact) args.push("-c");
  if (options?.depth) args.push("-d", String(options.depth));
  if (options?.selector) args.push("-s", options.selector);
  return exec(args, { session: options?.session });
}

/** Click element by selector or @ref */
export function browserClick(
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["click", selector], options);
}

/** Clear and fill input field */
export function browserFill(
  selector: string,
  text: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["fill", selector, `"${text.replace(/"/g, '\\"')}"`], options);
}

/** Type text into element without clearing */
export function browserType(
  selector: string,
  text: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["type", selector, `"${text.replace(/"/g, '\\"')}"`], options);
}

/** Press keyboard key */
export function browserPress(
  key: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["press", key], options);
}

/** Hover over element */
export function browserHover(
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["hover", selector], options);
}

/** Wait for element or time */
export function browserWait(
  selectorOrMs: string | number,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["wait", String(selectorOrMs)], options);
}

/** Take screenshot */
export function browserScreenshot(options?: {
  session?: string;
  path?: string;
  fullPage?: boolean;
}): BrowserToolResult {
  const args = ["screenshot"];
  if (options?.path) args.push(options.path);
  if (options?.fullPage) args.push("--full");
  return exec(args, { session: options?.session });
}

/** Get information (text, html, url, title, value, attr, count, box, styles) */
export function browserGet(
  what:
    | "text"
    | "html"
    | "url"
    | "title"
    | "value"
    | "count"
    | "box"
    | "styles",
  selector?: string,
  options?: { session?: string; attrName?: string },
): BrowserToolResult {
  const args = ["get", what];
  if (selector) args.push(selector);
  return exec(args, options);
}

/** Get element attribute */
export function browserGetAttr(
  selector: string,
  attrName: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["get", "attr", attrName, selector], options);
}

/** Execute JavaScript in page context */
export function browserEval(
  js: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["eval", `"${js.replace(/"/g, '\\"')}"`], options);
}

/** Scroll page */
export function browserScroll(
  direction: "up" | "down" | "left" | "right",
  pixels?: number,
  options?: { session?: string },
): BrowserToolResult {
  const args = ["scroll", direction];
  if (pixels) args.push(String(pixels));
  return exec(args, options);
}

/** Scroll element into view */
export function browserScrollIntoView(
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["scrollintoview", selector], options);
}

/** Check element state */
export function browserIs(
  what: "visible" | "enabled" | "checked",
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["is", what, selector], options);
}

/** Select dropdown option */
export function browserSelect(
  selector: string,
  values: string[],
  options?: { session?: string },
): BrowserToolResult {
  return exec(["select", selector, ...values], options);
}

/** Check checkbox */
export function browserCheck(
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["check", selector], options);
}

/** Uncheck checkbox */
export function browserUncheck(
  selector: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["uncheck", selector], options);
}

/** Navigate back */
export function browserBack(options?: { session?: string }): BrowserToolResult {
  return exec(["back"], options);
}

/** Navigate forward */
export function browserForward(options?: {
  session?: string;
}): BrowserToolResult {
  return exec(["forward"], options);
}

/** Reload page */
export function browserReload(options?: {
  session?: string;
}): BrowserToolResult {
  return exec(["reload"], options);
}

/** Close browser */
export function browserClose(options?: {
  session?: string;
}): BrowserToolResult {
  return exec(["close"], options);
}

/** Save page as PDF */
export function browserPdf(
  path: string,
  options?: { session?: string },
): BrowserToolResult {
  return exec(["pdf", path], options);
}

/** Upload files to input element */
export function browserUpload(
  selector: string,
  files: string[],
  options?: { session?: string },
): BrowserToolResult {
  return exec(["upload", selector, ...files], options);
}

/** Find elements by semantic locator */
export function browserFind(
  locator:
    | "role"
    | "text"
    | "label"
    | "placeholder"
    | "alt"
    | "title"
    | "testid",
  value: string,
  action: "click" | "fill" | "check" | "hover",
  actionText?: string,
  options?: { session?: string },
): BrowserToolResult {
  const args = ["find", locator, value, action];
  if (actionText) args.push(actionText);
  return exec(args, options);
}

/** Get or set cookies */
export function browserCookies(
  action: "get" | "set" | "clear",
  options?: {
    session?: string;
    name?: string;
    value?: string;
    url?: string;
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    expires?: number;
  },
): BrowserToolResult {
  const args = ["cookies", action];
  if (action === "set" && options?.name && options?.value) {
    args.push(options.name, options.value);
    if (options.url) args.push("--url", options.url);
    if (options.domain) args.push("--domain", options.domain);
    if (options.path) args.push("--path", options.path);
    if (options.httpOnly) args.push("--httpOnly");
    if (options.secure) args.push("--secure");
    if (options.sameSite) args.push("--sameSite", options.sameSite);
    if (options.expires) args.push("--expires", String(options.expires));
  }
  return exec(args, { session: options?.session });
}

/** Manage web storage */
export function browserStorage(
  type: "local" | "session",
  action: "get" | "set" | "clear",
  key?: string,
  value?: string,
  options?: { session?: string },
): BrowserToolResult {
  const args = ["storage", type, action];
  if (key) args.push(key);
  if (value) args.push(value);
  return exec(args, options);
}

// Export all tools for Agent SDK registration
export const browserTools = {
  browserOpen,
  browserSnapshot,
  browserClick,
  browserFill,
  browserType,
  browserPress,
  browserHover,
  browserWait,
  browserScreenshot,
  browserGet,
  browserGetAttr,
  browserEval,
  browserScroll,
  browserScrollIntoView,
  browserIs,
  browserSelect,
  browserCheck,
  browserUncheck,
  browserBack,
  browserForward,
  browserReload,
  browserClose,
  browserPdf,
  browserUpload,
  browserFind,
  browserCookies,
  browserStorage,
};

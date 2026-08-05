import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

type TokenType = "key" | "string" | "number" | "boolean" | "null" | "plain";
interface Token {
  type: TokenType;
  value: string;
}
const pattern =
  /(\"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\\"])*\"\s*:)|(\"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\\"])*\")|\b(true|false)\b|\b(null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      tokens.push({ type: "plain", value: line.slice(cursor, index) });
    let type: TokenType = "number";
    if (match[1]) type = "key";
    else if (match[2]) type = "string";
    else if (match[3]) type = "boolean";
    else if (match[4]) type = "null";
    tokens.push({ type, value: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < line.length)
    tokens.push({ type: "plain", value: line.slice(cursor) });
  return tokens;
}

export function JsonViewer({
  value,
  label = "Raw JSON",
}: {
  value: unknown;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const raw = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const lines = useMemo(() => raw.split("\n").map(tokenize), [raw]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
    } catch {
      const area = document.createElement("textarea");
      area.value = raw;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <section className="json-viewer" aria-label={label}>
      <div className="json-toolbar">
        <div>
          <span className="eyebrow">Source payload</span>
          <strong>{label}</strong>
        </div>
        <button className="button button-ghost" type="button" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <pre className="json-code" tabIndex={0}>
        <code>
          {lines.map((line, lineIndex) => (
            <span className="json-line" key={lineIndex}>
              <span className="json-line-number" aria-hidden="true">
                {lineIndex + 1}
              </span>
              <span className="json-line-content">
                {line.map((token, tokenIndex) => (
                  <span
                    className={`json-${token.type}`}
                    key={`${lineIndex}-${tokenIndex}`}
                  >
                    {token.value}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </section>
  );
}

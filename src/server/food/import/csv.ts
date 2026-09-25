/**
 * Streaming CSV/TSV parser (RFC 4180: quoted fields, "" escapes, embedded newlines, CRLF).
 * Dependency-free; handles multi-GB files with constant memory.
 */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";

export interface CsvOptions {
  delimiter?: string;
  /** Quote character, or null to disable quoting (OFF TSV dumps are unquoted). */
  quote?: string | null;
}

/** Parses text chunks into rows of fields. */
export async function* parseCsv(chunks: AsyncIterable<string | Buffer>, opts: CsvOptions = {}): AsyncGenerator<string[]> {
  const delimiter = opts.delimiter ?? ",";
  const quote = opts.quote === undefined ? '"' : opts.quote;
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let pendingQuote = false; // saw a quote inside a quoted field; next char decides
  let sawAny = false;
  let first = true;

  for await (const chunk of chunks) {
    let text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if (first && text) {
      text = text.replace(/^\uFEFF/, "");
      first = false;
    }
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (pendingQuote) {
          pendingQuote = false;
          if (c === quote) {
            field += quote;
            start = i + 1;
            continue;
          }
          inQuotes = false; // closing quote – fall through to normal handling
        } else if (c === quote) {
          field += text.slice(start, i);
          pendingQuote = true;
          start = i + 1;
          continue;
        } else {
          continue;
        }
      }
      if (c === quote && quote !== null && field === "" && start === i) {
        inQuotes = true;
        start = i + 1;
        sawAny = true;
        continue;
      }
      if (c === delimiter) {
        row.push(field + text.slice(start, i));
        field = "";
        start = i + 1;
        sawAny = true;
      } else if (c === "\n") {
        let end = i;
        if (end > start && text[end - 1] === "\r") end--;
        let last = field + text.slice(start, end);
        if (last.endsWith("\r")) last = last.slice(0, -1);
        row.push(last);
        yield row;
        row = [];
        field = "";
        start = i + 1;
        sawAny = false;
      } else {
        sawAny = true;
      }
    }
    if (inQuotes && !pendingQuote) field += text.slice(start);
    else if (!inQuotes) field += text.slice(start);
  }
  if (sawAny || field !== "" || row.length) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    yield row;
  }
}

/** Streams a (optionally .gz) file as CSV records keyed by the header row. */
export async function* readCsvRecords(
  path: string,
  opts: CsvOptions = {},
): AsyncGenerator<Record<string, string>> {
  const input = createReadStream(path);
  const stream = path.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  stream.setEncoding("utf8");
  let header: string[] | null = null;
  for await (const row of parseCsv(stream as AsyncIterable<string>, opts)) {
    if (!header) {
      header = row.map((h) => h.replace(/^﻿/, "").trim());
      continue;
    }
    if (row.length === 1 && row[0] === "") continue;
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) rec[header[i]] = row[i] ?? "";
    yield rec;
  }
}

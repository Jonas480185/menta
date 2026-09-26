import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parseCsv, readCsvRecords } from "./csv";

async function collect(chunks: string[], opts = {}) {
  async function* gen() {
    yield* chunks;
  }
  const rows: string[][] = [];
  for await (const r of parseCsv(gen(), opts)) rows.push(r);
  return rows;
}

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes, embedded delimiters and newlines", async () => {
    const rows = await collect(['"id","text"\n"1","a, ""b""\nc"\n2,plain\n']);
    expect(rows).toEqual([
      ["id", "text"],
      ["1", 'a, "b"\nc'],
      ["2", "plain"],
    ]);
  });

  it("handles CRLF, empty fields and a missing trailing newline", async () => {
    expect(await collect(["a,,c\r\n1,2,3"])).toEqual([
      ["a", "", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("is chunk-boundary safe (quotes and escapes split across chunks)", async () => {
    const text = '"x","say ""hi""",z\n"1","2\n3",4\n';
    const whole = await collect([text]);
    for (let size = 1; size < 7; size++) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
      expect(await collect(chunks)).toEqual(whole);
    }
  });

  it("supports unquoted TSV", async () => {
    expect(await collect(['code\tname\n123\tsay "hi"\n'], { delimiter: "\t", quote: null })).toEqual([
      ["code", "name"],
      ["123", 'say "hi"'],
    ]);
  });
});

describe("readCsvRecords", () => {
  it("maps rows to header keys and reads .gz files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "csv-"));
    const file = path.join(dir, "x.csv.gz");
    await writeFile(file, gzipSync('﻿"fdc_id","description"\n"1","Apples, raw"\n'));
    const out: Record<string, string>[] = [];
    for await (const r of readCsvRecords(file)) out.push(r);
    expect(out).toEqual([{ fdc_id: "1", description: "Apples, raw" }]);
  });
});

/* eslint-disable @typescript-eslint/no-require-imports */
// Lets CLI scripts (seed/migrate) import server modules that are guarded by `import "server-only"`.
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require.resolve("./server-only-empty.cjs");
  return original.call(this, request, ...rest);
};

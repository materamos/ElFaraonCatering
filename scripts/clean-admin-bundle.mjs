import { rm } from "node:fs/promises";
import path from "node:path";

const filesToRemove = [
  path.resolve("public/admin/decap-cms-3.10.1.js"),
  path.resolve("public/admin/decap-cms-3.10.1.js.LICENSE.txt"),
];

await Promise.all(filesToRemove.map((filePath) => rm(filePath, { force: true })));

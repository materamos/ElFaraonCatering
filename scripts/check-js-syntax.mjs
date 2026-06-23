import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const targetDirectories = [
  { directory: "public/scripts", extensions: new Set([".js"]) },
  { directory: "scripts", extensions: new Set([".mjs"]) },
  { directory: "src/utils", extensions: new Set([".mjs"]) },
];

const files = (
  await Promise.all(
    targetDirectories.map((target) =>
      listFiles(path.join(rootDir, target.directory), target.extensions),
    ),
  )
).flat();

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

console.log(`JS syntax check passed for ${files.length} files.`);

async function listFiles(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, extensions)));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

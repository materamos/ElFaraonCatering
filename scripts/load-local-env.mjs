import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const localEnvFileName = ".env.local";
const envNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function loadLocalEnv(rootDir = process.cwd()) {
  const envPath = path.join(rootDir, localEnvFileName);

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim();

    if (!envNamePattern.test(name) || process.env[name] !== undefined) {
      continue;
    }

    process.env[name] = parseEnvValue(line.slice(separatorIndex + 1).trim());
  }
}

function parseEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  const commentIndex = value.indexOf(" #");

  return commentIndex === -1 ? value : value.slice(0, commentIndex).trimEnd();
}

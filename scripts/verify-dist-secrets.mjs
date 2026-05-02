import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
const sensitiveNamePattern = new RegExp(
  `(?:${privateDatabaseUrlEnvName}|DATABASE_URL|POSTGRES|SERVICE_ROLE|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|AUTH)`,
  "i",
);

const markers = [
  {
    label: "private database URL marker",
    value: privateDatabaseUrlEnvName,
  },
  ...Object.entries(process.env)
    .filter(([name, value]) => {
      if (name.startsWith("PUBLIC_")) {
        return false;
      }

      return sensitiveNamePattern.test(name) && typeof value === "string" && value.length >= 8;
    })
    .flatMap(([name, value]) => [
      {
        label: `${name} raw value`,
        value,
      },
      {
        label: `${name} encoded value`,
        value: encodeURIComponent(value),
      },
    ])
    .filter((marker) => marker.value.length >= 8),
];

try {
  await stat(distDir);
} catch {
  console.error("dist/ does not exist. Run npm run build before verify:dist-secrets.");
  process.exit(1);
}

const files = await listFiles(distDir);
const findings = [];

for (const filePath of files) {
  const content = await readFile(filePath);

  for (const marker of markers) {
    if (content.includes(Buffer.from(marker.value))) {
      findings.push({
        filePath,
        label: marker.label,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret verification failed. Sensitive markers were found in dist/:");

  for (const finding of findings) {
    console.error(`- ${path.relative(rootDir, finding.filePath)}: ${finding.label}`);
  }

  process.exit(1);
}

console.log(`Secret verification passed across ${files.length} dist files.`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

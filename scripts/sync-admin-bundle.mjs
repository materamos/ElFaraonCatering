import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const archivePath = path.resolve("vendor/decap-cms-3.10.1.tgz");
const outputDirectory = path.resolve("public/admin");
const outputBundlePath = path.join(outputDirectory, "decap-cms-3.10.1.js");
const outputLicensePath = path.join(outputDirectory, "decap-cms-3.10.1.js.LICENSE.txt");

const tempDirectory = await mkdtemp(path.join(tmpdir(), "decap-cms-"));

try {
  execFileSync("tar", ["-xf", archivePath, "-C", tempDirectory], { stdio: "ignore" });

  await mkdir(outputDirectory, { recursive: true });
  await cp(path.join(tempDirectory, "package/dist/decap-cms.js"), outputBundlePath);
  await cp(
    path.join(tempDirectory, "package/dist/decap-cms.js.LICENSE.txt"),
    outputLicensePath,
  );
} catch (error) {
  console.error("Failed to sync the local Decap CMS bundle from vendor/decap-cms-3.10.1.tgz.");
  throw error;
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

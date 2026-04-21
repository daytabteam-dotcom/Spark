import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envFiles = findEnvFiles(process.cwd());

for (const filePath of envFiles) {
  if (!existsSync(filePath)) continue;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

function findEnvFiles(startDir: string) {
  const files: string[] = [];
  let currentDir = path.resolve(startDir);

  while (true) {
    files.push(path.join(currentDir, ".env"));
    files.push(path.join(currentDir, ".env.local"));

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return files;
}

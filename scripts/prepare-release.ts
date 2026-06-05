import { promises as fs } from "node:fs";
import path from "node:path";

const requiredFiles = ["README.md", "CHANGELOG.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"];

for (const file of requiredFiles) {
  await fs.access(path.resolve(file));
}

console.log("Release checklist files are present.");

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const pluginsDir = "./sources";
const distDir = "./dist";
const manifestPath = "./manifest.json";

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

const manifests = [];

for (const plugin of fs.readdirSync(pluginsDir)) {
  const pluginPath = path.join(pluginsDir, plugin);
  const manifestFile = path.join(pluginPath, "manifest.json");
  const entryFile = path.join(pluginPath, "index.js");
  const outFile = path.join(distDir, `${plugin}.compact.js`);

  if (fs.existsSync(manifestFile) && fs.existsSync(entryFile)) {
    console.log(`📦 Building plugin: ${plugin}`);

    // Transpile with Babel
    execSync(`npx babel ${entryFile} --out-file ${outFile}`, { stdio: "inherit" });

    // Minify with Terser
    execSync(`npx terser ${outFile} -o ${outFile}`, { stdio: "inherit" });

    // Add manifest entry
    const data = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    manifests.push({
      ...data,
      dist: `dist/${plugin}.compact.js`
    });
  }
}

// Write global manifest
fs.writeFileSync(manifestPath, JSON.stringify({ plugins: manifests }, null, 2));
console.log("✅ manifest.json updated");

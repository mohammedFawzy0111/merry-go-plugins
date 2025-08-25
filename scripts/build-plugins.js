import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const pluginsDir = "./plugins"; // Changed from "./sources" to "./plugins"
const distDir = "./dist";
const manifestPath = "./manifest.json";

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

const manifests = [];

// Read all plugin directories
const pluginDirs = fs.readdirSync(pluginsDir).filter(dir => {
  return fs.statSync(path.join(pluginsDir, dir)).isDirectory();
});

for (const plugin of pluginDirs) {
  const pluginPath = path.join(pluginsDir, plugin);
  const manifestFile = path.join(pluginPath, "manifest.json");
  const entryFile = path.join(pluginPath, "index.js");
  const outFile = path.join(distDir, `${plugin}.compat.js`); // Fixed extension

  if (fs.existsSync(manifestFile) && fs.existsSync(entryFile)) {
    console.log(`📦 Building plugin: ${plugin}`);

    try {
      // Transpile with Babel using config file
      execSync(`npx babel ${entryFile} --config-file ./babel.config.json --out-file ${outFile}`, { 
        stdio: "inherit" 
      });

      // Minify with Terser
      execSync(`npx terser ${outFile} -o ${outFile}`, { stdio: "inherit" });

      // Add manifest entry
      const data = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      const id = data.id || data.name.toLowerCase().split(" ").join("_");
      
      manifests.push({
        id,
        ...data,
        entryPoint: `https://raw.githubusercontent.com/mohammedFawzy0111/merry-go-plugins/main/dist/${plugin}.compat.js`
      });
      
      console.log(`✅ Built: ${plugin}`);
    } catch (error) {
      console.error(`❌ Failed to build ${plugin}:`, error.message);
    }
  }
}

// Write global manifest
fs.writeFileSync(manifestPath, JSON.stringify({ plugins: manifests }, null, 2));
console.log("✅ manifest.json updated");
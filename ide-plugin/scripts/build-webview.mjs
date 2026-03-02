import * as esbuild from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const watch = process.argv.includes("--watch");
const root = process.cwd();
const outDir = path.join(root, "dist", "webview");

await mkdir(outDir, { recursive: true });

const commonConfig = {
  entryPoints: [path.join(root, "src", "webview", "app.tsx")],
  outfile: path.join(outDir, "app.js"),
  bundle: true,
  format: "iife",
  minify: false,
  sourcemap: true,
  target: ["es2020"],
  loader: {
    ".ts": "ts",
    ".tsx": "tsx"
  }
};

if (watch) {
  const context = await esbuild.context(commonConfig);
  await context.watch();
  console.log("watching webview bundle...");
} else {
  await esbuild.build(commonConfig);
}

await copyFile(path.join(root, "src", "webview", "index.html"), path.join(outDir, "index.html"));

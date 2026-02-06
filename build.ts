#!/usr/bin/env bun

const bundle = await Bun.build({
  entrypoints: ["src/cli.ts"],
  outdir: "dist",
  target: "bun",
  minify: true,
  external: ["yaml", "toml", "ini"],
  compile: {
    outfile: "catalog",
    autoloadDotenv: false,
    autoloadBunfig: false,
  },
});

if (!bundle.success) {
  console.error("Bundle failed:");
  for (const log of bundle.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Built", bundle.outputs);

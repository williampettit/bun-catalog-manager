import { Command as PlatformCommand } from "@effect/platform";
import { FileSystem, Path } from "@effect/platform";
import { Effect, Either, Schema as S } from "effect";

import {
  PackageJson,
  PackageJsonFromString,
  PackageVersion,
  type PackageJsonPath,
  type PackageName,
} from "./types";

// =============================================================================
// Helper Functions
// =============================================================================

export const getLatestPackageVersion = Effect.fn(function*(packageName: PackageName) {
  return yield* PlatformCommand.make(
    "bun",
    ...[
      "info",
      packageName,
      "version",
    ],
  ).pipe(
    PlatformCommand.workingDirectory("."),
    PlatformCommand.string,
    Effect.map((version) => PackageVersion.make(version.trim())),
  );
});

export const loadPackageJson = Effect.fn(function*(packageJsonPath: PackageJsonPath) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(packageJsonPath, "utf-8");
  return yield* S.decode(PackageJsonFromString, { errors: "all" })(content);
});

export const savePackageJson = Effect.fn(function*(packageJson: PackageJson) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const content = `${JSON.stringify(packageJson, null, 2)}\n`;
  yield* fs.writeFileString(packageJsonPath, content);
});

import { FileSystem } from "@effect/platform";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";

import { PackageJsonPath, PackageName, PackageVersion } from "../src/types";
import { loadPackageJson, savePackageJson } from "../src/utils";

import {
  makeInMemoryFs,
  MockPathLayer,
  samplePackageJson,
  samplePackageJsonString,
} from "./fixtures";

// =============================================================================
// Tests: loadPackageJson
// =============================================================================

describe("loadPackageJson", () => {
  const testPath = PackageJsonPath.make("/repo/package.json");

  const FsLayer = Layer.effect(
    FileSystem.FileSystem,
    makeInMemoryFs({ [testPath]: samplePackageJsonString }).pipe(
      Effect.map(({ fs }) => fs),
    ),
  );

  layer(FsLayer)("with in-memory FS", (it) => {
    it.effect("reads and decodes package.json", () =>
      Effect.gen(function*() {
        const pkg = yield* loadPackageJson(testPath);
        expect(pkg).toEqual(samplePackageJson);
      }));

    it.effect("preserves extra fields", () =>
      Effect.gen(function*() {
        const pkg = yield* loadPackageJson(testPath);
        // Extra fields captured by the index signature
        expect(pkg["name"]).toBe(samplePackageJson.name);
        expect(pkg["scripts"]).toEqual(samplePackageJson.scripts);
      }));
  });
});

// =============================================================================
// Tests: savePackageJson (field preservation)
// =============================================================================

describe("savePackageJson", () => {
  it.effect("writes valid JSON with all fields", () =>
    Effect.gen(function*() {
      const { fs, store } = yield* makeInMemoryFs({});

      const testLayer = Layer.mergeAll(
        Layer.succeed(FileSystem.FileSystem, fs),
        MockPathLayer,
      );

      yield* savePackageJson(
        {
          name: "test-proj",
          version: "2.0.0",
          workspaces: {
            packages: [
              "apps/*",
            ],
            catalog: {
              [PackageName.make("package-e")]: PackageVersion.make("~4.0.0"),
            },
            catalogs: {},
          },
        },
      ).pipe(Effect.provide(testLayer));

      const written = yield* Ref.get(store);
      const content = [...written.values()][0]!;
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe("test-proj");
      expect(parsed.version).toBe("2.0.0");
      expect(parsed.workspaces.catalog["package-e"]).toBe("~4.0.0");
      // Ends with newline
      expect(content.endsWith("\n")).toBe(true);
    }));
});

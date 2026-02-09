import { FileSystem } from "@effect/platform";
import { describe, it, layer } from "@effect/vitest";
import { assertEquals, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import { Effect, Layer, Ref } from "effect";

import { PackageJsonPath } from "../src/types";
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
    it.effect("reads and decodes package.json and preserves extra fields", () =>
      Effect.gen(function*() {
        const pkg = yield* loadPackageJson(testPath);
        deepStrictEqual(pkg, samplePackageJson);
        assertEquals(pkg["workspaces"]["customField"], "keep-me");
      }));
  });
});

// =============================================================================
// Tests: savePackageJson (field preservation)
// =============================================================================

describe("savePackageJson", () => {
  it.effect("writes valid JSON with all fields", () =>
    Effect.gen(function*() {
      const { store, fsLayer } = yield* makeInMemoryFs({});

      const testLayer = Layer.mergeAll(
        fsLayer,
        MockPathLayer,
      );

      yield* savePackageJson(samplePackageJson).pipe(
        Effect.provide(testLayer),
      );

      const written = yield* Ref.get(store);
      const content = [...written.values()][0]!;
      const parsed = JSON.parse(content) as unknown;
      deepStrictEqual(parsed, samplePackageJson);
      assertTrue(content.endsWith("\n"), "should end with newline");
    }));
});

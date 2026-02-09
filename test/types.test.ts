import { describe, it } from "@effect/vitest";
import {
  assertEquals,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
} from "@effect/vitest/utils";
import { Effect, ParseResult, Schema as S } from "effect";

import {
  CatalogName,
  PackageJsonFromString,
  PackageSpec,
  PackageVersion,
  VersionSpec,
} from "../src/types";
import { samplePackageJson, samplePackageJsonString } from "./fixtures";

// =============================================================================
// PackageSpec
// =============================================================================

describe("PackageSpec", () => {
  const decode = S.decode(PackageSpec);
  const encode = S.encode(PackageSpec);

  it.effect("decodes name@version", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a@latest");
      assertEquals(result.packageName, "package-a");
      assertSome(result.packageVersion, PackageVersion.make("latest"));
    }));

  it.effect("decodes bare name", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a");
      assertEquals(result.packageName, "package-a");
      assertNone(result.packageVersion);
    }));

  it.effect("decodes scoped package with version", () =>
    Effect.gen(function*() {
      const result = yield* decode("@org/package-b@^1.0.0");
      assertEquals(result.packageName, "@org/package-b");
      assertSome(result.packageVersion, PackageVersion.make("^1.0.0"));
    }));

  it.effect("decodes scoped package without version", () =>
    Effect.gen(function*() {
      const result = yield* decode("@org/package-b");
      assertEquals(result.packageName, "@org/package-b");
      assertNone(result.packageVersion);
    }));

  it.effect("roundtrips name@version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a@latest");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "package-a@latest");
    }));

  it.effect("roundtrips bare name", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "package-a");
    }));

  it.effect("roundtrips scoped package with version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("@org/package-b@^1.0.0");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "@org/package-b@^1.0.0");
    }));

  it.effect("roundtrips scoped package without version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("@org/package-b");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "@org/package-b");
    }));

  it.effect("fails on empty string", () =>
    Effect.gen(function*() {
      const result = yield* decode("").pipe(Effect.flip);
      assertTrue(ParseResult.isParseError(result));
    }));
});

// =============================================================================
// VersionSpec
// =============================================================================

describe("VersionSpec", () => {
  const decode = S.decode(VersionSpec);
  const encode = S.encode(VersionSpec);

  it.effect("decodes name:catalog", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a:misc");
      assertEquals(result.packageName, "package-a");
      assertSome(result.catalogName, CatalogName.make("misc"));
    }));

  it.effect("decodes bare name", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a");
      assertEquals(result.packageName, "package-a");
      assertNone(result.catalogName);
    }));

  it.effect("roundtrips name:catalog", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a:misc");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "package-a:misc");
    }));

  it.effect("roundtrips bare name", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a");
      const encoded = yield* encode(decoded);
      assertEquals(encoded, "package-a");
    }));

  it.effect("fails on empty string", () =>
    Effect.gen(function*() {
      const result = yield* decode("").pipe(Effect.flip);
      assertTrue(ParseResult.isParseError(result));
    }));
});

// =============================================================================
// PackageJsonFromString
// =============================================================================

describe("PackageJsonFromString", () => {
  const decode = S.decode(PackageJsonFromString, { errors: "all" });
  const encode = S.encode(PackageJsonFromString);

  it.effect("decodes valid JSON", () =>
    Effect.gen(function*() {
      const result = yield* decode(samplePackageJsonString);
      deepStrictEqual(result.workspaces.catalog, samplePackageJson.workspaces.catalog);
      deepStrictEqual(result.workspaces.catalogs, samplePackageJson.workspaces.catalogs);
      deepStrictEqual(result.workspaces.packages, samplePackageJson.workspaces.packages);
    }));

  it.effect("preserves extra fields through roundtrip", () =>
    Effect.gen(function*() {
      const decoded = yield* decode(samplePackageJsonString);
      const encoded = yield* encode(decoded);
      const parsed = JSON.parse(encoded) as unknown;
      deepStrictEqual(parsed, samplePackageJson);
    }));

  it.effect("fails on invalid JSON", () =>
    Effect.gen(function*() {
      const result = yield* decode("not json").pipe(Effect.flip);
      assertTrue(ParseResult.isParseError(result));
    }));

  it.effect("fails when workspaces is missing", () =>
    Effect.gen(function*() {
      const result = yield* decode(JSON.stringify({ name: "x" })).pipe(Effect.flip);
      assertTrue(ParseResult.isParseError(result));
    }));
});

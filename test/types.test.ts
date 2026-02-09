import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, ParseResult, Schema as S } from "effect";

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
      expect(result.packageName).toBe("package-a");
      expect(result.packageVersion).toEqual(Option.some(PackageVersion.make("latest")));
    }));

  it.effect("decodes bare name", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a");
      expect(result.packageName).toBe("package-a");
      expect(result.packageVersion).toEqual(Option.none());
    }));

  it.effect("decodes scoped package with version", () =>
    Effect.gen(function*() {
      const result = yield* decode("@org/package-b@^1.0.0");
      expect(result.packageName).toBe("@org/package-b");
      expect(result.packageVersion).toEqual(Option.some(PackageVersion.make("^1.0.0")));
    }));

  it.effect("decodes scoped package without version", () =>
    Effect.gen(function*() {
      const result = yield* decode("@org/package-b");
      expect(result.packageName).toBe("@org/package-b");
      expect(result.packageVersion).toEqual(Option.none());
    }));

  it.effect("roundtrips name@version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a@latest");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("package-a@latest");
    }));

  it.effect("roundtrips bare name", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("package-a");
    }));

  it.effect("roundtrips scoped package with version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("@org/package-b@^1.0.0");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("@org/package-b@^1.0.0");
    }));

  it.effect("roundtrips scoped package without version", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("@org/package-b");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("@org/package-b");
    }));

  it.effect("fails on empty string", () =>
    Effect.gen(function*() {
      const result = yield* decode("").pipe(Effect.flip);
      expect(ParseResult.isParseError(result)).toBe(true);
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
      expect(result.packageName).toBe("package-a");
      expect(result.catalogName).toEqual(Option.some(CatalogName.make("misc")));
    }));

  it.effect("decodes bare name", () =>
    Effect.gen(function*() {
      const result = yield* decode("package-a");
      expect(result.packageName).toBe("package-a");
      expect(result.catalogName).toEqual(Option.none());
    }));

  it.effect("roundtrips name:catalog", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a:misc");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("package-a:misc");
    }));

  it.effect("roundtrips bare name", () =>
    Effect.gen(function*() {
      const decoded = yield* decode("package-a");
      const encoded = yield* encode(decoded);
      expect(encoded).toBe("package-a");
    }));

  it.effect("fails on empty string", () =>
    Effect.gen(function*() {
      const result = yield* decode("").pipe(Effect.flip);
      expect(ParseResult.isParseError(result)).toBe(true);
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
      expect(result.workspaces.catalog).toEqual(samplePackageJson.workspaces.catalog);
      expect(result.workspaces.catalogs).toEqual(samplePackageJson.workspaces.catalogs);
      expect(result.workspaces.packages).toEqual(samplePackageJson.workspaces.packages);
    }));

  it.effect("preserves extra fields through roundtrip", () =>
    Effect.gen(function*() {
      const decoded = yield* decode(samplePackageJsonString);
      const encoded = yield* encode(decoded);
      const parsed = JSON.parse(encoded) as unknown;
      expect(parsed).toEqual(samplePackageJson);
    }));

  it.effect("fails on invalid JSON", () =>
    Effect.gen(function*() {
      const result = yield* decode("not json").pipe(Effect.flip);
      expect(ParseResult.isParseError(result)).toBe(true);
    }));

  it.effect("fails when workspaces is missing", () =>
    Effect.gen(function*() {
      const result = yield* decode(JSON.stringify({ name: "x" })).pipe(Effect.flip);
      expect(ParseResult.isParseError(result)).toBe(true);
    }));
});

import { describe, expect, it } from "@effect/vitest";
import { Console, Effect, Layer, Option } from "effect";

import { addPackageToCatalog, installPackageToWorkspace, listCatalog } from "../src/core";
import {
  CatalogName,
  PackageJson,
  PackageJsonPath,
  PackageName,
  PackageVersion,
  WorkspacePath,
} from "../src/types";

import {
  makeCapturingConsole,
  makeInMemoryFs,
  makeMockCommandExecutor,
  MockPathLayer,
  MockTerminalLayer,
  readSaved,
  samplePackageJsonString,
} from "./fixtures";

// =============================================================================
// Tests: addPackageToCatalog
// =============================================================================

describe("addPackageToCatalog", () => {
  const testPath = PackageJsonPath.make("/repo/package.json");

  const makeTestLayers = ({ versionOutput = "18.0.0\n" }: { versionOutput?: string; } = {}) =>
    Effect.gen(function*() {
      const { store, fsLayer } = yield* makeInMemoryFs({
        [testPath]: samplePackageJsonString,
      });
      const { mockConsole, getOutput } = yield* makeCapturingConsole;

      const layer = Layer.mergeAll(
        fsLayer,
        MockPathLayer,
        MockTerminalLayer,
        makeMockCommandExecutor(versionOutput),
        Console.setConsole(mockConsole),
      );

      return { layer, store, getOutput } as const;
    });

  it.effect("adds package to default catalog", () =>
    Effect.gen(function*() {
      const { layer: testLayer, store, getOutput } = yield* makeTestLayers();

      yield* addPackageToCatalog({
        packageJsonPath: testPath,
        packageSpec: {
          packageName: PackageName.make("package-e"),
          packageVersion: Option.some(PackageVersion.make("^3.0.0")),
        },
        catalogName: Option.none(),
      }).pipe(Effect.provide(testLayer));

      const saved = yield* readSaved(store, PackageJson);

      expect(saved.workspaces.catalog[PackageName.make("package-e")]).toBe(
        PackageVersion.make("^3.0.0"),
      );
      // Existing entries preserved
      expect(saved.workspaces.catalog[PackageName.make("package-a")]).toBe(
        PackageVersion.make("^1.0.0"),
      );
      expect(saved.workspaces.catalog[PackageName.make("package-b")]).toBe(
        PackageVersion.make("2.0.0"),
      );
      expect(saved.workspaces.catalog[PackageName.make("@org/package-c")]).toBe(
        PackageVersion.make("^3.0.0"),
      );

      const output = yield* getOutput;
      expect(output).toContain("package-e");
      expect(output).toContain("^3.0.0");
      expect(output).toContain("default");
    }));

  it.effect("preserves all non-workspace fields", () =>
    Effect.gen(function*() {
      const { layer: testLayer, store } = yield* makeTestLayers();

      yield* addPackageToCatalog({
        packageJsonPath: testPath,
        packageSpec: {
          packageName: PackageName.make("package-e"),
          packageVersion: Option.some(PackageVersion.make("^3.0.0")),
        },
        catalogName: Option.none(),
      }).pipe(Effect.provide(testLayer));

      const saved = yield* readSaved(store, PackageJson);
      expect(saved["name"]).toBe("my-monorepo");
      expect(saved["version"]).toBe("1.0.0");
      expect(saved["private"]).toBe(true);
      expect(saved["scripts"]).toEqual({ build: "tsc", test: "vitest" });
    }));

  it.effect("adds package to named catalog", () =>
    Effect.gen(function*() {
      const { layer: testLayer, store, getOutput } = yield* makeTestLayers();

      yield* addPackageToCatalog({
        packageJsonPath: testPath,
        packageSpec: {
          packageName: PackageName.make("package-f"),
          packageVersion: Option.some(PackageVersion.make("^4.0.0")),
        },
        catalogName: Option.some(CatalogName.make("misc")),
      }).pipe(Effect.provide(testLayer));

      const saved = yield* readSaved(store, PackageJson);
      expect(
        saved.workspaces.catalogs[CatalogName.make("misc")]?.[PackageName.make("package-f")],
      ).toBe(PackageVersion.make("^4.0.0"));
      // Existing entry in same catalog preserved
      expect(
        saved.workspaces.catalogs[CatalogName.make("misc")]?.[PackageName.make("package-d")],
      ).toBe(PackageVersion.make("~2.0.0"));
      // Default catalog untouched
      expect(saved.workspaces.catalog[PackageName.make("package-a")]).toBe(
        PackageVersion.make("^1.0.0"),
      );

      const output = yield* getOutput;
      expect(output).toContain("package-f");
      expect(output).toContain("^4.0.0");
      expect(output).toContain("misc");
    }));

  it.effect("fetches latest version when none provided", () =>
    Effect.gen(function*() {
      const { layer: testLayer, store, getOutput } = yield* makeTestLayers({
        versionOutput: "5.1.0\n",
      });

      yield* addPackageToCatalog({
        packageJsonPath: testPath,
        packageSpec: {
          packageName: PackageName.make("package-e"),
          packageVersion: Option.none(),
        },
        catalogName: Option.none(),
      }).pipe(Effect.provide(testLayer));

      const saved = yield* readSaved(store, PackageJson);
      expect(saved.workspaces.catalog[PackageName.make("package-e")]).toBe(
        PackageVersion.make("5.1.0"),
      );

      const output = yield* getOutput;
      expect(output).toContain("package-e");
      expect(output).toContain("5.1.0");
      expect(output).toContain("default");
    }));

  it.effect("fails with CatalogNotFound for nonexistent catalog", () =>
    Effect.gen(function*() {
      const { layer: testLayer } = yield* makeTestLayers();

      const result = yield* addPackageToCatalog({
        packageJsonPath: testPath,
        packageSpec: {
          packageName: PackageName.make("package-a"),
          packageVersion: Option.some(PackageVersion.make("^1.0.0")),
        },
        catalogName: Option.some(CatalogName.make("nonexistent")),
      }).pipe(Effect.provide(testLayer), Effect.flip);

      expect(result._tag).toBe("CatalogNotFound");
      expect(result.message).toContain("nonexistent");
    }));
});

// =============================================================================
// Tests: listCatalog
// =============================================================================

describe("listCatalog", () => {
  const testPath = PackageJsonPath.make("/repo/package.json");

  const makeListLayers = Effect.gen(function*() {
    const { fsLayer } = yield* makeInMemoryFs({ [testPath]: samplePackageJsonString });
    const { mockConsole, getOutput } = yield* makeCapturingConsole;

    const testLayer = Layer.mergeAll(
      fsLayer,
      MockPathLayer,
      MockTerminalLayer,
      makeMockCommandExecutor("1.0.0"),
      Console.setConsole(mockConsole),
    );

    return { testLayer, getOutput } as const;
  });

  it.effect("lists all catalogs when no name given", () =>
    Effect.gen(function*() {
      const { testLayer, getOutput } = yield* makeListLayers;

      yield* listCatalog({ packageJsonPath: testPath, catalogName: Option.none() }).pipe(
        Effect.provide(testLayer),
      );

      const output = yield* getOutput;
      // Default catalog entries
      expect(output).toContain("package-a");
      expect(output).toContain("package-b");
      expect(output).toContain("@org/package-c");
      // Named catalog entries
      expect(output).toContain("package-d");
    }));

  it.effect("lists a specific named catalog", () =>
    Effect.gen(function*() {
      const { testLayer, getOutput } = yield* makeListLayers;

      yield* listCatalog({
        packageJsonPath: testPath,
        catalogName: Option.some(CatalogName.make("misc")),
      }).pipe(Effect.provide(testLayer));

      const output = yield* getOutput;
      expect(output).toContain("package-d");
      // Should only contain the requested catalog, not default
      expect(output).not.toContain("package-a");
    }));

  it.effect("fails with CatalogNotFound for unknown catalog", () =>
    Effect.gen(function*() {
      const { testLayer } = yield* makeListLayers;

      const result = yield* listCatalog({
        packageJsonPath: testPath,
        catalogName: Option.some(CatalogName.make("nonexistent")),
      }).pipe(Effect.provide(testLayer), Effect.flip);

      expect(result._tag).toBe("CatalogNotFound");
      expect(result.message).toContain("nonexistent");
    }));
});

// =============================================================================
// Tests: installPackageToWorkspace
// =============================================================================

describe("installPackageToWorkspace", () => {
  const makeInstallLayers = Effect.gen(function*() {
    const { mockConsole, getOutput } = yield* makeCapturingConsole;

    const testLayer = Layer.mergeAll(
      makeMockCommandExecutor("installed package-a@catalog:"),
      Console.setConsole(mockConsole),
    );

    return { testLayer, getOutput } as const;
  });

  it.effect("prints package name, catalog, and workspace path", () =>
    Effect.gen(function*() {
      const { testLayer, getOutput } = yield* makeInstallLayers;

      yield* installPackageToWorkspace({
        versionSpec: {
          packageName: PackageName.make("package-a"),
          catalogName: Option.some(CatalogName.make("misc")),
        },
        workspacePath: WorkspacePath.make("packages/app"),
        saveDev: false,
      }).pipe(Effect.provide(testLayer));

      const output = yield* getOutput;
      expect(output).toContain("package-a");
      expect(output).toContain("misc");
      expect(output).toContain("packages/app");
    }));

  it.effect("prints default catalog when none specified", () =>
    Effect.gen(function*() {
      const { testLayer, getOutput } = yield* makeInstallLayers;

      yield* installPackageToWorkspace({
        versionSpec: {
          packageName: PackageName.make("package-b"),
          catalogName: Option.none(),
        },
        workspacePath: WorkspacePath.make("packages/lib"),
        saveDev: true,
      }).pipe(Effect.provide(testLayer));

      const output = yield* getOutput;
      expect(output).toContain("package-b");
      expect(output).toContain("packages/lib");
      expect(output).toContain("dev dependency");
    }));
});

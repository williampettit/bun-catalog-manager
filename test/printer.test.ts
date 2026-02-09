import { describe, it } from "@effect/vitest";
import { assertInclude } from "@effect/vitest/utils";
import { Console, Effect, Option } from "effect";

import { printAddedPackage, printCatalog, printInstalledPackage } from "../src/printer";
import {
  CatalogName,
  PackageName,
  PackageVersion,
  WorkspacePath,
  type Catalogs,
  type VersionSpec,
} from "../src/types";

import { makeCapturingConsole } from "./fixtures";

const layerWithConsole = (mockConsole: Console.Console) => Console.setConsole(mockConsole);

describe("printer", () => {
  it.effect("printCatalog: empty section (emptyBoxRow) and tight pkgRow (gap <= 2)", () =>
    Effect.gen(function*() {
      const { mockConsole, getOutput } = yield* makeCapturingConsole;
      const catalogs: Catalogs = {
        [CatalogName.make("empty")]: {},
        [CatalogName.make("default")]: {
          [PackageName.make("long-package-name")]: PackageVersion.make("1"),
        },
      };
      yield* printCatalog(catalogs, 25).pipe(
        Effect.provide(layerWithConsole(mockConsole)),
      );
      const out = yield* getOutput;
      assertInclude(out, "(empty)");
      assertInclude(out, "long-package-name");
      assertInclude(out, "1");
    }));

  it.effect("printAddedPackage: catalogName Option.none uses default", () =>
    Effect.gen(function*() {
      const { mockConsole, getOutput } = yield* makeCapturingConsole;
      yield* printAddedPackage(
        PackageName.make("pkg"),
        PackageVersion.make("1.0.0"),
        Option.none(),
      ).pipe(Effect.provide(layerWithConsole(mockConsole)));
      const out = yield* getOutput;
      assertInclude(out, "default");
      assertInclude(out, "pkg");
      assertInclude(out, "1.0.0");
    }));

  it.effect("printInstalledPackage: with and without catalogName", () =>
    Effect.gen(function*() {
      const { mockConsole, getOutput } = yield* makeCapturingConsole;
      const withCatalog: VersionSpec = {
        packageName: PackageName.make("pkg"),
        catalogName: Option.some(CatalogName.make("cat")),
      };
      const withoutCatalog: VersionSpec = {
        packageName: PackageName.make("pkg"),
        catalogName: Option.none(),
      };
      yield* printInstalledPackage(
        withCatalog,
        WorkspacePath.make("packages/app"),
        false,
      ).pipe(Effect.provide(layerWithConsole(mockConsole)));
      let out = yield* getOutput;
      assertInclude(out, "cat");

      yield* printInstalledPackage(
        withoutCatalog,
        WorkspacePath.make("packages/lib"),
        true,
      ).pipe(Effect.provide(layerWithConsole(mockConsole)));
      out = yield* getOutput;
      assertInclude(out, "(as a dev dependency)");
    }));
});

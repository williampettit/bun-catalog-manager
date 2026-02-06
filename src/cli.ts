#!/usr/bin/env bun

/**
 * Script for managing your Bun package catalog.
 *
 * Setup
 * -----
 * In your package.json, add the following:
 * ```json
 * "scripts": {
 *   "catalog": "bun run scripts/catalog.ts"
 * }
 * ```
 *
 * Usage
 * -----
 *
 * Add a package to the catalog:
 * ```sh
 * bun catalog add <package-name>[@<version>] [catalog-name]
 * ```
 *
 * Install a package from the catalog to a specific workspace:
 * ```sh
 * bun catalog install [-d,--save-dev] [<catalog-name>:]<package-name> <workspace-name>
 * ```
 *
 * List all packages in the catalog:
 * ```sh
 * bun catalog ls [catalog-name]
 * ```
 */

import { Args, CliConfig, Command, Options, Span } from "@effect/cli";
import { Path } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Option } from "effect";

import { version as VERSION } from "../package.json";
import { addPackageToCatalog, installPackageToWorkspace, listCatalog } from "./core";
import { CatalogName, PackageJsonPath, PackageSpec, VersionSpec, WorkspacePath } from "./types";

// =============================================================================
// Commands
// =============================================================================

const packageJsonPath = Options.file("package-json", { exists: "yes" }).pipe(
  Options.withDescription("The path to the package.json file to use."),
  Options.optional,
  Options.mapEffect(
    Option.match({
      onSome: (path) => Effect.succeed(path),
      onNone: () =>
        Effect.gen(function*() {
          const path = yield* Path.Path;
          return path.join(process.cwd(), "package.json");
        }),
    }),
  ),
  Options.withSchema(PackageJsonPath),
);

const add = Command.make("add", {
  packageJsonPath,
  packageSpec: Args.text({ name: "package-spec" }).pipe(
    Args.withDescription("The package to add to the catalog. Example: react@latest"),
    Args.withSchema(PackageSpec),
  ),
  catalogName: Args.text({ name: "catalog" }).pipe(
    Args.withDescription("The catalog to add the package to. Example: ui"),
    Args.withSchema(CatalogName),
    Args.optional,
  ),
}).pipe(
  Command.withDescription("Add a package to the catalog."),
  Command.withHandler(addPackageToCatalog),
);

const install = Command.make("install", {
  saveDev: Options.boolean("save-dev").pipe(
    Options.withDescription("Save the package as a dev dependency."),
    Options.withDefault(false),
    Options.withAlias("d"),
  ),
  versionSpec: Args.text({ name: "version-spec" }).pipe(
    Args.withDescription("The package to install from the catalog. Example: react:ui"),
    Args.withSchema(VersionSpec),
  ),
  workspacePath: Args.directory({ name: "workspace", exists: "yes" }).pipe(
    Args.withDescription("The path to the workspace to install the package to. Example: apps/web"),
    Args.withSchema(WorkspacePath),
  ),
}).pipe(
  Command.withDescription("Install a package from the catalog to a specific workspace."),
  Command.withHandler(installPackageToWorkspace),
);

const ls = Command.make("ls", {
  packageJsonPath,
  catalogName: Args.text({ name: "catalog" }).pipe(
    Args.withDescription("The catalog to list the packages from. Example: ui"),
    Args.withSchema(CatalogName),
    Args.optional,
  ),
}).pipe(
  Command.withDescription("List all packages in the catalog."),
  Command.withHandler(listCatalog),
);

export const cli = Command.make("catalog").pipe(
  Command.withSubcommands([
    add,
    install,
    ls,
  ]),
  Command.run({
    name: "Bun Catalog Manager",
    version: VERSION,
    summary: Span.text("Manage your Bun package catalog."),
  }),
);

// =============================================================================
// Entry Point
// =============================================================================

if (import.meta.main) {
  cli(process.argv).pipe(
    Effect.tap(() => Console.log("Bun Catalog Manager", VERSION)),
    Effect.tapError(() => Console.log("Bun Catalog Manager", VERSION)),
    Effect.provide(CliConfig.layer({ showTypes: false, showBuiltIns: false })),
    Effect.provide(BunContext.layer),
    Effect.catchTags({
      CatalogNotFound: (error) => Console.error(error.message),
      ParseError: (error) => Console.error(error.message),
    }),
    BunRuntime.runMain,
  );
}

import { Command as PlatformCommand, Terminal } from "@effect/platform";
import { Console, Effect, Number as Num, Option, Record as R } from "effect";

import { CatalogNotFound } from "./errors";
import { printAddedPackage, printCatalog, printInstalledPackage } from "./printer";
import {
  Catalog,
  CatalogName,
  PackageJsonPath,
  PackageSpec,
  VersionSpec,
  WorkspacePath,
  Workspaces,
} from "./types";
import { getLatestPackageVersion, loadPackageJson, savePackageJson } from "./utils";

// =============================================================================
// Core Handlers
// =============================================================================

interface ListCatalogParams {
  readonly packageJsonPath: PackageJsonPath;
  readonly catalogName: Option.Option<CatalogName>;
}

export const listCatalog = Effect.fn(
  function*({ packageJsonPath, catalogName }: ListCatalogParams) {
    const packageJson = yield* loadPackageJson(packageJsonPath);
    const terminal = yield* Terminal.Terminal;
    const termCols = yield* terminal.columns.pipe(
      Effect.map((cols) => cols > 0 ? cols : 80),
    );

    let catalogs: ReadonlyArray<readonly [CatalogName, Catalog]>;

    if (Option.isNone(catalogName)) {
      catalogs = [
        [CatalogName.make("default"), packageJson.workspaces.catalog],
        ...R.toEntries(packageJson.workspaces.catalogs).sort(([a], [b]) => a.localeCompare(b)),
      ];
    } else {
      const catalog = yield* R.get(packageJson.workspaces.catalogs, catalogName.value).pipe(
        Option.match({
          onNone: () => new CatalogNotFound({ name: catalogName.value }),
          onSome: (catalog) => Effect.succeed(catalog),
        }),
      );
      catalogs = [[catalogName.value, catalog]];
    }

    const lineWidth = Num.clamp(termCols, { minimum: 30, maximum: 80 });
    yield* printCatalog(catalogs, lineWidth);
  },
);

interface AddPackageToCatalogParams {
  readonly packageJsonPath: PackageJsonPath;
  readonly packageSpec: PackageSpec;
  readonly catalogName: Option.Option<CatalogName>;
}

export const addPackageToCatalog = Effect.fn(function*({
  packageJsonPath,
  packageSpec,
  catalogName,
}: AddPackageToCatalogParams) {
  const packageJson = yield* loadPackageJson(packageJsonPath);

  const packageVersion = yield* Option.match(packageSpec.packageVersion, {
    onNone: () => getLatestPackageVersion(packageSpec.packageName),
    onSome: (version) => Effect.succeed(version),
  });

  const nextWorkspaces: Workspaces = yield* Option.match(catalogName, {
    onNone: () =>
      Effect.succeed({
        ...packageJson.workspaces,
        catalog: {
          ...packageJson.workspaces.catalog,
          [packageSpec.packageName]: packageVersion,
        },
      }),
    onSome: (name) =>
      R.get(packageJson.workspaces.catalogs, name).pipe(
        Option.match({
          onNone: () => new CatalogNotFound({ name }),
          onSome: (catalog) =>
            Effect.succeed({
              ...packageJson.workspaces,
              catalogs: {
                ...packageJson.workspaces.catalogs,
                [name]: {
                  ...catalog,
                  [packageSpec.packageName]: packageVersion,
                },
              },
            }),
        }),
      ),
  });

  yield* savePackageJson({ ...packageJson, workspaces: nextWorkspaces });
  yield* printAddedPackage(packageSpec.packageName, packageVersion, catalogName);
});

interface InstallPackageToWorkspaceParams {
  readonly versionSpec: VersionSpec;
  readonly workspacePath: WorkspacePath;
  readonly saveDev: boolean;
}

export const installPackageToWorkspace = Effect.fn(function*({
  versionSpec,
  workspacePath,
  saveDev,
}: InstallPackageToWorkspaceParams) {
  yield* PlatformCommand.make(
    "bun",
    ...[
      "add",
      ...(saveDev ? ["-d"] : []),
      `${versionSpec.packageName}@catalog:${
        versionSpec.catalogName.pipe(Option.getOrElse(() => ""))
      }`,
    ],
  ).pipe(
    PlatformCommand.workingDirectory(workspacePath),
    PlatformCommand.string,
    Effect.map((output) => output.trim()),
  );

  yield* printInstalledPackage(versionSpec, workspacePath, saveDev);
});

import { Command as PlatformCommand, Terminal } from "@effect/platform";
import { Effect, Number as Num, Option, Record as R } from "effect";

import { CatalogNotFound } from "./errors";
import { printAddedPackage, printCatalog, printInstalledPackage } from "./printer";
import {
  CatalogName,
  type Catalogs,
  type PackageJsonPath,
  type PackageSpec,
  type VersionSpec,
  type WorkspacePath,
  type Workspaces,
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

    const catalogs: Catalogs = yield* Option.match(catalogName, {
      onNone: () =>
        Effect.succeed({
          [CatalogName.make("default")]: packageJson.workspaces.catalog,
          ...packageJson.workspaces.catalogs,
        }),
      onSome: (name) =>
        Option.match(R.get(packageJson.workspaces.catalogs, name), {
          onNone: () => new CatalogNotFound({ name }),
          onSome: (catalog) => Effect.succeed({ [name]: catalog }),
        }),
    });

    const lineWidth = yield* terminal.columns.pipe(
      Effect.map((cols) => Num.clamp(cols, { minimum: 30, maximum: 80 })),
    );

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

  const packageVersion = yield* packageSpec.packageVersion.pipe(
    Effect.orElse(() => getLatestPackageVersion(packageSpec.packageName)),
  );

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
      Option.match(R.get(packageJson.workspaces.catalogs, name), {
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
  const catalogName = Option.getOrElse(versionSpec.catalogName, () => "");
  const formattedPackage = `${versionSpec.packageName}@catalog:${catalogName}`;

  yield* PlatformCommand.make(
    "bun",
    "add",
    ...(saveDev ? ["-d"] : []),
    formattedPackage,
  ).pipe(
    PlatformCommand.workingDirectory(workspacePath),
    PlatformCommand.string,
  );

  yield* printInstalledPackage(versionSpec, workspacePath, saveDev);
});

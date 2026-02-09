import { Option, ParseResult, Schema as S } from "effect";

export const PackageName = S.NonEmptyTrimmedString.pipe(S.brand("PackageName")).annotations({
  identifier: "PackageName",
});
export type PackageName = S.Schema.Type<typeof PackageName>;

export const PackageVersion = S.NonEmptyTrimmedString.pipe(S.brand("PackageVersion")).annotations({
  identifier: "PackageVersion",
});
export type PackageVersion = S.Schema.Type<typeof PackageVersion>;

export const CatalogName = S.NonEmptyTrimmedString.pipe(S.brand("CatalogName")).annotations({
  identifier: "CatalogName",
});
export type CatalogName = S.Schema.Type<typeof CatalogName>;

export const WorkspacePath = S.NonEmptyTrimmedString.pipe(S.brand("WorkspacePath")).annotations({
  identifier: "WorkspacePath",
});
export type WorkspacePath = S.Schema.Type<typeof WorkspacePath>;

export const PackageJsonPath = S.String.pipe(S.brand("PackageJsonPath")).annotations({
  identifier: "PackageJsonPath",
});
export type PackageJsonPath = S.Schema.Type<typeof PackageJsonPath>;

export const Catalog = S.Record({ key: PackageName, value: PackageVersion }).annotations({
  identifier: "Catalog",
});
export type Catalog = S.Schema.Type<typeof Catalog>;

export const Catalogs = S.Record({ key: CatalogName, value: Catalog }).annotations({
  identifier: "Catalogs",
});
export type Catalogs = S.Schema.Type<typeof Catalogs>;

export const Workspaces = S.Struct(
  {
    packages: S.Array(S.NonEmptyTrimmedString),
    catalog: Catalog,
    catalogs: Catalogs,
  },
  // Allow excess properties
  S.Record({ key: S.String, value: S.Unknown }),
).annotations({
  identifier: "Workspaces",
  parseIssueTitle: () => "workspaces",
});
export type Workspaces = S.Schema.Type<typeof Workspaces>;

export const PackageJson = S.Struct(
  {
    workspaces: Workspaces,
  },
  // Allow excess properties
  S.Record({ key: S.String, value: S.Unknown }),
).annotations({
  identifier: "PackageJson",
  parseIssueTitle: () => "package.json",
  parseOptions: {
    onExcessProperty: "preserve",
    propertyOrder: "original",
  },
});
export type PackageJson = S.Schema.Type<typeof PackageJson>;

export const PackageJsonFromString = S.parseJson(PackageJson).annotations({
  identifier: "PackageJsonFromString",
  message: (issue) => ({
    override: true,
    message: ParseResult.TreeFormatter.formatIssue(
      issue._tag === "Transformation" ? issue.issue : issue,
    ),
  }),
});

export const PackageSpec = S.transform(
  S.NonEmptyTrimmedString,
  S.Struct({
    packageName: PackageName,
    packageVersion: S.OptionFromSelf(PackageVersion),
  }),
  {
    decode: (input) => {
      // For scoped packages (@scope/name), the version @ comes after the /
      const sepIndex = input.startsWith("@")
        ? input.indexOf("@", Math.max(input.indexOf("/"), 1))
        : input.indexOf("@");

      if (sepIndex > 0 && sepIndex < input.length - 1) {
        return {
          packageName: PackageName.make(input.slice(0, sepIndex)),
          packageVersion: Option.some(PackageVersion.make(input.slice(sepIndex + 1))),
        };
      }

      return {
        packageName: PackageName.make(input),
        packageVersion: Option.none(),
      };
    },
    encode: (_toI, toA) =>
      Option.match(toA.packageVersion, {
        onNone: () => toA.packageName,
        onSome: (version) => `${toA.packageName}@${version}`,
      }),
  },
).annotations({ identifier: "PackageSpec" });
export type PackageSpec = S.Schema.Type<typeof PackageSpec>;

export const VersionSpec = S.transform(
  S.Union(
    S.TemplateLiteralParser(PackageName, ":", CatalogName),
    S.TemplateLiteralParser(PackageName),
  ),
  S.Struct({
    packageName: PackageName,
    catalogName: S.OptionFromSelf(CatalogName),
  }),
  {
    decode: (tuple) => ({
      packageName: tuple[0],
      catalogName: Option.fromNullable(tuple[2]),
    }),
    encode: (_toI, toA) =>
      Option.match(toA.catalogName, {
        onNone: () => [toA.packageName] as const,
        onSome: (catalog) => [toA.packageName, ":", catalog] as const,
      }),
  },
).annotations({ identifier: "VersionSpec" });
export type VersionSpec = S.Schema.Type<typeof VersionSpec>;

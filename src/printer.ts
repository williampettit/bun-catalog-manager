import { Doc } from "@effect/printer";
import { Ansi, AnsiDoc } from "@effect/printer-ansi";
import { isAvailablePerLine } from "@effect/printer/PageWidth";
import { Console, Effect, Option, Record as R } from "effect";

import type {
  Catalog,
  CatalogName,
  PackageName,
  PackageVersion,
  VersionSpec,
  WorkspacePath,
} from "./types";

// =============================================================================
// Characters and Styles
// =============================================================================

export const Char = {
  Check: "✓",
  X: "✗",
  Warn: "⚠",
} as const;

export const BoxChar = {
  TopLeft: "╭",
  TopRight: "╮",
  BottomLeft: "╰",
  BottomRight: "╯",
  HBar: "─",
  VBar: "│",
  MiddleLeft: "├",
  MiddleRight: "┤",
  Dot: "·",
} as const;

export const DocStyle = {
  Border: Ansi.blackBright,
  Label: Ansi.combine(Ansi.bold, Ansi.blue),
  Package: Ansi.italicized,
  Version: Ansi.cyanBright,
  Dot: Ansi.blackBright,
  Dim: Ansi.combine(Ansi.italicized, Ansi.blackBright),
  Count: Ansi.white,
} as const;

// =============================================================================
// Box Primitives
//
// NOTE: Doc.column is broken with Ansi annotations (UndoAnnotation resets the
// column counter), so all width calculations use Doc.pageWidth + known lengths.
// =============================================================================

/** Extract lineWidth from PageWidth, defaulting to 60 for unbounded. */
const withLineWidth = <A>(f: (lw: number) => Doc.Doc<A>): Doc.Doc<A> =>
  Doc.pageWidth((pw) => f(isAvailablePerLine(pw) ? pw.lineWidth : 60));

/** Styled vertical bar border character. */
const vbar: AnsiDoc.AnsiDoc = Doc.annotate(Doc.char(BoxChar.VBar), DocStyle.Border);

/** Two-space padding. */
const pad2: Doc.Doc<never> = Doc.spaces(2);

/** Wraps content in │  content  │ (content must be lw-6 chars wide). */
const boxRow = (content: AnsiDoc.AnsiDoc): AnsiDoc.AnsiDoc =>
  content.pipe(
    Doc.surround(pad2, pad2),
    Doc.surround(vbar, vbar),
  );

/** Full-width horizontal rule: corner + ────── + endCap. */
const hRule = (corner: string, endCap: string): AnsiDoc.AnsiDoc =>
  Doc.annotate(
    withLineWidth((lw) =>
      Doc.text(BoxChar.HBar.repeat(lw - 2)).pipe(
        Doc.surround(
          Doc.char(corner),
          Doc.char(endCap),
        ),
      )
    ),
    DocStyle.Border,
  );

/** Section header: ╭─ name (count) ────╮ or ├─ name (count) ────┤ */
const boxHeader = (name: string, count: number, isFirst: boolean): AnsiDoc.AnsiDoc => {
  const left = isFirst ? BoxChar.TopLeft : BoxChar.MiddleLeft;
  const right = isFirst ? BoxChar.TopRight : BoxChar.MiddleRight;
  return withLineWidth((lw) => {
    // border(1) + pad(2) + name + pad(2) + count + pad(2) + border(1)
    const chars = 1 + 2 + name.length + 2 + String(count).length + 2 + 1;
    const fill = lw - chars;

    return Doc.hsep([
      Doc.annotate(Doc.text(name), DocStyle.Label),
      Doc.annotate(Doc.parenthesized(Doc.text(String(count))), DocStyle.Count),
    ]).pipe(
      Doc.surround(
        Doc.hcat([Doc.char(left), Doc.char(BoxChar.HBar)]).pipe(
          Doc.annotate(DocStyle.Border),
        ),
        Doc.hcat([Doc.text(BoxChar.HBar.repeat(Math.max(0, fill))), Doc.char(right)]).pipe(
          Doc.annotate(DocStyle.Border),
        ),
      ),
    );
  });
};

/** Package row with dot leader: │  pkgName ···· version  │ */
const pkgRow = (pkgName: string, version: string): AnsiDoc.AnsiDoc =>
  boxRow(withLineWidth((lw) => {
    const innerWidth = lw - 6;
    const gap = innerWidth - pkgName.length - version.length;
    const dots = gap > 2
      ? Doc.text(` ${BoxChar.Dot.repeat(gap - 2)} `)
      : Doc.spaces(Math.max(1, gap));
    return Doc.hcat([
      Doc.annotate(Doc.text(pkgName), DocStyle.Package),
      Doc.annotate(dots, DocStyle.Dot),
      Doc.annotate(Doc.text(version), DocStyle.Version),
    ]);
  }));

/** Empty catalog row: │  (empty)                       │ */
const emptyBoxRow: AnsiDoc.AnsiDoc = boxRow(withLineWidth((lw) => {
  const innerWidth = lw - 6;
  return Doc.hcat([
    Doc.annotate(Doc.text("(empty)"), DocStyle.Dim),
    Doc.spaces(Math.max(0, innerWidth - "(empty)".length)),
  ]);
}));

/** Bottom border: ╰───────────╯ */
const boxFooter: AnsiDoc.AnsiDoc = hRule(BoxChar.BottomLeft, BoxChar.BottomRight);

// =============================================================================
// Catalog Printers
// =============================================================================

export const printCatalog = (
  catalogs: ReadonlyArray<readonly [CatalogName, Catalog]>,
  lineWidth: number,
) =>
  Effect.gen(function*() {
    const sections = catalogs.map(([name, catalog]) => ({
      name,
      entries: R.toEntries(catalog).sort(([a], [b]) => a.localeCompare(b)),
    }));

    const rows: Array<AnsiDoc.AnsiDoc> = [];

    for (const [i, { name, entries }] of sections.entries()) {
      rows.push(boxHeader(name, entries.length, i === 0));

      if (entries.length === 0) {
        rows.push(emptyBoxRow);
      } else {
        for (const [pkg, version] of entries) {
          rows.push(pkgRow(pkg, version));
        }
      }
    }

    rows.push(boxFooter);

    yield* Doc.vcat(rows).pipe(
      AnsiDoc.render({ style: "pretty", options: { lineWidth } }),
      Console.log,
    );
  });

export const printAddedPackage = (
  packageName: PackageName,
  version: PackageVersion,
  catalogName: Option.Option<CatalogName>,
) =>
  Effect.gen(function*() {
    yield* Doc.hsep([
      Doc.annotate(Doc.char(Char.Check), Ansi.greenBright),
      Doc.text("Added"),
      Doc.hcat([
        Doc.annotate(Doc.text(packageName), Ansi.cyanBright),
        Doc.annotate(Doc.char("@"), DocStyle.Dim),
        Doc.annotate(Doc.text(version), Ansi.white),
      ]),
      Doc.text("to the"),
      Doc.annotate(Doc.text(Option.getOrElse(catalogName, () => "default")), Ansi.green),
      Doc.text("catalog"),
    ]).pipe(
      AnsiDoc.render({ style: "pretty" }),
      Console.log,
    );
  });

export const printInstalledPackage = (
  versionSpec: VersionSpec,
  workspacePath: WorkspacePath,
  saveDev: boolean,
) =>
  Effect.gen(function*() {
    yield* Doc.hsep([
      Doc.annotate(Doc.char(Char.Check), Ansi.greenBright),
      Doc.text("Installed"),
      Doc.hcat([
        Doc.annotate(Doc.text(versionSpec.packageName), Ansi.cyanBright),
        ...Option.match(versionSpec.catalogName, {
          onNone: () => [],
          onSome: (catalogName) => [
            Doc.annotate(Doc.char("@"), DocStyle.Dim),
            Doc.annotate(Doc.text(catalogName), Ansi.white),
          ],
        }),
      ]),
      Doc.text("to the"),
      Doc.annotate(Doc.text(workspacePath), Ansi.green),
      Doc.text("workspace"),
      saveDev ? Doc.text("(as a dev dependency)") : Doc.empty,
    ]).pipe(
      AnsiDoc.render({ style: "pretty" }),
      Console.log,
    );
  });

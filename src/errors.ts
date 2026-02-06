import { Data } from "effect";

import { CatalogName } from "./types";

export class CatalogNotFound extends Data.TaggedError("CatalogNotFound")<{
  readonly name: CatalogName;
}> {
  override get message(): string {
    return [
      `The catalog "${this.name}" was not found.`,
      "Please ensure that the catalog exists and is properly configured in your package.json file.",
    ].join("\n");
  }
}

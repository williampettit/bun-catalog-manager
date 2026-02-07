import { CommandExecutor, FileSystem, Terminal } from "@effect/platform";
import { BunPath } from "@effect/platform-bun";
import { SystemError } from "@effect/platform/Error";
import { Console, Effect, Layer, Ref } from "effect";

// =============================================================================
// Fixtures
// =============================================================================

export const samplePackageJson = {
  name: "my-monorepo",
  version: "1.0.0",
  private: true,
  scripts: { build: "tsc", test: "vitest" },
  workspaces: {
    packages: ["packages/*"],
    catalog: {
      "package-a": "^1.0.0",
      "package-b": "2.0.0",
      "@org/package-c": "^3.0.0",
    },
    catalogs: {
      misc: { "package-d": "~2.0.0" },
    },
    customField: "keep-me",
  },
};

export const samplePackageJsonString = JSON.stringify(samplePackageJson, null, 2);

// =============================================================================
// Helpers
// =============================================================================

/** Path that savePackageJson writes to (it uses process.cwd() + /package.json). */
export const savedPath = () => `${process.cwd()}/package.json`;

export const readSaved = (store: Ref.Ref<Map<string, string>>) =>
  Ref.get(store).pipe(
    Effect.map((map) => JSON.parse(map.get(savedPath())!)),
  );

// =============================================================================
// Mock Layers
// =============================================================================

export const MockPathLayer = BunPath.layer;

export const MockTerminalLayer = Layer.mock(Terminal.Terminal, {
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
});

export const makeInMemoryFs = (initialFiles: Record<string, string>) =>
  Effect.gen(function*() {
    const store = yield* Ref.make(new Map(Object.entries(initialFiles)));

    const fs = FileSystem.makeNoop({
      readFileString: (path) =>
        Ref.get(store).pipe(
          Effect.flatMap((map) => {
            const content = map.get(path);
            if (content === undefined) {
              return new SystemError({
                reason: "NotFound",
                module: "FileSystem",
                method: "readFileString",
                pathOrDescriptor: path,
                description: `File not found: ${path}`,
              });
            }
            return Effect.succeed(content);
          }),
        ),
      writeFileString: (path, data) =>
        Ref.update(
          store,
          (map) => new Map(map).set(path, data),
        ),
    });

    return { fs, store } as const;
  });

export const makeMockCommandExecutor = (output: string) =>
  Layer.mock(CommandExecutor.CommandExecutor, {
    [CommandExecutor.TypeId]: CommandExecutor.TypeId,
    string: () => Effect.succeed(output),
  });

/** Build a Console.Console that captures `log` calls into a Ref. */
export const makeCapturingConsole = Effect.gen(function*() {
  const lines = yield* Ref.make<Array<string>>([]);

  const mockConsole: Console.Console = new Proxy({} as Console.Console, {
    get: (_target, prop) => {
      if (prop === Console.TypeId) {
        return Console.TypeId;
      }
      if (prop === "log") {
        return (...args: ReadonlyArray<unknown>) =>
          Ref.update(lines, (prev) => [...prev, args.map(String).join(" ")]);
      }
      if (prop === "unsafe") {
        return new Proxy({} as Console.UnsafeConsole, {
          get: (_, p) => () => {
            throw new Error(`unsafe.${String(p)} not implemented`);
          },
        });
      }
      return () => Effect.void;
    },
  });

  const getOutput = Ref.get(lines).pipe(Effect.map((l) => l.join("\n")));

  return { mockConsole, getOutput } as const;
});

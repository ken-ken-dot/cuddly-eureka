import { TypeCompiler } from "@sinclair/typebox/compiler";

export function makeCompiler<T>(schema: Parameters<typeof TypeCompiler.Compile>[0]) {
  const compiled = TypeCompiler.Compile(schema as never);
  return (value: unknown): T => {
    if (!compiled.Check(value)) {
      let first: { path: string; message: string } | undefined;
      for (const issue of compiled.Errors(value)) {
        first = issue as { path: string; message: string };
        break;
      }
      const msg = first ? `${first.path} ${first.message}` : "Invalid request body";
      throw Object.assign(new Error(msg), { statusCode: 400 });
    }
    return value as T;
  };
}

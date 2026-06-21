import type { ZodType } from "zod";

export function validateEnv<T>(
  schema: ZodType<T>,
  source: Record<string, unknown> = process.env,
): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

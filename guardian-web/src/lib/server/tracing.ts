import { SpanStatusCode, trace } from "@opentelemetry/api";

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("haloop-backend");
  return tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined) {
        continue;
      }
      span.setAttribute(key, value);
    }

    try {
      const result = await run();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}


import type { Instrumentation } from "next";

// Emit a structured record for the host's log collector without request
// headers, query strings, or user-entered data.
export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  const failure = error instanceof Error ? error as Error & { digest?: string } : null;
  console.error(JSON.stringify({
    event: "server_error",
    name: failure?.name ?? "UnknownError",
    digest: failure?.digest ?? null,
    route: context.routePath,
    type: context.routeType,
  }));
};

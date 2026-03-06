import { registerOTel } from "@vercel/otel";

export function register(): void {
  registerOTel("haloop-guardian-web");
}


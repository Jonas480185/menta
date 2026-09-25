import { z } from "zod";

/**
 * Import `z` from here (not from "zod") in schemas that produce user-facing messages:
 * configures Zod's default error messages in German for both server and client bundles.
 */
z.config(z.locales.de());

export { z };

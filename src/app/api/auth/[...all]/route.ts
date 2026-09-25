import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/server";

/** better-auth endpoints (/api/auth/sign-in/email, /api/auth/sign-up/email, …). */
const handler = async (request: Request) => (await getAuth()).handler(request);

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);

import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error("DATABASE_URL 未设置，请在 .env.local 中配置");
}

export const db = drizzle(url, { schema });

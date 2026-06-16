import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { serveSignedFileRequest } from "./src/lib/storage/file-response.ts";

function devSignedFiles(): Plugin {
	return {
		name: "u-spark-dev-signed-files",
		configureServer(server: ViteDevServer) {
			server.middlewares.use(
				async (
					req: IncomingMessage,
					res: ServerResponse,
					next: (err?: unknown) => void,
				) => {
					const path = req.url?.split("?")[0];
					if (
						req.method !== "GET" ||
						(path !== "/api/files" && path !== "/files")
					) {
						next();
						return;
					}

					const host = req.headers.host ?? "localhost:3000";
					const response = await serveSignedFileRequest(
						new Request(`http://${host}${req.url}`),
					);
					res.statusCode = response.status;
					response.headers.forEach((value, key) => {
						res.setHeader(key, value);
					});
					const body = await response.arrayBuffer();
					res.end(Buffer.from(body));
				},
			);
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devSignedFiles(),
		devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;

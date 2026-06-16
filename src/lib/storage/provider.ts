import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

// 存储 Provider 抽象（T06 #6）：依赖倒置——dev 用内存，生产注入 S3 / R2（接口不变）。
export type StoredObject = { key: string; size: number };

export interface StorageProvider {
	readonly name: string;
	put(key: string, data: Uint8Array): Promise<StoredObject>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
}

// 开发环境 provider：内存存储（重启即失效）。生产换 S3StorageProvider 等。
export class MemoryStorageProvider implements StorageProvider {
	readonly name = "memory";
	private readonly store = new Map<string, Uint8Array>();

	async put(key: string, data: Uint8Array): Promise<StoredObject> {
		this.store.set(key, data);
		return { key, size: data.byteLength };
	}

	async get(key: string): Promise<Uint8Array | null> {
		return this.store.get(key) ?? null;
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}
}

// 开发环境持久化 provider：写入本地目录，避免 dev server 重启后数据库里的图片 key 变成破图。
export class LocalFileStorageProvider implements StorageProvider {
	readonly name = "local-file";
	private readonly root: string;

	constructor(root: string) {
		this.root = resolve(root);
	}

	async put(key: string, data: Uint8Array): Promise<StoredObject> {
		const filePath = this.pathForKey(key);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, data);
		return { key, size: data.byteLength };
	}

	async get(key: string): Promise<Uint8Array | null> {
		try {
			return await readFile(this.pathForKey(key));
		} catch (err) {
			if (err instanceof Error && "code" in err && err.code === "ENOENT") {
				return null;
			}
			throw err;
		}
	}

	async delete(key: string): Promise<void> {
		await rm(this.pathForKey(key), { force: true });
	}

	private pathForKey(key: string): string {
		const normalized = normalize(key);
		if (
			normalized.startsWith("..") ||
			normalized.includes("/../") ||
			normalized.startsWith("/")
		) {
			throw new Error("Invalid storage key");
		}
		const fullPath = resolve(join(this.root, normalized));
		if (!fullPath.startsWith(`${this.root}/`)) {
			throw new Error("Invalid storage key");
		}
		return fullPath;
	}
}

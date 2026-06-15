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

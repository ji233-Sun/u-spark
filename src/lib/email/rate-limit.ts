// 内存限频（T05 #5，固定窗口）：防注册 / 找回密码等被枚举爆破。
// 单实例够用；生产多实例可换 Redis，本接口不变（DIP）。
export type RateLimitRule = { windowMs: number; max: number };

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
	private readonly buckets = new Map<string, Bucket>();

	constructor(private readonly rule: RateLimitRule) {}

	// 返回 true=放行，false=超限。now 显式传入以便测试。
	check(key: string, now: number): boolean {
		const bucket = this.buckets.get(key);
		if (!bucket || now >= bucket.resetAt) {
			this.buckets.set(key, { count: 1, resetAt: now + this.rule.windowMs });
			return true;
		}
		if (bucket.count >= this.rule.max) {
			return false;
		}
		bucket.count += 1;
		return true;
	}

	reset(key: string): void {
		this.buckets.delete(key);
	}
}

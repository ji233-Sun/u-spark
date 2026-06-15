import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit.ts";

describe("RateLimiter 限频", () => {
	it("窗口内放行至上限，超出被拒", () => {
		const rl = new RateLimiter({ windowMs: 1000, max: 3 });
		expect(rl.check("a@x.com", 0)).toBe(true);
		expect(rl.check("a@x.com", 100)).toBe(true);
		expect(rl.check("a@x.com", 200)).toBe(true);
		expect(rl.check("a@x.com", 300)).toBe(false); // 第 4 次超限
	});

	it("窗口滚动后重新放行", () => {
		const rl = new RateLimiter({ windowMs: 1000, max: 1 });
		expect(rl.check("a@x.com", 0)).toBe(true);
		expect(rl.check("a@x.com", 500)).toBe(false);
		expect(rl.check("a@x.com", 1000)).toBe(true); // 窗口已过
	});

	it("不同 key 互不影响", () => {
		const rl = new RateLimiter({ windowMs: 1000, max: 1 });
		expect(rl.check("a@x.com", 0)).toBe(true);
		expect(rl.check("b@x.com", 0)).toBe(true);
	});

	it("reset 清除计数", () => {
		const rl = new RateLimiter({ windowMs: 1000, max: 1 });
		expect(rl.check("a@x.com", 0)).toBe(true);
		rl.reset("a@x.com");
		expect(rl.check("a@x.com", 0)).toBe(true);
	});
});

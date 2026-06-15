// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline, type TimelineNode } from "./Timeline.tsx";

const NODES: TimelineNode[] = [
	{ label: "立项", status: "done" },
	{ label: "稿件", status: "current", description: "审核中" },
	{ label: "完成", status: "pending" },
];

describe("Timeline 多节点状态展示", () => {
	it("渲染所有节点标签", () => {
		render(<Timeline nodes={NODES} />);
		expect(screen.getByText("立项")).toBeTruthy();
		expect(screen.getByText("稿件")).toBeTruthy();
		expect(screen.getByText("完成")).toBeTruthy();
	});

	it("每个节点带 data-status（多状态可区分）", () => {
		const { container } = render(<Timeline nodes={NODES} />);
		expect(container.querySelector('[data-status="done"]')).toBeTruthy();
		expect(container.querySelector('[data-status="current"]')).toBeTruthy();
		expect(container.querySelector('[data-status="pending"]')).toBeTruthy();
	});

	it("渲染节点描述", () => {
		render(<Timeline nodes={NODES} />);
		expect(screen.getByText("审核中")).toBeTruthy();
	});
});

import { defineConfig } from "vitest/config";

// 测试专用配置：独立于 vite.config.ts，刻意不加载 tanstackStart / nitro / viteReact
// 等全栈插件——它们会污染单测环境（react CJS 报 module 未定义、Vite server 无法退出）。
// 组件测试（需 DOM）可在测试文件首行加注释覆盖环境： // @vitest-environment jsdom
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // 启用全局 afterEach，使 @testing-library/react 在组件测试间自动 cleanup（避免 DOM 累积）。
    globals: true,
  },
});

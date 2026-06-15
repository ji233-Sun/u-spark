import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";
import type { PaymentCodeDetail } from "./api/projects/payment-code";

export const Route = createFileRoute("/projects_/$projectId/payment")({
	component: PaymentCodePage,
});

function PaymentCodePage() {
	const { projectId } = Route.useParams();
	const { data: session, isPending } = authClient.useSession();
	const [detail, setDetail] = useState<PaymentCodeDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void fetch(`/api/projects/payment-code?projectId=${projectId}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					detail?: PaymentCodeDetail;
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setDetail(json.detail ?? null);
				setError("");
			})
			.catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: 仅依赖会话与路由参数
	useEffect(() => {
		if (isPending || !session?.user) return;
		load();
	}, [isPending, session?.user, projectId]);

	if (isPending || (loading && !detail)) return <Loading />;
	if (!session?.user) {
		return <Prompt title="请先登录" body="登录后可上传收款码。" />;
	}
	if (error || !detail) {
		return <Prompt title="无法加载" body={error || "立项不存在或无权访问。"} />;
	}

	return (
		<main className="demo-page demo-page-wide">
			<Link to="/my/proposals" className="demo-muted text-sm no-underline">
				返回我的立项
			</Link>
			<section className="demo-panel mt-4">
				<header className="mb-6">
					<p className="island-kicker mb-2">Payment Code</p>
					<h1 className="demo-title">收款码上传</h1>
					<p className="demo-muted mt-3 text-sm">
						{detail.projectTitle} ·
						项目级单一收款码，稿酬全额打给收款负责人，作者间线下分账。
					</p>
				</header>

				{!detail.remunerationAssigned ? (
					<div className="demo-alert">
						<p className="m-0 text-sm">
							尚未核定稿酬，组织者核定后即可上传收款码。
						</p>
					</div>
				) : (
					<>
						<div className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
							<p className="m-0 text-sm">
								已核定稿酬：
								<span className="font-bold text-[var(--lagoon-deep)]">
									{detail.amount} 元
								</span>
								（{detail.paymentStatus === "paid" ? "已发放" : "待发放"}）
							</p>
						</div>

						{detail.code && (
							<div className="mb-5">
								<p className="island-kicker mb-2">当前收款码</p>
								<img
									src={detail.code.url}
									alt="收款码"
									className="max-h-60 rounded-lg border border-[var(--line)]"
								/>
								{detail.code.payeeName && (
									<p className="demo-muted mt-2 text-sm">
										收款人：{detail.code.payeeName}
									</p>
								)}
							</div>
						)}

						{detail.canUpload ? (
							<PaymentCodeForm
								projectId={projectId}
								hasExisting={detail.code !== null}
								onDone={load}
							/>
						) : (
							<div className="demo-alert demo-alert-danger">
								<p className="m-0 text-sm">
									信息补充已截止，收款码入口已关闭。
								</p>
							</div>
						)}
					</>
				)}
			</section>
		</main>
	);
}

function PaymentCodeForm({
	projectId,
	hasExisting,
	onDone,
}: {
	projectId: string;
	hasExisting: boolean;
	onDone: () => void;
}) {
	const [imageKey, setImageKey] = useState("");
	const [preview, setPreview] = useState("");
	const [uploading, setUploading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const [isError, setIsError] = useState(false);

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		setMessage("");
		const fd = new FormData();
		fd.append("file", file);
		fd.append("category", "payment-code");
		const res = await fetch("/api/uploads", { method: "POST", body: fd });
		const json = (await res.json()) as {
			ok: boolean;
			key?: string;
			error?: string;
		};
		setUploading(false);
		if (!json.ok || !json.key) {
			setIsError(true);
			setMessage(json.error ?? "上传失败");
			return;
		}
		setImageKey(json.key);
		setPreview(URL.createObjectURL(file));
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSubmitting(true);
		setMessage("");
		const fd = new FormData(e.currentTarget);
		const res = await fetch("/api/projects/payment-code", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId,
				imageKey,
				payeeName: String(fd.get("payeeName") ?? ""),
			}),
		});
		const json = (await res.json()) as { ok: boolean; error?: string };
		setSubmitting(false);
		if (!json.ok) {
			setIsError(true);
			setMessage(json.error ?? "保存失败");
			return;
		}
		setIsError(false);
		setMessage("收款码已保存。");
		onDone();
	};

	return (
		<form onSubmit={handleSubmit} className="grid gap-5">
			<div className="grid gap-2">
				<label htmlFor="code" className="text-sm font-medium">
					收款码图片 <span className="text-red-600">*</span>
				</label>
				<input
					id="code"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onChange={handleFile}
					disabled={uploading || submitting}
					className="demo-input"
				/>
				{uploading && <p className="demo-muted m-0 text-xs">上传中...</p>}
				{preview && (
					<img
						src={preview}
						alt="收款码预览"
						className="max-h-52 rounded-lg border border-[var(--line)]"
					/>
				)}
			</div>
			<div className="grid gap-2">
				<label htmlFor="payeeName" className="text-sm font-medium">
					收款人姓名（选填）
				</label>
				<input
					id="payeeName"
					name="payeeName"
					type="text"
					disabled={submitting}
					className="demo-input"
				/>
			</div>
			{message && (
				<div
					className={isError ? "demo-alert demo-alert-danger" : "demo-alert"}
				>
					<p className="m-0 text-sm">{message}</p>
				</div>
			)}
			<button
				type="submit"
				disabled={submitting || uploading || !imageKey}
				className="demo-button"
			>
				{submitting ? "保存中..." : hasExisting ? "更新收款码" : "上传收款码"}
			</button>
		</form>
	);
}

function Prompt({ title, body }: { title: string; body: string }) {
	return (
		<main className="demo-page">
			<section className="demo-panel text-center">
				<h1 className="demo-title">{title}</h1>
				<p className="demo-muted mt-3 text-sm">{body}</p>
				<Link to="/my/proposals" className="demo-button mt-6 no-underline">
					返回我的立项
				</Link>
			</section>
		</main>
	);
}

function Loading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="demo-panel animate-pulse">
				<div className="mb-4 h-8 w-1/3 rounded bg-[var(--chip-line)]" />
				<div className="h-24 rounded bg-[var(--chip-line)]" />
			</section>
		</main>
	);
}

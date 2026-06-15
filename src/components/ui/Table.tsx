import type { ReactNode } from "react";

export type Column<T> = {
	key: string;
	header: string;
	render: (row: T) => ReactNode;
};

export function Table<T>({
	columns,
	data,
	getRowKey,
	empty = "暂无数据",
}: {
	columns: Column<T>[];
	data: T[];
	getRowKey: (row: T, index: number) => string | number;
	empty?: ReactNode;
}) {
	return (
		<div className="overflow-x-auto rounded-xl border border-[var(--line)]">
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-[var(--line)] border-b bg-[var(--chip-bg)]">
						{columns.map((c) => (
							<th
								key={c.key}
								className="px-4 py-2.5 text-left font-semibold text-[var(--sea-ink)]"
							>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length}
								className="px-4 py-8 text-center text-[var(--sea-ink-soft)]"
							>
								{empty}
							</td>
						</tr>
					) : (
						data.map((row, i) => (
							<tr
								key={getRowKey(row, i)}
								className="border-[var(--line)] border-b last:border-0"
							>
								{columns.map((c) => (
									<td
										key={c.key}
										className="px-4 py-2.5 text-[var(--sea-ink-soft)]"
									>
										{c.render(row)}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}

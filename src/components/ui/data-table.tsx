import type { ReactNode } from "react";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Table as UITable,
} from "./table.tsx";

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
		<div className="overflow-hidden rounded-lg border">
			<UITable>
				<TableHeader>
					<TableRow>
						{columns.map((c) => (
							<TableHead key={c.key}>{c.header}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="py-8 text-center text-muted-foreground"
							>
								{empty}
							</TableCell>
						</TableRow>
					) : (
						data.map((row, i) => (
							<TableRow key={getRowKey(row, i)}>
								{columns.map((c) => (
									<TableCell key={c.key}>{c.render(row)}</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</UITable>
		</div>
	);
}

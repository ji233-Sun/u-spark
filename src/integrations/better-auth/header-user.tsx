import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-9 rounded-full" />;
	}

	if (!session?.user) {
		return (
			<Button asChild size="sm">
				<Link to="/auth">登录</Link>
			</Button>
		);
	}

	const user = session.user;
	const initial = user.name?.charAt(0).toUpperCase() || "U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="rounded-full"
					aria-label="账号菜单"
				>
					<Avatar className="size-8">
						{user.image ? <AvatarImage src={user.image} alt="" /> : null}
						<AvatarFallback>{initial}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="truncate text-sm font-medium">{user.name}</span>
					<span className="truncate text-xs font-normal text-muted-foreground">
						{user.email}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/account">
						<User />
						账号设置
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					variant="destructive"
					onSelect={() => {
						void authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									void navigate({ to: "/" });
								},
							},
						});
					}}
				>
					<LogOut />
					退出登录
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

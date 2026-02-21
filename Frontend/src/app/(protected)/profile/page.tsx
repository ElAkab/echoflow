import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/auth/login");
	}

	const initials = user.email?.substring(0, 2).toUpperCase() || "U";
	const avatarUrl = user.user_metadata.avatar_url;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Profile</h1>
				<p className="text-muted-foreground">
					Your personal information and usage statistics.
				</p>
			</div>

			<div className="rounded-lg border p-6 space-y-6">
				<div className="flex items-center gap-4">
					<Avatar className="h-20 w-20">
						<AvatarImage src={avatarUrl} alt={user.email || "User"} />
						<AvatarFallback className="text-2xl">{initials}</AvatarFallback>
					</Avatar>
					<div>
						<h2 className="text-2xl font-semibold">{user.email}</h2>
						<p className="text-sm text-muted-foreground">
							Member since {new Date(user.created_at).toLocaleDateString()}
						</p>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-lg border p-4">
						<div className="text-2xl font-bold">0</div>
						<div className="text-sm text-muted-foreground">Categories</div>
					</div>
					<div className="rounded-lg border p-4">
						<div className="text-2xl font-bold">0</div>
						<div className="text-sm text-muted-foreground">Notes</div>
					</div>
					<div className="rounded-lg border p-4">
						<div className="text-2xl font-bold">0</div>
						<div className="text-sm text-muted-foreground">Sessions</div>
					</div>
				</div>

				<div>
					<h3 className="font-semibold mb-2">Subscription</h3>
					<Badge variant="secondary">Freemium Plan</Badge>
					<p className="text-sm text-muted-foreground mt-2">
						Unlimited notes • 20 quizzes peer day
					</p>
				</div>
			</div>
		</div>
	);
}

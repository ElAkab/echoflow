"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import CategoryForm from "@/components/CategoryForm";
import DialogDescription from "../ui/dialog";

interface Category {
	id: string;
	name: string;
	description: string | null;
	color: string;
	notes: { count: number }[];
	icon: string | null;
}

interface DashboardContentProps {
	categories: Category[];
}

export function DashboardContent({
	categories: initialCategories,
}: DashboardContentProps) {
	const [categories, setCategories] = useState(initialCategories);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);

	const handleSuccess = () => {
		setIsDialogOpen(false);
		setEditingCategory(null);
		// Refresh categories
		window.location.reload();
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this category?")) return;

		const response = await fetch(`/api/categories/${id}`, {
			method: "DELETE",
		});

		if (response.ok) {
			setCategories(categories.filter((cat) => cat.id !== id));
		} else {
			alert("Failed to delete category");
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Your Categories</h1>
					<p className="text-muted-foreground mt-1">
						Organize your notes and start learning
					</p>
				</div>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button size="lg" className="gap-2 cursor-pointer">
							<Plus className="h-5 w-5" />
							New Category
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle>
								{editingCategory ? "Edit Category" : "Create New Category"}
							</DialogTitle>

							<DialogDescription>
								{editingCategory
									? "Update the details of your category."
									: "Create a new category to organize your notes."}
							</DialogDescription>
						</DialogHeader>

						<CategoryForm
							onSuccess={handleSuccess}
							defaultValues={
								editingCategory
									? {
											name: editingCategory.name,
											description: editingCategory.description ?? "",
											color: editingCategory.color,
											icon: editingCategory.icon ?? "",
										}
									: undefined
							}
							categoryId={editingCategory?.id}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{/* Categories Grid */}
			{categories.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-lg">
					<FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
					<h3 className="text-xl font-semibold mb-2">No categories yet</h3>
					<p className="text-muted-foreground mb-6 text-center max-w-sm">
						Create your first category to start organizing your notes and
						learning with AI
					</p>
					<Button
						onClick={() => setIsDialogOpen(true)}
						size="lg"
						className="gap-2 cursor-pointer"
					>
						<Plus className="h-5 w-5" />
						Create Category
					</Button>
				</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{categories.map((category) => {
						const noteCount = category.notes?.[0]?.count || 0;

						return (
							<Link
								key={category.id}
								href={`/notes?category=${category.id}`}
								className="group"
							>
								<div className="relative h-full rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10">
									{/* Color indicator */}
									<div
										className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
										style={{ backgroundColor: category.color }}
									/>

									{/* Content */}
									<div className="flex flex-col h-full pt-2">
										<div className="flex-1">
											<h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
												{category.name}
											</h3>
											{category.description && (
												<p className="text-sm text-muted-foreground line-clamp-2 mb-4">
													{category.description}
												</p>
											)}
										</div>

										{/* Footer */}
										<div className="flex items-center justify-between pt-4 border-t border-border">
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<span className="font-medium">{noteCount}</span>
												<span>{noteCount === 1 ? "note" : "notes"}</span>
											</div>

											{/* Actions */}
											<div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button
													size="icon"
													variant="ghost"
													className="h-8 w-8 cursor-pointer"
													onClick={(e) => {
														e.preventDefault();

														setEditingCategory(category);
														setIsDialogOpen(true);
													}}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-8 w-8 text-destructive cursor-pointer	 hover:text-destructive"
													onClick={(e) => {
														e.preventDefault();
														handleDelete(category.id);
													}}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

"use client";

import { useState } from "react";
import {
	Plus,
	Search,
	Pencil,
	Trash2,
	FileText,
	Sparkles,
	CheckSquare,
	Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuestionGenerator } from "./QuestionGenerator";
import { Markdown } from "@/components/ui/markdown";

interface Note {
	id: string;
	title: string;
	content: string;
	category_id: string;
	created_at: string;
	updated_at: string;
}

interface Category {
	id: string;
	name: string;
	icon: string;
	color?: string;
}

interface NotesContentProps {
	notes: Note[];
	categories: Category[];
	initialCategory?: string;
}

export function NotesContent({
	notes: initialNotes,
	categories,
	initialCategory,
}: NotesContentProps) {
	const [notes, setNotes] = useState(initialNotes);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>(
		initialCategory ?? "all",
	);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [viewNoteId, setViewNoteId] = useState<string | null>(null);
	const [editingNote, setEditingNote] = useState<Note | null>(null);
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
	const [isQuizOpen, setIsQuizOpen] = useState(false);
	const [quizNoteIds, setQuizNoteIds] = useState<string[] | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		content: "",
		category_id: "",
	});

	// Filter notes
	const filteredNotes = notes.filter((note) => {
		const matchesSearch =
			note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			note.content.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory =
			selectedCategory === "all" || note.category_id === selectedCategory;
		return matchesSearch && matchesCategory;
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.category_id) {
			alert("Please select a category");
			return;
		}

		try {
			if (editingNote) {
				const res = await fetch(`/api/notes/${editingNote.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(formData),
				});

				if (res.ok) {
					const updated = await res.json();
					setNotes(notes.map((n) => (n.id === updated.id ? updated : n)));
					resetForm();
				}
			} else {
				const res = await fetch("/api/notes", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(formData),
				});

				if (res.ok) {
					const newNote = await res.json();
					setNotes([newNote, ...notes]);
					resetForm();
				}
			}
		} catch (error) {
			console.error("Error saving note:", error);
			alert("Failed to save note");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this note?")) return;

		try {
			const res = await fetch(`/api/notes/${id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				setNotes(notes.filter((n) => n.id !== id));
			}
		} catch (error) {
			console.error("Error deleting note:", error);
			alert("Failed to delete note");
		}
	};

	const resetForm = () => {
		setFormData({ title: "", content: "", category_id: "" });
		setEditingNote(null);
		setIsDialogOpen(false);
	};

	const openEditDialog = (note: Note) => {
		setEditingNote(note);
		setFormData({
			title: note.title,
			content: note.content,
			category_id: note.category_id,
		});
		setIsDialogOpen(true);
	};

	const getCategoryInfo = (categoryId: string) => {
		return categories.find((c) => c.id === categoryId);
	};

	const viewNote = notes.find((n) => n.id === viewNoteId);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Your Notes</h1>
					<p className="text-muted-foreground mt-1">
						{filteredNotes.length}{" "}
						{filteredNotes.length === 1 ? "note" : "notes"}
						{isSelectionMode &&
							selectedNotes.size > 0 &&
							` · ${selectedNotes.size} selected`}
					</p>
				</div>

				<div className="flex gap-2">
					{isSelectionMode ? (
						<>
							<Button
								size="lg"
								variant="default"
								disabled={selectedNotes.size === 0}
								onClick={() => {
									setQuizNoteIds(Array.from(selectedNotes));
									setIsQuizOpen(true);
								}}
								className="gap-2 cursor-pointer"
							>
								<Sparkles className="h-5 w-5" />
								Quiz Selected ({selectedNotes.size})
							</Button>
							<Button
								size="lg"
								variant="outline"
								onClick={() => {
									setIsSelectionMode(false);
									setSelectedNotes(new Set());
								}}
							>
								Cancel
							</Button>

							{/* Multi-Note Quiz Dialog (hidden trigger) */}
							<div className="hidden" aria-hidden>
								<QuestionGenerator
									noteIds={quizNoteIds ?? undefined}
									open={isQuizOpen}
									onOpenChange={(v) => {
										if (!v) {
											setIsQuizOpen(false);
											setQuizNoteIds(null);
										} else {
											setIsQuizOpen(true);
										}
									}}
								/>
							</div>
						</>
					) : (
						<>
							<Button
								size="lg"
								variant="outline"
								onClick={() => setIsSelectionMode(true)}
								className="gap-2 dark:hover:bg-secondary cursor-pointer dark:hover:text-gray-400"
							>
								<CheckSquare className="h-5 w-5" />
								Select Multiple
							</Button>
							<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
								<DialogTrigger asChild>
									<Button
										size="lg"
										className="gap-2"
										onClick={() => setEditingNote(null)}
									>
										<Plus className="h-5 w-5" />
										New Note
									</Button>
								</DialogTrigger>
								<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
									<DialogHeader>
										<DialogTitle>
											{editingNote ? "Edit Note" : "Create New Note"}
										</DialogTitle>
									</DialogHeader>
									<form onSubmit={handleSubmit} className="space-y-4 pt-4">
										<div className="space-y-2">
											<Label htmlFor="category">Category</Label>
											<Select
												value={formData.category_id}
												onValueChange={(value) =>
													setFormData({ ...formData, category_id: value })
												}
												required
											>
												<SelectTrigger id="category">
													<SelectValue placeholder="Select a category" />
												</SelectTrigger>
												<SelectContent>
													{categories.map((category) => (
														<SelectItem key={category.id} value={category.id}>
															{category.icon} {category.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label htmlFor="title">Title</Label>
											<Input
												id="title"
												value={formData.title}
												onChange={(e) =>
													setFormData({ ...formData, title: e.target.value })
												}
												placeholder="Enter note title..."
												required
											/>
										</div>

										<div className="space-y-2">
											<Label htmlFor="content">Content</Label>
											<Textarea
												id="content"
												value={formData.content}
												onChange={(e) =>
													setFormData({ ...formData, content: e.target.value })
												}
												placeholder="Write your note here..."
												rows={12}
												className="resize-none font-mono"
											/>
											<p className="text-xs text-muted-foreground">
												Supports Markdown: **bold**, *italic*, `code`, #
												Heading, - List, [link](url)
											</p>
										</div>

										<div className="flex gap-2 pt-4">
											<Button type="submit" className="flex-1 cursor-pointer">
												{editingNote ? "Update Note" : "Create Note"}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={resetForm}
												className="flex-1 cursor-pointer"
											>
												Cancel
											</Button>
										</div>
									</form>
								</DialogContent>
							</Dialog>
						</>
					)}
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className="flex gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search notes..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>

				<Select value={selectedCategory} onValueChange={setSelectedCategory}>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder="All categories" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All categories</SelectItem>
						{categories.map((category) => (
							<SelectItem key={category.id} value={category.id}>
								{category.icon} {category.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Notes Grid */}
			{filteredNotes.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-lg">
					<FileText className="h-16 w-16 text-muted-foreground mb-4" />
					<h3 className="text-xl font-semibold mb-2">
						{searchQuery || selectedCategory !== "all"
							? "No notes found"
							: "No notes yet"}
					</h3>
					<p className="text-muted-foreground mb-6 text-center max-w-sm">
						{searchQuery || selectedCategory !== "all"
							? "Try adjusting your search or filters"
							: "Create your first note to start learning with AI"}
					</p>
					{!searchQuery && selectedCategory === "all" && (
						<Button
							onClick={() => setIsDialogOpen(true)}
							size="lg"
							className="gap-2 cursor-pointer"
						>
							<Plus className="h-5 w-5" />
							Create Note
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredNotes.map((note) => {
						const category = getCategoryInfo(note.category_id);

						return (
							<div
								key={note.id}
								className={`group relative flex flex-col h-[280px] rounded-lg border bg-card overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/10 ${
									isSelectionMode
										? selectedNotes.has(note.id)
											? "border-primary ring-2 ring-primary"
											: "border-border hover:border-yellow-500 cursor-pointer"
										: "border-border hover:border-primary"
								}`}
								onClick={() => {
									if (isSelectionMode) {
										const newSelected = new Set(selectedNotes);
										if (newSelected.has(note.id)) {
											newSelected.delete(note.id);
										} else {
											newSelected.add(note.id);
										}
										setSelectedNotes(newSelected);
									}
								}}
							>
								{/* Category indicator */}
								{category && (
									<div
										className="absolute top-0 left-0 right-0 h-1"
										style={{ backgroundColor: category.color }}
									/>
								)}

								{/* Selection checkbox */}
								{isSelectionMode && (
									<div className="absolute top-3 right-3 z-10">
										{selectedNotes.has(note.id) ? (
											<CheckSquare className="h-6 w-6 text-primary" />
										) : (
											<Square className="h-6 w-6 text-muted-foreground" />
										)}
									</div>
								)}

								{/* Content - clickable */}
								<div
									className={`flex-1 p-5 overflow-hidden ${!isSelectionMode ? "cursor-pointer" : ""}`}
									onClick={(e) => {
										if (!isSelectionMode) {
											setViewNoteId(note.id);
										}
									}}
								>
									<div className="flex items-center gap-2 mb-2">
										{category && (
											<span className="text-xs text-muted-foreground">
												{category.icon} {category.name}
											</span>
										)}
									</div>
									<h3
										className={`font-bold text-lg mb-2 line-clamp-2 transition-colors ${
											isSelectionMode
												? selectedNotes.has(note.id)
													? "text-primary"
													: ""
												: "group-hover:text-primary"
										}`}
									>
										{note.title}
									</h3>
									<div className="text-sm text-muted-foreground line-clamp-4 overflow-hidden">
										<Markdown content={note.content || "No content"} />
									</div>
								</div>

								{/* Footer with actions */}
								{!isSelectionMode && (
									<div className="px-5 py-3 border-t border-border bg-card/50 flex items-center justify-between">
										<QuestionGenerator noteId={note.id} variant="compact" />

										<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 cursor-pointer"
												onClick={(e) => {
													e.stopPropagation();
													openEditDialog(note);
												}}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
												onClick={(e) => {
													e.stopPropagation();
													handleDelete(note.id);
												}}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* View Note Dialog */}
			<Dialog
				open={!!viewNoteId && !isSelectionMode}
				onOpenChange={() => setViewNoteId(null)}
			>
				<DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
					{viewNote && (
						<>
							<DialogHeader>
								<DialogTitle className="text-2xl">{viewNote.title}</DialogTitle>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									{getCategoryInfo(viewNote.category_id) && (
										<span>
											{getCategoryInfo(viewNote.category_id)?.icon}{" "}
											{getCategoryInfo(viewNote.category_id)?.name}
										</span>
									)}
									<span>•</span>
									<span>
										{new Date(viewNote.updated_at).toLocaleDateString()}
									</span>
								</div>
							</DialogHeader>
							<div className="pt-4 prose prose-sm dark:prose-invert max-w-none">
								<Markdown content={viewNote.content || "No content"} />
							</div>
							<div className="pt-6 border-t">
								<QuestionGenerator noteId={viewNote.id} />
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

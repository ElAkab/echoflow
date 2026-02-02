import { z } from "zod";

export const categorySchema = z.object({
	name: z.string().min(1, "Category name is required").max(100),
	description: z.string().max(500).optional(),
	color: z
		.string()
		.regex(/^#[0-9A-F]{6}$/i, "Invalid color format")
		.optional(),
	icon: z.string().max(50).optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

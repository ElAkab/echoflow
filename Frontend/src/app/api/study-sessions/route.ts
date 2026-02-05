import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient(request);

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const {
			noteIds,
			categoryId,
			sessionType,
			modelUsed,
			conversationHistory,
			aiFeedback,
			questionsAsked,
		} = await request.json();

		// Validate required fields
		if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
			return NextResponse.json(
				{ error: "Note IDs are required" },
				{ status: 400 },
			);
		}

		if (!sessionType || !["SINGLE_NOTE", "MULTI_NOTE"].includes(sessionType)) {
			return NextResponse.json(
				{ error: "Invalid session type" },
				{ status: 400 },
			);
		}

		// Create study session
		const { data: session, error: sessionError } = await supabase
			.from("study_sessions")
			.insert({
				user_id: user.id,
				note_ids: noteIds,
				category_id: categoryId || null,
				session_type: sessionType,
				model_used: modelUsed || "unknown",
				conversation_history: conversationHistory || [],
				ai_feedback: aiFeedback || null,
				questions_asked: questionsAsked || 0,
			})
			.select()
			.single();

		if (sessionError) {
			console.error("Error creating study session:", sessionError);
			return NextResponse.json(
				{ error: "Failed to save study session" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, session });
	} catch (error) {
		console.error("Study session save error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// GET endpoint to retrieve user's study sessions
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient(request);

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get query parameters
		const { searchParams } = new URL(request.url);
		const limit = parseInt(searchParams.get("limit") || "10");
		const offset = parseInt(searchParams.get("offset") || "0");

		const { data: sessions, error: sessionsError } = await supabase
			.from("study_sessions")
			.select("*")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		if (sessionsError) {
			console.error("Error fetching study sessions:", sessionsError);
			return NextResponse.json(
				{ error: "Failed to fetch study sessions" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ sessions });
	} catch (error) {
		console.error("Study sessions fetch error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

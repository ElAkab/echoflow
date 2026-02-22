import { NextRequest, NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
	const body = await request.json().catch(() => null);

	if (!body) {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const { name, email, message } = body as Record<string, unknown>;

	// Validation
	if (typeof name !== "string" || name.trim().length < 1) {
		return NextResponse.json({ error: "Name is required" }, { status: 400 });
	}
	if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
	}
	if (typeof message !== "string" || message.trim().length < 5) {
		return NextResponse.json({ error: "Message must be at least 5 characters" }, { status: 400 });
	}
	if (message.length > 1000) {
		return NextResponse.json({ error: "Message is too long (max 1000 characters)" }, { status: 400 });
	}

	try {
		await sendContactEmail({
			fromName: name.trim(),
			fromEmail: email.trim().toLowerCase(),
			message: message.trim(),
		});
	} catch (err) {
		console.error("[Contact] Email delivery failed:", err);
		return NextResponse.json(
			{ error: "Failed to send your message. Please try again later." },
			{ status: 500 },
		);
	}

	return NextResponse.json({ success: true });
}

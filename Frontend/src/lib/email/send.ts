/**
 * Centralized email sending via Resend.
 *
 * All emails are fire-and-forget: errors are logged but never thrown,
 * so a failed email never breaks the calling flow.
 *
 * Sender: configure RESEND_FROM_EMAIL in env (default: noreply@echoflow.app).
 * Guard:  if RESEND_API_KEY is absent, all sends are silently skipped.
 */

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

const FROM = process.env.RESEND_FROM_EMAIL ?? "Echoflow <noreply@echoflow-app.com>";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://echoflow-app.com";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string) {
	if (!resend) return;
	try {
		await resend.emails.send({ from: FROM, to, subject, html });
	} catch (err) {
		console.error(`[Email] Failed to send "${subject}" to ${to}:`, err);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sent once when a new user completes their first sign-in.
 */
export async function sendWelcomeEmail(to: string, name?: string | null) {
	const greeting = name ? `Hello ${name}` : "Welcome";
	await send(
		to,
		"Welcome to Echoflow 👋",
		`
		<p>${greeting},</p>
		<p>Your account is ready. You start with <strong>20 free quizzes per day</strong> — no credit card needed.</p>
		<p>When you're ready to go further, premium credits unlock GPT-4o and Mistral 7B.</p>
		<p><a href="${SITE_URL}/dashboard">Start learning →</a></p>
		<p>— The Echoflow team</p>
		`,
	);
}

/**
 * Sent when a top-up payment completes successfully.
 */
export async function sendTopUpEmail(
	to: string,
	name: string | null | undefined,
	amount: number,
	newBalance: number,
) {
	await send(
		to,
		"Credits Added to Your Account",
		`
		<p>Hello ${name ?? ""},</p>
		<p><strong>${amount} credits</strong> have been added to your account.</p>
		<p>New balance: <strong>${newBalance} credits</strong></p>
		<p>Credits never expire — use them at your own pace.</p>
		<p><a href="${SITE_URL}/dashboard">Go to Echoflow →</a></p>
		`,
	);
}

/**
 * Sent when a Pro subscription is activated.
 */
export async function sendSubscriptionWelcomeEmail(
	to: string,
	name?: string | null,
	periodEnd?: string | null,
) {
	const renewal = periodEnd
		? new Date(periodEnd).toLocaleDateString(undefined, {
				year: "numeric",
				month: "long",
				day: "numeric",
		  })
		: null;

	await send(
		to,
		"You're now a Pro member ✨",
		`
		<p>Hello ${name ?? ""},</p>
		<p>Your <strong>Pro subscription</strong> is now active — enjoy unlimited premium quizzes.</p>
		${renewal ? `<p>Your subscription renews on <strong>${renewal}</strong>. You can manage or cancel it anytime from your settings.</p>` : ""}
		<p><a href="${SITE_URL}/dashboard">Start learning →</a></p>
		<p>— The Echoflow team</p>
		`,
	);
}

/**
 * Sent when a user submits the contact form.
 * - One notification to the admin (CONTACT_EMAIL env var)
 * - One auto-reply confirmation to the sender
 */
export async function sendContactEmail(opts: {
	fromName: string;
	fromEmail: string;
	message: string;
}) {
	const { fromName, fromEmail, message } = opts;
	const adminEmail = process.env.CONTACT_EMAIL;

	// Notification to admin
	if (adminEmail) {
		await send(
			adminEmail,
			`[Echoflow Contact] Message from ${fromName}`,
			`
			<p><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
			<p><strong>Message:</strong></p>
			<blockquote style="border-left:3px solid #ccc;padding-left:1rem;color:#555;">
				${message.replace(/\n/g, "<br/>")}
			</blockquote>
			<p style="color:#888;font-size:0.85rem;">Reply directly to ${fromEmail}</p>
			`,
		);
	}

	// Auto-reply to the sender
	await send(
		fromEmail,
		"We received your message — Echoflow",
		`
		<p>Hello ${fromName},</p>
		<p>Thank you for reaching out! We've received your message and will get back to you as soon as possible.</p>
		<p style="color:#888;font-size:0.85rem;">Your message:</p>
		<blockquote style="border-left:3px solid #ccc;padding-left:1rem;color:#555;">
			${message.replace(/\n/g, "<br/>")}
		</blockquote>
		<p>— The Echoflow team</p>
		<p><a href="${SITE_URL}">echoflow-app.com</a></p>
		`,
	);
}

/**
 * Sent when a subscription is cancelled (immediately or at period end).
 */
export async function sendSubscriptionCancelledEmail(
	to: string,
	name?: string | null,
	accessUntil?: string | null,
) {
	const until = accessUntil
		? new Date(accessUntil).toLocaleDateString(undefined, {
				year: "numeric",
				month: "long",
				day: "numeric",
		  })
		: null;

	await send(
		to,
		"Your Echoflow subscription has been cancelled",
		`
		<p>Hello ${name ?? ""},</p>
		<p>Your Pro subscription has been cancelled.</p>
		${until ? `<p>You will keep full Pro access until <strong>${until}</strong>.</p>` : ""}
		<p>After that, your account will revert to the free plan (20 quizzes/day). You can resubscribe at any time.</p>
		<p><a href="${SITE_URL}/settings">Manage your account →</a></p>
		`,
	);
}

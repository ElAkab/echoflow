import { PaymentSuccessContent } from "./PaymentSuccessContent";

interface Props {
	searchParams: Promise<{ subscription?: string; session_id?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
	const params = await searchParams;
	return (
		<PaymentSuccessContent
			isSubscription={params.subscription === "true"}
			sessionId={params.session_id ?? null}
		/>
	);
}

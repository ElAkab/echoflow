import { create } from "zustand";

export interface CreditInfo {
	// Purchased credits (top-up, never expire)
	credits: number;
	has_credits: boolean;

	// Free daily quota
	free_quota: number;
	free_used: number;
	free_remaining: number;

	// BYOK
	has_byok: boolean;

	// Pro subscription (unlimited premium)
	is_subscribed: boolean;

	// Total usable right now (-1 = unlimited with BYOK or subscription)
	total_available: number;
}

interface CreditsStore {
	info: CreditInfo | null;
	isLoading: boolean;
	fetchCredits: () => Promise<void>;
	refreshCredits: () => Promise<void>;
}

export const useCreditsStore = create<CreditsStore>((set) => ({
	info: null,
	isLoading: true,

	fetchCredits: async () => {
		try {
			set({ isLoading: true });
			const res = await fetch("/api/credits");
			if (res.ok) {
				const data = await res.json();
				set({ info: data, isLoading: false });
			} else {
				set({ isLoading: false });
			}
		} catch (error) {
			console.error("Error fetching credits:", error);
			set({ isLoading: false });
		}
	},

	refreshCredits: async () => {
		try {
			const res = await fetch("/api/credits");
			if (res.ok) {
				const data = await res.json();
				set({ info: data });
			}
		} catch (error) {
			console.error("Error refreshing credits:", error);
		}
	},
}));

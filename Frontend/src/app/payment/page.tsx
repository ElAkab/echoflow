"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Coins, 
  Crown, 
  Sparkles, 
  Check,
  Zap,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditDisplay } from "@/components/credits/CreditDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  // Fetch subscription status on load
  useEffect(() => {
    fetch("/api/subscriptions")
      .then(res => res.json())
      .then(data => setSubscriptionStatus(data))
      .catch(console.error);
  }, []);

  const isPro = subscriptionStatus?.subscription_status === "active";

  const handleSubscribe = async () => {
    setLoading("pro");
    
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.devMode) {
        alert("Pro subscription activated (dev mode)");
        window.location.href = "/payment/success?subscription=success";
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error creating subscription");
      }
    } catch (error) {
      console.error("Subscribe error:", error);
      alert("An error occurred");
    } finally {
      setLoading(null);
    }
  };

  const handleTopUp = async () => {
    setLoading("credits");
    
    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.devMode) {
        alert(`${data.credits} credits added (dev mode)`);
        window.location.href = "/payment/success?dev_mode=true";
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error purchasing credits");
      }
    } catch (error) {
      console.error("Top-up error:", error);
      alert("An error occurred");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Choose Your Access</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Access premium AI models for higher quality quizzes.
        </p>
        <div className="flex justify-center pt-2">
          <CreditDisplay variant="full" />
        </div>
      </div>

      {/* Two Options */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pro Subscription */}
        <Card className={`relative flex flex-col ${!isPro ? "border-primary shadow-lg" : "border-muted"}`}>
          {!isPro && (
            <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
              Recommended
            </Badge>
          )}
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Pro Plan</CardTitle>
            </div>
            <CardDescription>For regular users</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold">€7</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span><strong>200 credits</strong> premium per month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>GPT-4o & Mistral 7B models</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            {isPro ? (
              <Button className="w-full" variant="outline" disabled>
                <Check className="mr-2 h-4 w-4" />
                Subscription Active
              </Button>
            ) : (
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubscribe}
                disabled={loading === "pro"}
              >
                {loading === "pro" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                Subscribe
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Top-up Credits */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Pay-as-you-go</CardTitle>
            </div>
            <CardDescription>For occasional use</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold">€3</div>
              <div className="text-sm text-muted-foreground">one-time payment</div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span><strong>30 premium</strong> credits</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Never expire</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Same premium models</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>No commitment</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              size="lg"
              variant="outline"
              onClick={handleTopUp}
              disabled={loading === "credits"}
            >
              {loading === "credits" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Coins className="mr-2 h-4 w-4" />
              )}
              Buy Credits
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Free Tier Info */}
      <Alert className="bg-muted border-muted">
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>Free:</strong> 20 quizzes/day with free models (Llama, Qwen). 
          No credit card required.
        </AlertDescription>
      </Alert>

      {/* FAQ */}
      <div className="grid gap-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Zap className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong className="text-foreground">What happens when I run out of credits?</strong>
            <p>You automatically switch to free models. You are never blocked.</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong className="text-foreground">Can I cancel my subscription?</strong>
            <p>Yes, anytime. Your credits remain usable until the end of the current period.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

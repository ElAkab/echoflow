#!/bin/bash

# ============================================
# Echoflow Payment System Test Script
# ============================================

echo "🧪 Testing Echoflow Payment System"
echo "==================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if migrations exist
echo -e "\n📋 Test 1: Checking migrations..."
if [ -f "../Backend/migrations/20260218000000_hybrid_credit_system.sql" ]; then
    echo -e "${GREEN}✓${NC} Migration file exists"
else
    echo -e "${RED}✗${NC} Migration file missing"
fi

# Test 2: Check API routes
echo -e "\n📋 Test 2: Checking API routes..."
files=(
    "src/app/api/credits/route.ts"
    "src/app/api/credits/checkout/route.ts"
    "src/app/api/credits/consume/route.ts"
    "src/app/api/subscriptions/route.ts"
    "src/app/api/subscriptions/cancel/route.ts"
    "src/app/api/subscriptions/portal/route.ts"
    "src/app/api/webhooks/stripe/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
    fi
done

# Test 3: Check components
echo -e "\n📋 Test 3: Checking components..."
if [ -f "src/components/credits/CreditDisplay.tsx" ]; then
    echo -e "${GREEN}✓${NC} CreditDisplay component exists"
else
    echo -e "${RED}✗${NC} CreditDisplay component missing"
fi

# Test 4: Check libraries
echo -e "\n📋 Test 4: Checking libraries..."
if [ -f "src/lib/credits.ts" ]; then
    echo -e "${GREEN}✓${NC} credits.ts library exists"
else
    echo -e "${RED}✗${NC} credits.ts library missing"
fi

# Test 5: Check environment variables
echo -e "\n📋 Test 5: Checking environment variables..."
if [ -f ".env.local" ]; then
    echo -e "${YELLOW}!${NC} .env.local exists (check if it has required variables)"
    
    # Check for key variables
    if grep -q "STRIPE_SECRET_KEY" .env.local; then
        echo -e "${GREEN}✓${NC} STRIPE_SECRET_KEY found"
    else
        echo -e "${RED}✗${NC} STRIPE_SECRET_KEY missing"
    fi
    
    if grep -q "STRIPE_WEBHOOK_SECRET" .env.local; then
        echo -e "${GREEN}✓${NC} STRIPE_WEBHOOK_SECRET found"
    else
        echo -e "${RED}✗${NC} STRIPE_WEBHOOK_SECRET missing"
    fi
else
    echo -e "${RED}✗${NC} .env.local not found"
fi

echo -e "\n📋 Test 6: Type checking..."
if command -v npx &> /dev/null; then
    echo "Running TypeScript check..."
    npx tsc --noEmit 2>&1 | head -20
else
    echo -e "${YELLOW}!${NC} npx not available, skipping type check"
fi

echo -e "\n==================================="
echo "✅ Test suite complete!"
echo ""
echo "Next steps:"
echo "1. Run the migration: psql -d your_db -f Backend/migrations/20260218000000_hybrid_credit_system.sql"
echo "2. Start the dev server: pnpm dev"
echo "3. Test the payment flow at http://localhost:3000/payment"
echo ""
echo "To configure Stripe products:"
echo "1. Create a Pro subscription product (€7/month)"
echo "2. Create a Top-up product (€3 one-time)"
echo "3. Copy the price IDs to your .env.local file"

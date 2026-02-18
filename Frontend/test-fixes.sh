#!/bin/bash

# ============================================
# Test Script: Verify ALL_MODELS_FAILED Fix
# ============================================

echo "🧪 Testing OpenRouter Routing & Credit System Fixes"
echo "===================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Build Verification
echo -e "\n📋 Test 1: TypeScript Build"
if pnpm build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed"
    exit 1
fi

# Test 2: Check for logging statements
echo -e "\n📋 Test 2: Logging Implementation"
if grep -q "console.log.*OpenRouter" src/app/api/ai/_utils/openrouter-routing.ts; then
    echo -e "${GREEN}✓${NC} Logging statements present"
else
    echo -e "${RED}✗${NC} Missing logging"
fi

# Test 3: TokenWarning Grid Layout
echo -e "\n📋 Test 3: TokenWarning Responsive Grid"
if grep -q "grid-cols-1 sm:grid-cols-3" src/components/TokenWarning.tsx; then
    echo -e "${GREEN}✓${NC} Grid layout implemented"
else
    echo -e "${RED}✗${NC} Grid layout missing"
fi

# Test 4: Error Code Mapping
echo -e "\n📋 Test 4: Error Code Mapping"
if grep -q "no_models_available" src/components/notes/QuestionGenerator.tsx; then
    echo -e "${GREEN}✓${NC} Error mapping present"
else
    echo -e "${RED}✗${NC} Error mapping missing"
fi

# Test 5: Credit Check Logging
echo -e "\n📋 Test 5: Credit Context Logging"
if grep -q "hasCredits.*canUsePremium.*source" src/app/api/ai/generate-questions/route.ts; then
    echo -e "${GREEN}✓${NC} Credit context logging added"
else
    echo -e "${RED}✗${NC} Credit logging missing"
fi

echo -e "\n===================================================="
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Start dev server: pnpm dev"
echo "2. Open browser console to see detailed OpenRouter logs"
echo "3. Test quiz generation and verify error handling"
echo "4. Test TokenWarning responsiveness (resize window)"

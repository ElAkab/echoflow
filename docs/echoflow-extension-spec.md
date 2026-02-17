# Echoflow Browser Extension - Feature Specification

> **Version**: 1.0 - Brainstorming Output  
> **Status**: Draft - Ready for Review  
> **Stakeholders**: Product, Engineering, UX, AI/ML

---

## Executive Summary

- **Purpose**: Transform passive web browsing into active learning by enabling one-click capture of any web content into structured, AI-enhanced study notes
- **Target Users**: Knowledge workers, students, self-learners, and professionals who research online and want to retain information through active recall
- **Key Differentiator**: Unlike bookmarking tools (Pocket, Raindrop) or read-later apps, Echoflow Extension immediately structures content for active learning with AI-generated quizzes, not just storage
- **Platforms**: Chrome (P0), Firefox (P1), Safari (P2), Edge (P1)

---

## Core Value Proposition

> "Turn any webpage into a personalized learning experience—capture once, remember forever through AI-powered active recall."

---

## Feature Set

### Phase 1: MVP (Minimum Viable Extension)

#### Feature 1.1: Quick Text Capture
**User Story**: As a researcher, I want to save selected text to Echoflow with one click so I can build my knowledge base without interrupting my flow.

**Acceptance Criteria**:
- [ ] Right-click context menu appears on text selection with "Add to Echoflow" option
- [ ] Keyboard shortcut (Cmd/Ctrl+Shift+E) triggers capture of current selection
- [ ] Auto-capture URL, page title, and timestamp
- [ ] Save to "Uncategorized" or last used category (configurable in settings)
- [ ] Visual confirmation toast: "Saved to Echoflow ✓"
- [ ] Works on any webpage (respecting CORS/iframe limitations)

**AI Component**: None (direct storage)

**UX Flow**:
```
User selects text → Right-click "Add to Echoflow" 
  → Note created with raw text + metadata 
  → Toast confirmation (2s auto-dismiss)
  → User continues browsing
```

**Edge Cases**:
- No text selected → Show error: "Please select text first"
- Not logged in → Open Echoflow login in new tab
- API error → Show retry option, queue locally

---

#### Feature 1.2: Smart Note Creation
**User Story**: As a learner, I want AI to help me structure captured content so I can review it more effectively later.

**Acceptance Criteria**:
- [ ] Rich capture dialog opens on keyboard shortcut (Cmd/Ctrl+Shift+Shift+E)
- [ ] AI summarizes selected text into 2-4 sentences
- [ ] Extracts 3-7 key points as bullet list
- [ ] Suggests appropriate category based on content analysis
- [ ] Generates 2-3 potential quiz questions (preview only)
- [ ] Allows user to edit title, summary, and key points before saving
- [ ] Shows source URL and captured timestamp (non-editable)

**AI Prompt Strategy**:

```yaml
Prompt: Echoflow Note Generation

System Context: |
  You are an expert learning assistant helping users transform web content 
  into structured study notes. Your goal is to extract the most valuable 
  information and organize it for optimal retention through active recall.

Input Schema:
  raw_text: string (the selected text from webpage)
  page_title: string (title of the webpage)
  page_url: string (source URL)
  user_categories: string[] (existing categories in user's account)

Output Schema:
  title: string (max 100 chars, descriptive)
  summary: string (2-4 sentences, captures essence)
  key_points: string[] (3-7 bullets, specific and actionable)
  suggested_category: string (match existing or suggest new)
  difficulty_level: "beginner" | "intermediate" | "advanced"
  quiz_questions_preview: string[] (2-3 questions to test understanding)
  estimated_read_time: number (minutes)

Processing Rules:
  1. CONTENT_TYPE_DETECTION:
     - Documentation/Code → Focus on concepts, syntax, examples
     - News/Article → Focus on facts, quotes, implications
     - Academic → Focus on methodology, findings, citations
     - Forum/Discussion → Focus on insights, solutions, consensus
     - Blog/Tutorial → Focus on steps, tips, takeaways
  
  2. NOISE_FILTERING:
     - Ignore: ads, navigation, "related articles", comments unless insightful
     - Ignore: boilerplate text ("subscribe to our newsletter")
     - Ignore: timestamps, author bios (unless relevant)
  
  3. IMPORTANCE_HEURISTICS:
     - Headings and subheadings are high priority
     - Bold/emphasized text often contains key points
     - First and last paragraphs often contain summaries
     - Lists and numbered steps are extraction-ready
  
  4. CATEGORY_SUGGESTION:
     - Match against user_categories using semantic similarity
     - If no match > 0.7 confidence, suggest new category
     - Category names should be broad ("JavaScript" not "ES6 Arrow Functions")
  
  5. DIFFICULTY_ASSESSMENT:
     - Beginner: Introductory content, definitions, basic concepts
     - Intermediate: Practical application, comparisons, best practices
     - Advanced: Deep dives, edge cases, theoretical foundations

Example Output:
  title: "React useEffect Hook - Complete Guide"
  summary: "useEffect handles side effects in functional components. It runs after render and can be configured to run conditionally based on dependencies."
  key_points:
    - Runs after every render by default (empty deps = once)
    - Cleanup function returned prevents memory leaks
    - Dependency array controls when effect re-runs
    - Async operations need internal async function
  suggested_category: "React.js"
  difficulty_level: "intermediate"
  quiz_questions_preview:
    - "When does useEffect run if no dependency array is provided?"
    - "How do you prevent memory leaks in useEffect?"
```

---

#### Feature 1.3: Capture & Quiz Mode
**User Story**: As a user, I want to immediately test my understanding of captured content so I can reinforce learning in the moment.

**Acceptance Criteria**:
- [ ] "Capture & Quiz" option in context menu
- [ ] After capture, open Echoflow quiz interface in side panel (or new tab)
- [ ] Pre-select the newly created note(s) for the quiz session
- [ ] Allow multi-select: capture multiple excerpts, quiz on all at once
- [ ] Option to quiz immediately or schedule for later (spaced repetition)

**AI Component**: Quiz generation using existing Echoflow AI pipeline

---

#### Feature 1.4: Extension Popup Dashboard
**User Story**: As a user, I want quick access to my Echoflow data without leaving my current page.

**Acceptance Criteria**:
- [ ] Click extension icon opens popup (max 600x400px)
- [ ] View 5 most recent notes with titles and categories
- [ ] Quick category selector dropdown
- [ ] Daily study reminder with streak counter
- [ ] Energy/quota display (respecting BYOK vs. freemium model)
- [ ] Quick action: "Start 5-min Quiz" (uses recent/scheduled notes)
- [ ] Link to full Echoflow web app

**UI Mockup**:
```
┌─────────────────────────────────────┐
│  🧠 Echoflow          ⚡ 850 / 1000 │
├─────────────────────────────────────┤
│  🔥 Streak: 5 days                  │
│  📚 Ready to quiz: 12 notes         │
├─────────────────────────────────────┤
│  Recent Notes:                      │
│  ┌─ React Hooks Guide        [JS]   │
│  ├─ Photosynthesis Process  [Bio]   │
│  ├─ HTTP/3 Overview        [Web]    │
│  └─ ... (2 more)                    │
├─────────────────────────────────────┤
│  [⚡ Quick Quiz]  [📥 Capture]      │
└─────────────────────────────────────┘
```

---

#### Feature 1.5: Offline Queue & Sync
**User Story**: As a user, I want to capture content even when offline and have it sync automatically when I reconnect.

**Acceptance Criteria**:
- [ ] Captures stored locally in IndexedDB when offline
- [ ] Badge on extension icon shows queued items count
- [ ] Automatic sync when connection restored
- [ ] Conflict resolution: if note edited on web, merge or prompt
- [ ] Max queue size: 100 captures (configurable)

---

### Phase 2: Enhanced Experience

#### Feature 2.1: Readability Article Capture
**User Story**: As a user, I want to capture entire articles with clean formatting, not just selected text.

**Acceptance Criteria**:
- [ ] "Capture Article" option detects main content (like Reader Mode)
- [ ] Uses Mozilla Readability library for content extraction
- [ ] Removes ads, navigation, sidebars automatically
- [ ] Preserves: headings, lists, code blocks, links, images
- [ ] AI processes full article for structured note
- [ ] Option to save as single note or split into multiple notes by section

**AI Prompt - Article Processing**:
```yaml
Prompt: Article-to-Notes Conversion

System Context: |
  Convert a full article into structured learning notes optimized for 
  retention. The article has been cleaned of navigation/ads using 
  Readability.

Input:
  article_html: string (clean HTML)
  article_text: string (plain text)
  word_count: number
  headings: string[] (h1, h2, h3 extracted)

Output Options:
  Option A - Single Note (for < 800 words):
    - One comprehensive note with full summary
  
  Option B - Multi-Note (for > 800 words):
    - Main note: Overview + key themes
    - Sub-notes: One per major section (h2/h3)
    - All notes linked via "related_notes" field

Processing Rules:
  1. Identify article type: Tutorial, News, Explainer, Opinion
  2. Tutorial: Extract numbered steps as actionable items
  3. News: Extract who/what/when/where/why/impact
  4. Explainer: Extract concepts and relationships
  5. Opinion: Extract claims, evidence, conclusion
```

---

#### Feature 2.2: YouTube Transcript Capture
**User Story**: As a visual learner, I want to capture educational video content from YouTube.

**Acceptance Criteria**:
- [ ] Detects YouTube video pages
- [ ] Shows "Capture Transcript" button in Echoflow overlay
- [ ] Fetches transcript (auto-generated or manual if available)
- [ ] AI summarizes transcript with timestamps
- [ ] Links back to specific timestamps in original video
- [ ] Option to capture specific time range (start-end)

**Technical Note**: Requires interaction with YouTube's transcript API or DOM scraping.

---

#### Feature 2.3: Contextual Suggestions
**User Story**: As a user, I want the extension to proactively suggest actions based on my browsing patterns.

**Acceptance Criteria**:
- [ ] Detect when user visits multiple pages on same topic (3+ related pages in session)
- [ ] Show gentle notification: "You've viewed 5 pages about Machine Learning. Create a category?"
- [ ] Detect when visiting page similar to existing note content
- [ ] Suggest: "You have a note about React Hooks. Review it?"
- [ ] Detect documentation sites (MDN, React docs, etc.)
- [ ] Show quick-capture button on these sites

---

#### Feature 2.4: Smart Category Management
**User Story**: As a user with many notes, I want AI to help me organize my captures automatically.

**Acceptance Criteria**:
- [ ] Auto-suggest category on every capture
- [ ] "Smart Organize" feature: analyze uncategorized notes, suggest groupings
- [ ] Merge category suggestions: "'React' and 'React.js' seem similar. Merge?"
- [ ] Category creation wizard: suggests icons and descriptions
- [ ] Hierarchical categories: "Frontend > React > Hooks"

---

### Phase 3: Power User Features

#### Feature 3.1: PDF Integration
**User Story**: As a researcher, I want to capture and annotate PDF documents directly in my browser.

**Acceptance Criteria**:
- [ ] Works with browser's built-in PDF viewer
- [ ] Highlight text in PDF → context menu capture
- [ ] Extracts text from scanned PDFs using OCR (server-side)
- [ ] Captures page number with excerpt
- [ ] Links back to specific page in PDF

#### Feature 3.2: Image OCR Capture
**User Story**: As a user, I want to capture text from images (diagrams, screenshots, infographics).

**Acceptance Criteria**:
- [ ] Right-click on image → "Extract Text to Echoflow"
- [ ] Uses OCR (Tesseract.js or API) to extract text
- [ ] Shows extracted text in editable dialog before saving
-- [ ] Option to save image alongside note (for visual reference)

#### Feature 3.3: Export Integrations
**User Story**: As a user with existing tools, I want to export my Echoflow notes to other platforms.

**Acceptance Criteria**:
- [ ] Export to Anki (APKG format with flashcards)
- [ ] Export to Notion (database format)
- [ ] Export to Obsidian (Markdown files)
- [ ] Export to PDF (formatted study guide)
- [ ] API for custom integrations

#### Feature 3.4: Team/Collaboration Features
**User Story**: As a team lead, I want to share curated note collections with my team.

**Acceptance Criteria**:
- [ ] Create public/private collections
- [ ] Share collection via link
- [ ] Import shared collections (fork to my account)
- [ ] Collaborative annotations (team comments on shared notes)
- [ ] Team analytics: most-captured sources, knowledge gaps

---

## AI Reasoning Design

### Content Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CONTENT PROCESSING PIPELINE                       │
└──────────────────────────────────────────────────────────────────────┘

[Raw Webpage Content]
         ↓
┌─────────────────┐
│  1. EXTRACTION  │  ← Mozilla Readability / Turndown
│                 │     Remove nav, ads, boilerplate
│  • HTML → Text  │     Preserve semantic structure
│  • Detect type  │     Extract metadata (title, author, date)
└────────┬────────┘
         ↓
┌─────────────────┐
│ 2. CLASSIFICATION│ ← Content type detection
│                  │    Determine processing strategy
│ • Documentation  │    • Article
│ • Academic       │    • Forum/Discussion
│ • Tutorial       │    • Reference
└────────┬─────────┘
         ↓
┌─────────────────┐
│ 3. STRUCTURING  │ ← AI Processing (GPT-4/Claude)
│                 │
│ • Summarize     │    • Extract key points
│ • Identify      │    • Assess difficulty
│   concepts      │    • Suggest category
└────────┬────────┘
         ↓
┌─────────────────┐
│ 4. ENRICHMENT   │ ← Optional AI enhancements
│                 │
│ • Generate      │    • Find related concepts
│   questions     │    • Suggest connections
│ • Create        │    • Estimate study time
│   flashcards    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 5. STORAGE      │ ← Echoflow Backend
│                 │
│ • Save note     │    • Index for search
│ • Update        │    • Sync across devices
│   categories    │
└─────────────────┘
```

### Prompt Templates

#### Template 1: Article Summarization

```python
ARTICLE_SUMMARIZATION_PROMPT = """
You are a skilled educator creating study notes from web articles.

TASK: Transform the following article into a structured note for active learning.

ARTICLE METADATA:
- Title: {title}
- Source: {source}
- Word Count: {word_count}
- Detected Type: {content_type}

ARTICLE CONTENT:
---
{article_text}
---

OUTPUT REQUIREMENTS:

1. TITLE (max 80 characters):
   Create a descriptive, specific title that captures the core topic.
   Avoid generic titles like "Article Summary".

2. SUMMARY (2-4 sentences):
   - First sentence: Main point/takeaway
   - Second sentence: Key supporting detail or implication
   - Third sentence (if needed): Practical application or significance
   - Write for someone with no prior context

3. KEY POINTS (3-7 bullets):
   - Each bullet should be a complete, standalone fact
   - Use parallel structure (start with verbs for actions)
   - Include specific numbers, names, dates when present
   - Avoid vague statements like "it's important"

4. CATEGORY SUGGESTION:
   From these existing categories: {user_categories}
   Or suggest a new one if no match fits.

5. DIFFICULTY ASSESSMENT:
   - Beginner: Introduces basic concepts, defines terms
   - Intermediate: Assumes some knowledge, practical focus
   - Advanced: Deep technical detail, theoretical

6. CONCEPTS IDENTIFIED:
   List 3-5 key concepts/terms from the article for linking

FORMAT: Return as valid JSON with these keys: title, summary, key_points (array), suggested_category, difficulty_level, concepts (array)
"""
```

#### Template 2: Documentation Simplification

```python
DOCUMENTATION_PROMPT = """
You are a technical writer translating documentation into learner-friendly notes.

TASK: Convert technical documentation into an accessible study note.

SOURCE: {source_url}
CONTENT TYPE: {detected_type} (API ref, Tutorial, Guide, Explanation)

CONTENT:
---
{content}
---

OUTPUT:

1. TITLE: Specific function/feature name (e.g., "array.map() Method" not "JavaScript Guide")

2. ONE-SENTENCE DEFINITION:
   Explain what it does in plain English. Avoid jargon.

3. SYNTAX/FORMAT:
   Show the exact syntax with placeholders explained

4. KEY POINTS (focus on):
   - What problem does this solve?
   - When should you use it?
   - Common gotchas or edge cases
   - Performance considerations

5. CODE EXAMPLE:
   - Simple, real-world example (not foo/bar)
   - Include brief comments
   - Show input/output

6. RELATED CONCEPTS:
   What should the learner know BEFORE understanding this?

7. DIFFICULTY:
   Consider prerequisite knowledge required

FORMAT: JSON with keys: title, definition, syntax, key_points (array), code_example, prerequisites (array), difficulty_level
"""
```

#### Template 3: Academic Paper Extraction

```python
ACADEMIC_EXTRACTION_PROMPT = """
You are a research assistant extracting key information from academic papers.

TASK: Create a structured summary of this academic paper for study purposes.

PAPER METADATA:
- Title: {paper_title}
- Authors: {authors}
- Journal/Source: {source}
- Date: {date}

CONTENT:
---
{paper_text}
---

OUTPUT SECTIONS:

1. BIBLIOGRAPHIC INFO:
   - Full citation in APA format
   - DOI/URL if available

2. RESEARCH QUESTION/THESIS:
   - What is the main research question?
   - What hypothesis is being tested?

3. METHODOLOGY (1-2 sentences):
   - Research design
   - Sample size/population
   - Key methods/tools

4. KEY FINDINGS (3-5 bullets):
   - Specific results with numbers/statistics
   - Effect sizes if mentioned
   - Statistical significance

5. CONCLUSIONS/IMPLICATIONS:
   - What do the findings mean?
   - Limitations acknowledged
   - Future research suggested

6. CRITICAL EVALUATION:
   - Strengths of the study
   - Potential weaknesses
   - Relevance to field

7. STUDY QUESTIONS:
   - 2-3 questions to verify understanding
   - 1 question connecting to broader concepts

FORMAT: JSON with all sections as keys
"""
```

#### Template 4: Forum/Discussion Extraction

```python
FORUM_EXTRACTION_PROMPT = """
You are extracting actionable insights from online discussions.

TASK: Convert forum/discussion content into a practical note.

SOURCE: {source}
CONTEXT: {discussion_context}

CONTENT:
---
{discussion_text}
---

PROCESSING RULES:

1. IDENTIFY THE PATTERN:
   - Q&A: Question + accepted/working answer
   - Debate: Multiple viewpoints + consensus (if any)
   - Experience share: Problem → Solution → Outcome
   - Troubleshooting: Issue → Diagnosis → Fix

2. EXTRACT VALUE:
   - Skip "Thanks!" / "Me too!" comments
   - Focus on answers with upvotes/citations
   - Note conflicting advice with context
   - Include code snippets that were marked as solution

3. OUTPUT STRUCTURE:

   TITLE: Clear problem statement or topic
   
   CONTEXT: What situation is this addressing?
   
   SOLUTION(S):
   - Primary solution (most upvoted/accepted)
   - Alternative approaches (if valuable)
   - When to use which
   
   KEY INSIGHTS:
   - "Gotchas" or warnings
   - Performance considerations
   - Version/compatibility notes
   
   SOURCE CREDITS:
   - Link to original thread
   - Note top contributors

FORMAT: JSON with keys: title, context, primary_solution, alternatives (array), gotchas (array), source_url
"""
```

### Quality Assurance

How to ensure note quality:

1. **Confidence Scoring**
   - AI returns confidence score (0.0-1.0) for each extraction
   - Low confidence (< 0.7) triggers human review prompt
   - User can flag poor quality for model improvement

2. **Content Validation Rules**
   - Summary must be < 20% of original length (forces concision)
   - Key points must each be < 150 characters (forces clarity)
   - Must contain at least one specific noun (prevents vague summaries)
   - Cannot be exact copy of input text (prevents plagiarism)

3. **User Feedback Loop**
   - After each capture: "Was this summary helpful? 👍 👎"
   - Downvoted summaries stored for retraining
   - Monthly quality report to AI team

4. **A/B Testing Framework**
   - Test different prompt variations on subset of users
   - Measure: edit rate (lower is better), quiz performance on AI-generated notes
   - Gradual rollout of prompt improvements

---

## User Experience Flows

### Flow 1: Quick Capture (The "Researcher")

```
PERSONA: Maria, PhD student researching machine learning

┌────────────────────────────────────────────────────────────────┐
│ SCENARIO: Browsing academic papers and documentation           │
└────────────────────────────────────────────────────────────────┘

MORNING - Research Session
├── Maria opens 10 tabs on Transformer architectures
├── Reads paper on arXiv
│   └── Selects key paragraph about attention mechanism
│   └── Presses Cmd+Shift+E
│   └── Note saved silently with toast confirmation
│   └── Returns to reading (zero friction)
│
AFTERNOON - More captures
├── Visits PyTorch documentation
│   └── Captures code example (Cmd+Shift+Shift+E for rich capture)
│   └── AI suggests category: "Deep Learning"
│   └── Edits title, saves
│
EVENING - Review
├── Opens Echoflow popup
│   └── Sees 8 new notes from today
│   └── Clicks "Quick Quiz - 10 min"
│   └── Reviews 5 notes with AI-generated questions
│   └── Streak continues: 🔥 12 days
└── Satisfied: Content captured AND retained

KEY METRICS:
- Time per capture: < 5 seconds
- Interruption to flow: Minimal
- Retention improvement: Active recall vs. passive reading
```

### Flow 2: Research Session (The "Deep Diver")

```
PERSONA: James, developer learning a new framework

┌────────────────────────────────────────────────────────────────┐
│ SCENARIO: Learning React Server Components                     │
└────────────────────────────────────────────────────────────────┘

SETUP
├── James doesn't have React category yet
├── Visits 5 different tutorials and docs
│   └── Extension detects pattern: "Learning React?"
│   └── Suggests creating "React.js" category
│   └── Accepts suggestion
│
CAPTURE PHASE
├── Captures entire article from Vercel blog (Readability)
│   └── AI splits into 3 notes: Overview, Implementation, Best Practices
│
├── Watches YouTube tutorial
│   └── Uses "Capture Transcript" feature
│   └── Gets timestamped summary
│   └── Saves key section (15:00-22:00)
│
ORGANIZATION
├── Reviews captured notes in popup
│   └── 8 notes total from session
│   └── AI suggests: "Group these into 'RSC Fundamentals'?"
│   └── Creates sub-category
│
STUDY PHASE  
├── Starts "Capture & Quiz" mode
│   └── Quizzes on each note immediately after capture
│   └── Marks some as "Need more review" (higher frequency)
│   └── Marks others as "Got it" (lower frequency)
│
FOLLOW-UP
├── Next day: Popup reminds of scheduled review
│   └── 3 notes flagged for spaced repetition
│   └── Quick 5-min session during coffee break
└── Week later: Confident in RSC concepts

KEY VALUE: Structured learning path from scattered sources
```

### Flow 3: Daily Study Habit (The "Routine Builder")

```
PERSONA: Priya, professional studying for certification

┌────────────────────────────────────────────────────────────────┐
│ SCENARIO: Daily AWS certification study routine                │
└────────────────────────────────────────────────────────────────┘

NOTIFICATION
├── 9:00 AM: Browser notification
│   └── "Time for your daily Echoflow review! 🧠"
│   └── Snooze (15 min) or Start Now
│
QUICK REVIEW (5 minutes)
├── Clicks notification → Popup opens
│   └── Shows 3 notes due for review today
│   └── "Start Quick Review" button
│
REVIEW SESSION
├── Note 1: "S3 Lifecycle Policies"
│   └── Question: "When should you transition to Glacier?"
│   └── Priya answers, AI gives feedback
│   └── Marks confidence: High
│   └── Next review: 7 days
│
├── Note 2: "VPC Peering vs Transit Gateway"
│   └── Struggles with answer
│   └── Reviews source link
│   └── Marks confidence: Low
│   └── Next review: 1 day
│
CAPTURE NEW CONTENT
├── During work, encounters Lambda function issue
│   └── Finds solution on Stack Overflow
│   └── Captures with right-click
│   └── AI tags with "AWS Lambda" category
│
END OF DAY
├── Popup shows: "Today: 3 reviews, 1 new capture"
│   └── Streak: 🔥 23 days
│   └── Suggests: "You're on fire! Try a 10-note challenge?"
└── Priya: Confident progress toward certification

KEY VALUE: Consistent, manageable study habit built into workflow
```

### Flow 4: Documentation Workflow (The "Just-in-Time Learner")

```
PERSONA: Alex, developer looking up syntax/approaches

┌────────────────────────────────────────────────────────────────┐
│ SCENARIO: Coding, frequently referencing documentation         │
└────────────────────────────────────────────────────────────────┘

WORKFLOW INTEGRATION
├── Alex coding in IDE (VS Code)
├── Needs to check regex pattern syntax
│   └── Switches to Chrome → MDN docs
│   └── Extension detects: Documentation site
│   └── Shows floating "Quick Capture" button
│
CAPTURE
├── Clicks floating button
│   └── Auto-selects main content section
│   └── Uses Documentation prompt template
│   └── AI generates: Title, syntax, example, common patterns
│   └── Alex adds personal note: "Use this for email validation"
│   └── Saves to "JavaScript" category
│
IMMEDIATE USE
├── Returns to coding
│   └── Uses captured note for reference
│
LATER REVIEW
├── Week later, similar problem
│   └── Searches Echoflow: "regex email"
│   └── Finds note instantly
│   └── Reviews syntax
│   └── AI quiz: "What's the difference between + and *?"
│   └── Reinforces understanding
│
KNOWLEDGE BUILDING
├── Over months: 50+ JS notes
│   └── Extension suggests: "Create JavaScript cheat sheet?"
│   └── Exports to PDF
│   └── Personal reference guide created automatically
└── Alex: Efficient lookup + long-term retention

KEY VALUE: Documentation becomes personal knowledge base
```

---

## Technical Specification

### Browser Support Matrix

| Browser | Priority | Manifest | Notes |
|---------|----------|----------|-------|
| Chrome | P0 | V3 | Primary development target |
| Edge | P1 | V3 | Chromium-based, easy port |
| Firefox | P1 | V2/V3 | May need polyfills |
| Safari | P2 | Native | Requires Mac for testing |
| Arc/Brave | P2 | V3 | Chromium-based |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ECHOFLOW EXTENSION ARCHITECTURE              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER TAB                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Content Script │  │  Content Script │  │  Content Script │  │
│  │  (injected.js)  │  │  (injected.js)  │  │  (injected.js)  │  │
│  │                 │  │                 │  │                 │  │
│  │ • Text selection│  │ • Readability   │  │ • YouTube detect│  │
│  │ • Context menu  │  │ • DOM scraping  │  │ • Transcript    │  │
│  │ • Floating UI   │  │ • PDF detection │  │ • Overlay UI    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    SERVICE WORKER (Background)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  background.js                                           │  │
│  │                                                          │  │
│  │  • Context menu handlers                                 │  │
│  │  • Keyboard shortcuts                                    │  │
│  │  • API communication                                     │  │
│  │  • Auth token management                                 │  │
│  │  • Sync queue management                                 │  │
│  │  • Message passing coordinator                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ Message passing
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTENSION POPUP                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  popup.html + popup.js + popup.css                       │  │
│  │                                                          │  │
│  │  • Recent notes list                                     │  │
│  │  • Quick category selector                               │  │
│  │  • Energy/quota display                                  │  │
│  │  • Streak counter                                        │  │
│  │  • Quick action buttons                                  │  │
│  │  • React/Vanilla JS SPA                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ chrome.storage / IndexedDB
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL STORAGE                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  chrome.storage  │  │    IndexedDB     │  │   Cache      │  │
│  │     (sync)       │  │   (offline)      │  │  (assets)    │  │
│  │                  │  │                  │  │              │  │
│  │ • User settings  │  │ • Pending notes  │  │ • Icons      │  │
│  │ • Auth tokens    │  │ • Failed syncs   │  │ • Templates  │  │
│  │ • Preferences    │  │ • Large content  │  │ • User data  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ HTTPS API calls
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ECHOFLOW BACKEND                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   API Gateway    │  │   AI Services    │  │   Database   │  │
│  │                  │  │                  │  │              │  │
│  │ • RESTful API    │  │ • OpenAI/Claude  │  │ • Notes      │  │
│  │ • Rate limiting  │  │ • Prompt chains  │  │ • Categories │  │
│  │ • Validation     │  │ • Caching layer  │  │ • Users      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### Content Script (`content.js`)

```javascript
// Injected into every webpage (with permissions)
const ContentScript = {
  // Text selection tracking
  initSelectionTracking() {
    document.addEventListener('selectionchange', this.handleSelection);
  },
  
  // Floating capture button (appears on text selection)
  showFloatingButton(selection) {
    // Position near selection
    // Disappear on scroll or click elsewhere
  },
  
  // Readability integration
  async extractArticle() {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();
    return article;
  },
  
  // YouTube transcript detection
  detectYouTube() {
    return window.location.hostname === 'www.youtube.com' &&
           document.querySelector('video') !== null;
  },
  
  // Communication with background script
  sendToBackground(message) {
    chrome.runtime.sendMessage(message);
  }
};
```

#### Background Service Worker (`background.js`)

```javascript
// Manifest V3 service worker
chrome.runtime.onInstalled.addListener(() => {
  // Set up context menus
  chrome.contextMenus.create({
    id: 'capture-quick',
    title: 'Add to Echoflow',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'capture-rich',
    title: 'Smart Capture to Echoflow',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'capture-article',
    title: 'Capture Article to Echoflow',
    contexts: ['page']
  });
});

// Context menu handlers
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'capture-quick':
      handleQuickCapture(info.selectionText, tab);
      break;
    case 'capture-rich':
      handleRichCapture(info.selectionText, tab);
      break;
    case 'capture-article':
      handleArticleCapture(tab);
      break;
  }
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-capture') {
    executeQuickCapture();
  } else if (command === 'rich-capture') {
    executeRichCapture();
  }
});

// Message passing from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CAPTURE_TEXT') {
    processCapture(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error }));
    return true; // Async response
  }
});
```

#### Popup Interface (`popup.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- Header: User status -->
    <header class="header">
      <div class="brand">
        <img src="icons/icon-32.png" alt="Echoflow">
        <span>Echoflow</span>
      </div>
      <div class="quota">
        <span class="energy">⚡ 850/1000</span>
      </div>
    </header>
    
    <!-- Stats -->
    <section class="stats">
      <div class="stat">
        <span class="stat-value">🔥 5</span>
        <span class="stat-label">Day Streak</span>
      </div>
      <div class="stat">
        <span class="stat-value">📚 12</span>
        <span class="stat-label">To Review</span>
      </div>
    </section>
    
    <!-- Recent Notes -->
    <section class="recent-notes">
      <h3>Recent Notes</h3>
      <ul id="notes-list">
        <!-- Dynamically populated -->
      </ul>
    </section>
    
    <!-- Quick Actions -->
    <section class="actions">
      <button id="btn-quick-quiz" class="btn-primary">
        ⚡ Quick Quiz (5 min)
      </button>
      <button id="btn-capture-page" class="btn-secondary">
        📥 Capture This Page
      </button>
      <button id="btn-open-app" class="btn-text">
        Open Echoflow →
      </button>
    </section>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

### API Integration

#### Authentication

```yaml
Auth Flow:
  Method: OAuth 2.0 with PKCE
  Token Storage: chrome.storage.local (encrypted)
  Token Refresh: Automatic in background script
  Logout: Clear storage + revoke token
  
Endpoints Needed:
  POST /api/v1/auth/extension-token:
    description: Exchange auth code for extension token
    
  POST /api/v1/notes:
    description: Create new note
    body:
      title: string
      content: string
      category_id: string | null
      source_url: string
      source_title: string
      metadata: object
      
  GET /api/v1/notes/recent:
    description: Get recent notes for popup
    query:
      limit: number (default: 5)
      
  POST /api/v1/notes/{id}/ai-enhance:
    description: Run AI enhancement on note
    body:
      enhancements: ['summary', 'key_points', 'questions']
      
  GET /api/v1/categories:
    description: Get user's categories
    
  GET /api/v1/user/quota:
    description: Get energy/quota status
```

#### Rate Limiting

```yaml
Tier Limits:
  Freemium:
    captures_per_day: 20
    ai_enhancements_per_day: 10
    concurrent_requests: 2
    
  Premium:
    captures_per_day: unlimited
    ai_enhancements_per_day: unlimited
    concurrent_requests: 5
    
  BYOK (Bring Your Own Key):
    captures_per_day: unlimited
    ai_enhancements: client-side (no server cost)
    
Backoff Strategy:
  - 429 response: Exponential backoff (1s, 2s, 4s, 8s)
  - Max retries: 3
  - After max retries: Queue locally, retry later
```

### Security Considerations

#### Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://api.echoflow.app https://api.openai.com"
  }
}
```

#### Data Handling

```yaml
Sensitive Data:
  Auth Tokens:
    storage: chrome.storage.local (encrypted at rest)
    transmission: HTTPS only
    expiry: 30 days (refresh token), 1 hour (access token)
    
  Captured Content:
    storage: IndexedDB (local) + Server (synced)
    encryption: TLS in transit, encrypted at rest
    retention: User-controlled (delete anytime)
    
  Analytics:
    capture: Aggregate only, no content stored
    opt_out: Respects DNT header
```

#### Permission Model

```json
{
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "notifications",
    "scripting"
  ],
  "host_permissions": [
    "https://*/*",
    "http://*/*"
  ],
  "optional_permissions": [
    "history",
    "tabs"
  ]
}
```

**Permission Justifications:**
- `activeTab`: Capture content from current page
- `contextMenus`: Right-click menu items
- `storage`: Local caching and queue
- `notifications`: Study reminders
- `scripting`: Inject content scripts
- `host_permissions`: Read page content (user-initiated only)

#### Privacy-First Design

```yaml
Principles:
  1. Data Minimization: Only capture what user explicitly selects
  2. User Control: All data deletable, exportable
  3. Transparency: Clear indication of what's being captured
  4. No Tracking: No behavioral tracking, no third-party analytics
  
User Protections:
  - Extension only activates on explicit user action
  - No background page scraping
  - No data sharing with third parties
  - Option to keep all data local-only (no sync)
```

---

## Success Metrics

### Primary Metrics (North Star)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Extension Installs | 10,000 in first 6 months | Chrome Web Store analytics |
| Weekly Active Users (WAU) | 40% of installs | Telemetry |
| Notes Created via Extension | 5+ per active user/week | Backend tracking |
| Quiz Sessions from Extension Notes | 3+ per active user/week | Backend tracking |

### Secondary Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| Capture-to-Quiz Conversion | 60% | Measure full workflow adoption |
| Average Capture Time | < 5 seconds | UX efficiency |
| Extension Retention (D30) | 35% | Stickiness |
| Extension vs Web App Usage | 40% / 60% | Platform preference |
| AI Enhancement Usage | 70% of captures | AI feature adoption |
| Offline Queue Usage | < 5% of captures | Reliability metric |

### Health Metrics

| Metric | Warning Threshold | Action |
|--------|-------------------|--------|
| API Error Rate | > 1% | Investigate backend |
| Average Response Time | > 3s | Optimize AI pipeline |
| Crash Rate | > 0.1% | Bug triage |
| 1-Star Reviews | > 5% | Analyze feedback |

---

## Implementation Roadmap

### Sprint 1: Foundation (Weeks 1-2)

**Goal**: Working extension with basic capture

- [ ] Extension scaffold (Manifest V3, build pipeline)
- [ ] Content script with text selection detection
- [ ] Background service worker with context menus
- [ ] Popup UI skeleton
- [ ] API integration (auth + basic endpoints)
- [ ] Local storage (IndexedDB wrapper)
- [ ] Quick capture flow (no AI)
- [ ] Basic error handling

**Deliverable**: Internal alpha, team testing

---

### Sprint 2: Core AI Features (Weeks 3-4)

**Goal**: Smart capture with AI enhancement

- [ ] Rich capture dialog UI
- [ ] AI prompt pipeline (summarization)
- [ ] Category suggestion endpoint
- [ ] Key points extraction
- [ ] Difficulty assessment
- [ ] User editing interface
- [ ] Toast notifications
- [ ] Keyboard shortcuts

**Deliverable**: Closed beta with 50 users

---

### Sprint 3: Enhanced Experience (Weeks 5-6)

**Goal**: Complete MVP experience

- [ ] Article capture (Readability integration)
- [ ] Popup dashboard (recent notes, stats)
- [ ] Offline queue and sync
- [ ] Quota/energy display
- [ ] Streak counter
- [ ] Quick quiz launcher
- [ ] Settings page
- [ ] Error recovery flows

**Deliverable**: Public beta

---

### Sprint 4: Polish & Launch (Weeks 7-8)

**Goal**: Store-ready extension

- [ ] Firefox compatibility
- [ ] Performance optimization
- [ ] Security audit
- [ ] Privacy policy update
- [ ] Store assets (screenshots, description)
- [ ] Onboarding flow
- [ ] Analytics implementation
- [ ] Bug fixes from beta feedback

**Deliverable**: Chrome Web Store launch

---

### Phase 2: Post-Launch (Months 3-6)

- [ ] YouTube transcript capture
- [ ] Contextual suggestions
- [ ] Smart organization features
- [ ] Safari support
- [ ] Edge store submission
- [ ] A/B testing framework
- [ ] Prompt optimization based on feedback

---

### Phase 3: Power User Features (Months 6-12)

- [ ] PDF integration
- [ ] Image OCR
- [ ] Export integrations (Anki, Notion)
- [ ] Team/collaboration features
- [ ] Mobile companion app
- [ ] API for third-party integrations

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Chrome policy changes** | High | Medium | Monitor Manifest V3 evolution; maintain Firefox as backup |
| **AI API costs exceed projections** | High | Medium | Implement caching; BYOK tier; usage quotas |
| **Low user retention** | High | Medium | Build habit-forming features (streaks, reminders); measure D7/D30 |
| **Content licensing concerns** | Medium | Low | Clear TOS; user owns their notes; no public sharing by default |
| **Security vulnerability in content script** | High | Low | CSP; input sanitization; regular audits; bug bounty |
| **Performance issues on large pages** | Medium | Medium | Set capture limits; lazy load content; debounce operations |
| **Competitor releases similar feature** | Medium | Medium | Focus on AI quality; build ecosystem (integrations); community |
| **Extension store rejection** | Medium | Low | Follow guidelines; clear permissions; privacy-first design |

---

## Business Model Integration

### Freemium Tier

```yaml
Free:
  captures_per_day: 20
  ai_enhancements_per_day: 10
  offline_queue: yes
  categories: unlimited
  basic_ai: yes
  
Limitations:
  - No PDF OCR
  - No YouTube transcripts
  - No export integrations
  - Single device sync
```

### Premium Tier ($5/month or $48/year)

```yaml
Premium:
  captures: unlimited
  ai_enhancements: unlimited
  advanced_ai_models: yes (GPT-4, Claude)
  pdf_ocr: yes
  youtube_transcripts: yes
  export_integrations: all
  multi_device_sync: yes
  priority_support: yes
```

### BYOK Tier (Free)

```yaml
BYOK:
  captures: unlimited
  ai_enhancements: unlimited (user's API key)
  all_features: yes
  
Requirements:
  - User provides OpenAI/Anthropic API key
  - Client-side processing where possible
  - No server AI costs for Echoflow
```

---

## Future Possibilities

### Near-term (6-12 months)

1. **Mobile Companion App**
   - iOS/Android app for capturing on mobile
   - Share sheet integration
   - Sync with extension notes

2. **PDF Annotation Sync**
   - Integration with PDF readers (Adobe, Preview)
   - Highlight sync to Echoflow notes
   - Academic workflow optimization

3. **Kindle Highlights Import**
   - One-click import from Kindle
   - Auto-categorize by book
   - Create study guides from highlights

### Mid-term (1-2 years)

4. **Team/Enterprise Features**
   - Shared team knowledge bases
   - Curated onboarding paths
   - Learning analytics for teams
   - SSO integration

5. **API Platform**
   - Public API for note management
   - Webhook integrations
   - Third-party app ecosystem
   - Zapier/Make integration

6. **AI Tutor Mode**
   - Proactive explanations while browsing
   - "Explain like I'm 5" on any selection
   - Concept linking across notes

### Long-term Vision (2+ years)

7. **Universal Knowledge Graph**
   - Auto-link related notes across users
   - Identify knowledge gaps
   - Suggest learning paths
   - Collaborative filtering

8. **Desktop Application**
   - Native apps for Mac/Windows
   - System-wide capture (any app)
   - Global quick capture shortcut
   - Offline-first architecture

9. **Browser-Less Web**
   - Email capture (forward to Echoflow)
   - Slack/Discord bot
   - RSS feed auto-summarization
   - Podcast transcript capture

---

## Open Questions for Discussion

1. **AI Strategy**: Should we build our own summarization model or rely on third-party APIs (OpenAI, Anthropic)?

2. **Content Licensing**: How do we handle fair use of web content? Should we store full text or only summaries?

3. **Privacy Level**: Should we offer end-to-end encryption for sensitive notes? Trade-off with AI features.

4. **Monetization**: Is the freemium model right, or should we consider a fully free extension that drives web app subscriptions?

5. **Competitive Differentiation**: What prevents Pocket, Notion, or Readwise from adding similar features?

6. **Scope Creep**: Which Phase 2/3 features are truly critical for differentiation vs. nice-to-have?

7. **Technical Debt**: Should we build for Manifest V2 (Firefox) and V3 (Chrome) in parallel, or focus on V3 first?

---

## Conclusion

The Echoflow Browser Extension represents a significant opportunity to extend the platform's reach and embed learning into users' daily web browsing workflows. By focusing on zero-friction capture, AI-powered structuring, and seamless integration with the existing quiz system, we can transform passive information consumption into active knowledge retention.

The phased approach allows us to validate core assumptions with an MVP while building toward a comprehensive learning companion that could become the default "save button for the web" for knowledge workers and students.

**Next Steps**:
1. Review and prioritize features with stakeholders
2. Create detailed technical design documents
3. Set up development environment and CI/CD
4. Begin Sprint 1 implementation
5. Establish beta testing cohort

---

*Document generated during brainstorming session*  
*Authors: Business Analyst + UX Expert + Product Manager*  
*Date: 2026-02-17*

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const FREE_MODELS = [
  'deepseek/deepseek-r1-distill-llama-70b:free',
  'meta-llama/llama-3.2-90b-vision-instruct:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.2-1b-instruct:free',
  'meta-llama/llama-3.1-405b-instruct:free',
  'meta-llama/llama-3.1-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
];

let currentModelIndex = 0;

async function callOpenRouter(messages: any[], retryCount = 0): Promise<string> {
  if (retryCount >= FREE_MODELS.length) {
    throw new Error('All free models are currently unavailable. Please try again later.');
  }

  const model = FREE_MODELS[currentModelIndex];
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Si erreur 429 (rate limit), essayer le modèle suivant
      if (response.status === 429 || error.error?.code === 429) {
        console.log(`Model ${model} rate limited, switching to next model...`);
        currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
        return callOpenRouter(messages, retryCount + 1);
      }
      
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    
    // Rotation automatique après chaque succès
    currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
    
    return data.choices[0].message.content;
  } catch (error: any) {
    if (retryCount < FREE_MODELS.length - 1) {
      currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
      return callOpenRouter(messages, retryCount + 1);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteIds, messages } = await request.json();

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return NextResponse.json({ error: 'noteIds array is required' }, { status: 400 });
    }

    // Fetch all selected notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title, content')
      .in('id', noteIds)
      .eq('user_id', user.id);

    if (notesError || !notes || notes.length === 0) {
      return NextResponse.json({ error: 'Notes not found' }, { status: 404 });
    }

    // Combine all notes content
    const combinedContent = notes.map(note => 
      `**${note.title}**\n${note.content}`
    ).join('\n\n---\n\n');

    // Prepare system prompt
    const systemPrompt = `You are a helpful study assistant. The student has selected ${notes.length} note${notes.length > 1 ? 's' : ''} to study.

Here are the notes:

${combinedContent}

Your role:
1. If this is the first message (no conversation history), ask ONE thoughtful, open-ended question about the content to test their understanding.
2. If they respond, provide feedback on their answer and ask a follow-up question or clarify concepts.
3. Keep the conversation focused on helping them learn and understand the material.
4. Be encouraging and supportive.
5. Don't overwhelm them - ask one question at a time.

Keep responses concise and focused.`;

    // Build conversation history
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Call OpenRouter with retry logic
    const aiResponse = await callOpenRouter(aiMessages);

    return NextResponse.json({ message: aiResponse });
  } catch (error: any) {
    console.error('Error in quiz-multi:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}

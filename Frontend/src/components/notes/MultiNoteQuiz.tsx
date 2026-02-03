'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MultiNoteQuizProps {
  noteIds: string[];
  onClose: () => void;
}

export function MultiNoteQuiz({ noteIds, onClose }: MultiNoteQuizProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const startQuiz = async () => {
    setHasStarted(true);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/quiz-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIds, messages: [] }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }

      const data = await res.json();
      setMessages([{ role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Failed to start quiz:', error);
      alert('Failed to start quiz');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/quiz-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          noteIds, 
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }

      const data = await res.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4">Ready to Study?</h2>
          <p className="text-gray-600 mb-6">
            You've selected {noteIds.length} note{noteIds.length > 1 ? 's' : ''}. 
            The AI will quiz you on the content.
          </p>
          <div className="flex gap-3">
            <button
              onClick={startQuiz}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Quiz'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">AI Study Session ({noteIds.length} notes)</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                <p>Typing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your answer here... (Shift+Enter for new line)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none"
              rows={3}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

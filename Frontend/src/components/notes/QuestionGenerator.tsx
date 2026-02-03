'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface QuestionGeneratorProps {
  noteId: string;
  variant?: 'default' | 'compact';
}

export function QuestionGenerator({ noteId, variant = 'default' }: QuestionGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const startConversation = async () => {
    setIsOpen(true);
    setMessages([]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, messages: [] }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }

      const data = await res.json();
      setMessages([{ role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start conversation');
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
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          noteId, 
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

  return (
    <>
      {variant === 'compact' ? (
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 h-8 text-xs"
          onClick={startConversation}
          disabled={loading}
        >
          <Sparkles className="h-3 w-3" />
          Quiz
        </Button>
      ) : (
        <Button
          onClick={startConversation}
          disabled={loading}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Starting...' : 'Quiz Me'}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>AI Study Session</DialogTitle>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground px-4 py-3 rounded-lg">
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t pt-4 space-y-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your answer... (Shift+Enter for new line)"
              className="resize-none min-h-[100px]"
              disabled={loading}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

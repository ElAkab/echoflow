'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuestionGeneratorProps {
  noteId: string;
}

export function QuestionGenerator({ noteId }: QuestionGeneratorProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);

  const generateQuestions = async () => {
    setLoading(true);
    setError(null);
    setQuestions([]);
    setUserAnswers([]);

    try {
      const response = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
      setUserAnswers(new Array(data.questions.length).fill(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };

  const isAnswered = (questionIndex: number) => userAnswers[questionIndex] !== null;
  const isCorrect = (questionIndex: number) => 
    userAnswers[questionIndex] === questions[questionIndex].correctAnswer;

  return (
    <div className="space-y-4">
      <Button 
        onClick={generateQuestions} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Generating Questions...' : '✨ Generate AI Questions'}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Quiz Questions</h3>
          
          {questions.map((q, qIndex) => (
            <Card key={qIndex}>
              <CardHeader>
                <CardTitle className="text-base">
                  Question {qIndex + 1}: {q.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.options.map((option, oIndex) => {
                  const isSelected = userAnswers[qIndex] === oIndex;
                  const isCorrectOption = oIndex === q.correctAnswer;
                  const showResult = isAnswered(qIndex);

                  let bgColor = 'bg-white hover:bg-gray-50';
                  if (showResult) {
                    if (isCorrectOption) {
                      bgColor = 'bg-green-100 border-green-500';
                    } else if (isSelected && !isCorrectOption) {
                      bgColor = 'bg-red-100 border-red-500';
                    }
                  } else if (isSelected) {
                    bgColor = 'bg-blue-100 border-blue-500';
                  }

                  return (
                    <button
                      key={oIndex}
                      onClick={() => handleAnswerSelect(qIndex, oIndex)}
                      disabled={showResult}
                      className={`w-full text-left p-3 border-2 rounded-lg transition-colors ${bgColor} disabled:cursor-not-allowed`}
                    >
                      {String.fromCharCode(65 + oIndex)}. {option}
                      {showResult && isCorrectOption && ' ✓'}
                      {showResult && isSelected && !isCorrectOption && ' ✗'}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {userAnswers.every(a => a !== null) && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="font-semibold">
                  Score: {userAnswers.filter((a, i) => a === questions[i].correctAnswer).length} / {questions.length}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

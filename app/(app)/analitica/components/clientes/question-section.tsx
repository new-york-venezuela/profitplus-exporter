import { useId, type ReactNode } from 'react';

// A section headed by the question it answers.
export function QuestionSection({ question, children }: { question: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-bold text-gray-900">{question}</h2>
      {children}
    </section>
  );
}

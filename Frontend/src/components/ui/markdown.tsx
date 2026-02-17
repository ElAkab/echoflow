'use client';

import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface MarkdownProps {
  content: string;
  className?: string;
}

// Configuration DOMPurify pour permettre la mise en forme mais bloquer le JavaScript
const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'del', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'hr',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span', 'sup', 'sub'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',  // Liens
    'src', 'alt', 'width', 'height',   // Images
    'class', 'id',                      // Styling
    'lang'                              // Accessibilité
  ],
  // Forcer les liens externes à ouvrir dans un nouvel onglet avec sécurité
  ALLOW_DATA_ATTR: false,
  SANITIZE_DOM: true,
  // Garder le contenu de balises inconnues mais nettoyer la balise elle-même
  KEEP_CONTENT: true,
};

/**
 * Composant Markdown sécurisé
 * 
 * PRODUCTION SECURITY FIX:
 * - DOMPurify sanitize tout le contenu avant rendu
 * - Bloque les scripts, onerror, javascript:, etc.
 * - Permet uniquement les balises sûres (pas de script, iframe, object, etc.)
 * - Conserve la mise en forme Markdown (gras, listes, liens, etc.)
 * 
 * Cette protection est CRITIQUE car le contenu vient de:
 * 1. Notes utilisateurs (potentiellement malveillantes)
 * 2. Réponses IA (potentiellement manipulées via prompt injection)
 */
export function Markdown({ content, className = '' }: MarkdownProps) {
  // Sanitization du contenu côté client (DOMPurify nécessite le DOM)
  const sanitizedContent = typeof window !== 'undefined' 
    ? DOMPurify.sanitize(content, purifyConfig)
    : content; // Fallback SSR (le contenu sera re-sanitizé côté client)

  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Personnalisation du rendu avec classes Tailwind
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 text-primary" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-3 text-primary" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mb-2" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc mb-3 space-y-1 pl-6" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal mb-3 space-y-1 pl-6" {...props} />,
          li: ({ node, ...props }) => <li className="ml-0" {...props} />,
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
            ) : (
              <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono" {...props} />
            ),
          pre: ({ node, ...props }) => <pre className="mb-4 overflow-hidden rounded-lg" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic my-4" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a 
              className="text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer nofollow" 
              {...props} 
            />
          ),
          img: ({ node, ...props }) => (
            <img 
              className="max-w-full h-auto rounded-lg my-4" 
              loading="lazy"
              {...props} 
            />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-border" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-border px-4 py-2 bg-muted font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => <td className="border border-border px-4 py-2" {...props} />,
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;

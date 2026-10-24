"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Separator } from "@/components/ui/separator";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  fileName?: string;
}

export function MessageBubble({ role, content, imageUrl, fileName }: MessageBubbleProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="space-y-2 max-w-[78%]">
          {imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-border shadow-sm ml-auto w-fit">
              <img
                src={imageUrl}
                alt="uploaded"
                className="max-h-64 object-contain"
              />
            </div>
          )}
          {fileName && !imageUrl && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border text-xs ml-auto">
              <span className="grad-primary w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-semibold">
                FILE
              </span>
              <span className="truncate max-w-[180px]">{fileName}</span>
            </div>
          )}
          {content && (
            <div className="grad-primary text-white rounded-3xl rounded-br-md px-4 py-2.5 shadow-md shadow-[oklch(0.15_0_0/0.25)] inline-block ml-auto">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
          )}
        </div>
        <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center text-sm font-semibold shrink-0 border border-border">
          U
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="grad-primary w-9 h-9 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
        K
      </div>
      <div className="bg-card border border-border rounded-3xl rounded-bl-md px-4 py-3 shadow-sm max-w-[78%]">
        <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt}
                  className="rounded-xl max-w-full my-2 border border-border"
                  loading="lazy"
                />
              ),
              code: ({ children, className }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-muted text-foreground px-1.5 py-0.5 rounded-md text-xs font-mono">
                    {children}
                  </code>
                ) : (
                  <pre className="bg-foreground/95 text-background p-3 rounded-xl overflow-x-auto my-2 text-xs">
                    <code className={className}>{children}</code>
                  </pre>
                );
              },
              pre: ({ children }) => <>{children}</>,
              h1: ({ children }) => (
                <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-outside ml-5 my-1 space-y-0.5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside ml-5 my-1 space-y-0.5">{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/40 pl-3 italic text-muted-foreground my-2">
                  {children}
                </blockquote>
              ),
              hr: () => <Separator className="my-3" />,
              table: ({ children }) => (
                <table className="w-full text-left border-collapse my-2 text-xs">
                  {children}
                </table>
              ),
              th: ({ children }) => (
                <th className="border border-border px-2 py-1 bg-muted font-medium">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border px-2 py-1">{children}</td>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
            }}
          >
            {content || "..."}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

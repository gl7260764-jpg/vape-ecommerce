import { cn } from "@/lib/utils";

/** Renders store-supplied HTML that has already been through cleanDescription(). */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose prose-store max-w-none", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

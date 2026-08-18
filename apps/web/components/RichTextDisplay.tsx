'use client'
import DOMPurify from 'isomorphic-dompurify'

export default function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={`[&_strong]:font-bold [&_em]:italic [&_a]:underline [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_p]:mb-2 last:[&_p]:mb-0 ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] }) }}
    />
  )
}

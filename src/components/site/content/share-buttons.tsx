"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { FacebookIcon } from "@/components/site/social-icons";
import { shareLinks } from "@/lib/content/share";

type Labels = {
  share: string;
  facebook: string;
  whatsapp: string;
  x: string;
  copy: string;
  copied: string;
};

function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  );
}

/** Share on Facebook, WhatsApp, X, or copy the link. Uses the page's own address. */
export function ShareButtons({
  title,
  labels,
}: {
  title: string;
  labels: Labels;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.href.split("#")[0] ?? ""), []);
  if (!url) return null;
  const links = shareLinks(url, title);
  const button =
    "flex size-9 items-center justify-center rounded-full border hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{labels.share}:</span>
      <a
        href={links.facebook}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.facebook}
        className={button}
      >
        <FacebookIcon className="size-4" />
      </a>
      <a
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.whatsapp}
        className={button}
      >
        <WhatsappIcon className="size-4" />
      </a>
      <a
        href={links.x}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={labels.x}
        className={button}
      >
        <XIcon className="size-4" />
      </a>
      <button
        type="button"
        className={button}
        aria-label={copied ? labels.copied : labels.copy}
        onClick={async () => {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
    </div>
  );
}

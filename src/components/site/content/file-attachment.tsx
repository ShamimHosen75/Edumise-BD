import { Download, FileText } from "lucide-react";
import Image from "next/image";

type Props = {
  url: string;
  isPdf: boolean;
  title: string;
  labels: {
    attachment: string;
    download: string;
    openPdf: string;
    pdfPreview: string;
    pdfFallback: string;
  };
};

/** Attached PDF (shown inline, with a download link) or image. */
export function FileAttachment({ url, isPdf, title, labels }: Props) {
  return (
    <section
      aria-labelledby="attachment-title"
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="attachment-title"
          className="flex items-center gap-2 font-semibold"
        >
          <FileText className="size-4" aria-hidden="true" />
          {labels.attachment}
        </h2>
        <a
          href={url}
          download
          className="text-primary flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <Download className="size-4" aria-hidden="true" />
          {labels.download}
        </a>
      </div>
      {isPdf ? (
        <object
          data={url}
          type="application/pdf"
          aria-label={labels.pdfPreview}
          className="h-[70vh] min-h-96 w-full rounded-lg border"
        >
          <p className="p-4 text-sm">
            {labels.pdfFallback}{" "}
            <a href={url} className="text-primary underline">
              {labels.openPdf}
            </a>
          </p>
        </object>
      ) : (
        <Image
          src={url}
          alt={title}
          width={1200}
          height={900}
          className="h-auto w-full rounded-lg border"
        />
      )}
    </section>
  );
}

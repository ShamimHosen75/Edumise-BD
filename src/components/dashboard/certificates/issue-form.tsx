"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  findStudentForCertificate,
  issueCertificate,
} from "@/app/[lang]/dashboard/certificates/actions";
import { translator } from "@/components/dashboard/academic/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { CERTIFICATE_TYPES, type CertificateType } from "@/lib/certificates";
import type { CertificateStudent } from "@/lib/certificates-data";

const select = "bg-background h-10 rounded-md border px-3 text-sm";

/** Find the student by ID, pick the type, check the drafted text, issue. */
export function IssueForm({
  lang,
  initialCode,
  messages,
}: {
  lang: Locale;
  initialCode: string;
  messages: Messages;
}) {
  const tr = translator(messages);
  const c = (key: string, vars?: Record<string, string>) =>
    tr(`certificates.${key}`, vars);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(initialCode);
  const [type, setType] = useState<CertificateType>("testimonial");
  const [student, setStudent] = useState<CertificateStudent | null>(null);
  const [bodyEn, setBodyEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const find = (nextType = type) =>
    start(async () => {
      setError(null);
      const result = await findStudentForCertificate(lang, {
        code,
        type: nextType,
      }).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) {
        setStudent(null);
        return setError(tr(result.error));
      }
      setStudent(result.student);
      setBodyEn(result.body_en);
      setBodyBn(result.body_bn);
    });

  const issue = () => {
    if (!student) return;
    const typeName = c(`types.${type}`);
    if (
      !window.confirm(c("issueConfirm", { type: typeName, name: student.name }))
    )
      return;
    if (
      type === "transfer" &&
      !window.confirm(c("transferConfirm", { name: student.name }))
    )
      return;
    start(async () => {
      const result = await issueCertificate(lang, {
        student_id: student.id,
        type,
        body_en: bodyEn,
        body_bn: bodyBn,
      }).catch(() => ({
        ok: false as const,
        error: "auth.unexpected" as const,
      }));
      if (!result.ok) return void toast.error(tr(result.error));
      toast.success(c("issued", { reference: result.reference ?? "" }));
      router.push(`/${lang}/dashboard/certificates/${result.id}`);
    });
  };

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certificate-code">{c("findStudent")}</Label>
          <Input
            id="certificate-code"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "certificate-code-error" : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certificate-type">{c("type")}</Label>
          <select
            id="certificate-type"
            className={select}
            value={type}
            onChange={(e) => {
              const next = e.target.value as CertificateType;
              setType(next);
              if (student) find(next);
            }}
          >
            {CERTIFICATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {c(`types.${t}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {c("find")}
        </Button>
        {error ? (
          <p
            id="certificate-code-error"
            role="alert"
            className="text-destructive w-full text-sm"
          >
            {error}
          </p>
        ) : null}
      </form>

      {student ? (
        <section
          aria-labelledby="certificate-draft"
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <h2
            id="certificate-draft"
            className="font-semibold"
            data-testid="certificate-student"
          >
            {student.info ?? `${student.name} (${c("notEnrolled")})`}
          </h2>
          <p className="text-muted-foreground text-sm">{c("bodyHint")}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="certificate-body-en">{c("bodyEn")}</Label>
            <Textarea
              id="certificate-body-en"
              lang="en"
              rows={7}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="certificate-body-bn">{c("bodyBn")}</Label>
            <Textarea
              id="certificate-body-bn"
              lang="bn"
              rows={7}
              value={bodyBn}
              onChange={(e) => setBodyBn(e.target.value)}
            />
          </div>
          {type === "transfer" ? (
            <p
              role="note"
              className="rounded-lg border p-3 text-sm font-medium"
            >
              {c("transferNote")}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-fit"
            disabled={pending || !bodyEn.trim()}
            onClick={issue}
          >
            {pending ? c("issuing") : c("issueButton")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

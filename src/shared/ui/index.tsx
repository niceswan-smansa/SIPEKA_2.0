"use client";

import type {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useEffect, useRef, useState } from "react";

type ClassName = { className?: string };

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ${className}`}
      {...props}
    />
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-2 px-2 text-xs font-semibold text-slate-600"
      >
        {visible ? "Sembunyikan" : "Tampilkan"}
      </button>
    </div>
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}

export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border-slate-300 text-[var(--brand)] ${className}`}
      {...props}
    />
  );
}

export function FormField({
  label,
  id,
  error,
  children,
  className = "",
}: { label: string; id: string; error?: string; children: ReactNode } & ClassName) {
  return (
    <div className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="text-sm font-normal text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Card({ className = "", children }: { children: ReactNode } & ClassName) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const colors = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>
      {children}
    </span>
  );
}
export function Alert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const colors = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${colors[tone]}`}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
      return () => returnFocusRef.current?.focus();
    }
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Konfirmasi",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <p className="mb-5 text-sm text-slate-600">{children}</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          onClick={onCancel}
        >
          Batal
        </Button>
        <Button
          type="button"
          className="bg-red-700 hover:bg-red-800"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Memproses…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export { PwaRegister } from "./pwa-register";
export function DropdownMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100">
        {label}
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        {children}
      </div>
    </details>
  );
}
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export function Pagination({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref?: string;
  nextHref?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span>
        Halaman {page} dari {totalPages}
      </span>
      <div className="flex gap-2">
        {previousHref ? (
          <a className="rounded border px-3 py-2" href={previousHref}>
            Sebelumnya
          </a>
        ) : null}
        {nextHref ? (
          <a className="rounded border px-3 py-2" href={nextHref}>
            Berikutnya
          </a>
        ) : null}
      </div>
    </nav>
  );
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="rounded-xl bg-slate-100 px-6 py-12 text-center text-sm text-slate-500">
      Memuat data…
    </div>
  );
}
export function Skeleton({ className = "" }: ClassName) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />;
}
export function Toast({
  children,
  tone = "success",
}: {
  children: ReactNode;
  tone?: "success" | "error";
}) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-40 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${tone === "success" ? "bg-emerald-700" : "bg-red-700"}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}
export function ResponsiveContainer({
  children,
  className = "",
}: { children: ReactNode } & ClassName) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

export function UnsavedForm({ children, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  return (
    <form
      {...props}
      onChange={() => setDirty(true)}
      onSubmit={(event) => {
        setDirty(false);
        onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}

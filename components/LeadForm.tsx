'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  leadInputSchema,
  BUYING_TIMELINES,
  formatBudgetDisplay,
  MAX_BUDGET_INR,
} from '@/lib/validations/lead';

interface FormErrors {
  name?: string;
  location?: string;
  propertyRequirement?: string;
  budgetInr?: string;
  buyingTimeline?: string;
  customerMessage?: string;
  global?: string;
}

export default function LeadForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    propertyRequirement: '',
    budgetInr: '',
    buyingTimeline: '0-3 months',
    customerMessage: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live budget preview computation
  const numericBudget = formData.budgetInr ? parseInt(formData.budgetInr, 10) : NaN;
  const budgetPreview = !isNaN(numericBudget) && numericBudget > 0
    ? formatBudgetDisplay(numericBudget)
    : '';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error as user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, global: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions

    setErrors({});

    // Parse and prepare input
    const parsedBudget = formData.budgetInr.trim() === '' ? NaN : Number(formData.budgetInr.trim());

    const payload = {
      name: formData.name.trim(),
      location: formData.location.trim(),
      propertyRequirement: formData.propertyRequirement.trim(),
      budgetInr: parsedBudget,
      buyingTimeline: formData.buyingTimeline,
      customerMessage: formData.customerMessage.trim(),
    };

    // Client-side validation using the single shared Zod schema
    const validation = leadInputSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      const issues = validation.error.flatten().fieldErrors;
      if (issues.name?.[0]) fieldErrors.name = issues.name[0];
      if (issues.location?.[0]) fieldErrors.location = issues.location[0];
      if (issues.propertyRequirement?.[0])
        fieldErrors.propertyRequirement = issues.propertyRequirement[0];
      if (issues.budgetInr?.[0]) fieldErrors.budgetInr = issues.budgetInr[0];
      if (issues.buyingTimeline?.[0]) fieldErrors.buyingTimeline = issues.buyingTimeline[0];
      if (issues.customerMessage?.[0]) fieldErrors.customerMessage = issues.customerMessage[0];

      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const serverFieldErrors: FormErrors = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            if (Array.isArray(msgs) && msgs.length > 0) {
              (serverFieldErrors as Record<string, string>)[key] = msgs[0];
            }
          }
          setErrors(serverFieldErrors);
        } else {
          setErrors({ global: data.error || 'Failed to save lead. Please check the form.' });
        }
        setIsSubmitting(false);
        return;
      }

      // Successful creation: Navigate directly to the newly created Lead's detail page
      router.push(`/leads/${data.id}`);
      router.refresh();
    } catch {
      setErrors({ global: 'Network or server connection failed. Please try again.' });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {errors.global && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2 font-medium">
            <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errors.global}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
            Customer Name <span className="text-[#C84B45]">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Vikram Sharma"
            className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
              errors.name
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
            }`}
          />
          {errors.name && <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.name}</p>}
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
            Target Location / City <span className="text-[#C84B45]">*</span>
          </label>
          <input
            id="location"
            name="location"
            type="text"
            required
            maxLength={150}
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g. Whitefield, Bengaluru"
            className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
              errors.location
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
            }`}
          />
          {errors.location && <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.location}</p>}
        </div>
      </div>

      {/* Property Requirement */}
      <div>
        <label htmlFor="propertyRequirement" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
          Property Requirement <span className="text-[#C84B45]">*</span>
        </label>
        <input
          id="propertyRequirement"
          name="propertyRequirement"
          type="text"
          required
          maxLength={300}
          value={formData.propertyRequirement}
          onChange={handleChange}
          placeholder="e.g. 3 BHK gated community apartment near metro station"
          className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
            errors.propertyRequirement
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
              : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
          }`}
        />
        {errors.propertyRequirement && (
          <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.propertyRequirement}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budget in INR with Live Formatted Preview */}
        <div>
          <label htmlFor="budgetInr" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
            Budget (in INR) <span className="text-[#C84B45]">*</span>
          </label>
          <div className="relative">
            <input
              id="budgetInr"
              name="budgetInr"
              type="number"
              min={1}
              max={MAX_BUDGET_INR}
              step={1}
              required
              value={formData.budgetInr}
              onChange={handleChange}
              placeholder="e.g. 12000000"
              className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
                errors.budgetInr
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
              }`}
            />
          </div>
          {budgetPreview ? (
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800">
              <span>Preview:</span>
              <span className="font-bold text-zinc-900">{budgetPreview}</span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-zinc-400 font-medium">
              Enter raw rupee digits (e.g. 12000000 for 1.2 Crore)
            </p>
          )}
          {errors.budgetInr && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.budgetInr}</p>}
        </div>

        {/* Buying Timeline */}
        <div>
          <label htmlFor="buyingTimeline" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
            Buying Timeline <span className="text-[#C84B45]">*</span>
          </label>
          <select
            id="buyingTimeline"
            name="buyingTimeline"
            required
            value={formData.buyingTimeline}
            onChange={handleChange}
            className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
              errors.buyingTimeline
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
            }`}
          >
            {BUYING_TIMELINES.map((t) => (
              <option key={t.value} value={t.value} className="bg-white text-zinc-900">
                {t.label}
              </option>
            ))}
          </select>
          {errors.buyingTimeline && (
            <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.buyingTimeline}</p>
          )}
        </div>
      </div>

      {/* Customer Message */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="customerMessage" className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
            Inbound Customer Message / Inquiry <span className="text-[#C84B45]">*</span>
          </label>
          <span className="text-xs font-mono text-zinc-400">
            {formData.customerMessage.length} / 5,000
          </span>
        </div>
        <textarea
          id="customerMessage"
          name="customerMessage"
          rows={5}
          required
          maxLength={5000}
          value={formData.customerMessage}
          onChange={handleChange}
          placeholder="Paste or enter the customer's full inbound inquiry, email, or chat notes..."
          className={`w-full rounded-xl bg-zinc-50 border px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-1 transition-colors ${
            errors.customerMessage
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
              : 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400'
          }`}
        />
        {errors.customerMessage && (
          <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.customerMessage}</p>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          &larr; Cancel &amp; Back to Dashboard
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C84B45] hover:bg-[#b03e39] disabled:opacity-60 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Saving Lead to Database...</span>
            </>
          ) : (
            <span>Save Inbound Lead</span>
          )}
        </button>
      </div>
    </form>
  );
}

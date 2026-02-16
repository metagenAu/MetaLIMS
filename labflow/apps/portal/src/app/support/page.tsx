'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HelpCircle,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  Clock,
  MessageSquare,
  FileText,
  BookOpen,
} from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import { useSubmitSupportRequest } from '@/hooks/usePortalApi';

const supportSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  category: z.string().min(1, 'Please select a category'),
  orderId: z.string().optional(),
  priority: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

type SupportFormData = z.infer<typeof supportSchema>;

const CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'order', label: 'Order Question' },
  { value: 'results', label: 'Results Question' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Other' },
];

const FAQS = [
  {
    question: 'How do I submit a new order?',
    answer:
      'Navigate to Orders > New Order, select the test methods you need, describe your samples, and submit. You can also attach chain of custody forms.',
  },
  {
    question: 'When will my results be available?',
    answer:
      'Results are typically available within the turnaround time specified for each test method. You will receive a notification when your report is ready for download.',
  },
  {
    question: 'How do I pay an invoice?',
    answer:
      'Go to Invoices, click on the invoice, and use the "Pay Now" button to make a secure online payment via credit card.',
  },
  {
    question: 'Can I add team members to my account?',
    answer:
      'Yes, if you are a Client Admin, go to Account > Team to invite team members. They will receive an email invitation.',
  },
  {
    question: 'How do I track my sample status?',
    answer:
      'Visit the Samples page to see real-time status of all your samples. Click on any sample to see detailed test progress and results.',
  },
];

export default function SupportPage() {
  const submitRequest = useSubmitSupportRequest();
  const [submitted, setSubmitted] = useState(false);
  const [showFaqIndex, setShowFaqIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      category: '',
      priority: 'normal',
    },
  });

  async function onSubmit(data: SupportFormData) {
    try {
      await submitRequest.mutateAsync({
        subject: data.subject,
        category: data.category,
        message: data.message,
        orderId: data.orderId || undefined,
        priority: data.priority || undefined,
      });
      setSubmitted(true);
      reset();
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">
            Get help with your orders, results, or account.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">Phone</p>
            <p className="mt-1 text-sm text-primary">+1 (555) 123-4567</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Mon-Fri 8am-6pm EST</p>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">Email</p>
            <p className="mt-1 text-sm text-primary">support@labflow.com</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Response within 24 hours</p>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">Hours</p>
            <p className="mt-1 text-sm text-foreground">Mon - Fri</p>
            <p className="mt-0.5 text-xs text-muted-foreground">8:00 AM - 6:00 PM EST</p>
          </div>
        </div>

        {/* FAQs */}
        <div className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Frequently Asked Questions
              </h2>
            </div>
          </div>
          <div className="divide-y divide-border">
            {FAQS.map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() => setShowFaqIndex(showFaqIndex === index ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/50"
                >
                  <span className="text-sm font-medium text-foreground">{faq.question}</span>
                  <span className="ml-4 shrink-0 text-muted-foreground">
                    {showFaqIndex === index ? '-' : '+'}
                  </span>
                </button>
                {showFaqIndex === index && (
                  <div className="border-t border-border bg-muted/30 px-5 py-3">
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support form */}
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Submit a Support Request</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill out the form below and we will get back to you as soon as possible.
          </p>

          {submitted && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700">Request submitted</p>
                <p className="text-xs text-green-600">
                  We have received your support request and will respond within 24 hours.
                </p>
              </div>
            </div>
          )}

          {submitRequest.error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to submit request. Please try again or email us directly.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Category *
                </label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('category')}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-xs text-destructive">{errors.category.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Priority
                </label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('priority')}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Subject *
              </label>
              <input
                type="text"
                placeholder="Brief description of your issue"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                {...register('subject')}
              />
              {errors.subject && (
                <p className="mt-1 text-xs text-destructive">{errors.subject.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Related Order Number{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., ORD-2024-0001"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                {...register('orderId')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Message *
              </label>
              <textarea
                rows={5}
                placeholder="Describe your issue or question in detail..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                {...register('message')}
              />
              {errors.message && (
                <p className="mt-1 text-xs text-destructive">{errors.message.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitRequest.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitRequest.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </PortalLayout>
  );
}

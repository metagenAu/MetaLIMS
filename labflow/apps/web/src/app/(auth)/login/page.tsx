'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Beaker, Loader2, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (formData: LoginFormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Beaker className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            LabFlow LIMS
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Modern laboratory information management. Track samples, manage
            testing workflows, and deliver results with confidence.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-primary-foreground/70">
            <div>
              <p className="text-2xl font-bold text-primary-foreground">99.9%</p>
              <p className="text-xs">Uptime</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-foreground">50K+</p>
              <p className="text-xs">Samples/Month</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-foreground">ISO</p>
              <p className="text-xs">17025 Ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Beaker className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">LabFlow</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@laboratory.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected by LabFlow. Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}

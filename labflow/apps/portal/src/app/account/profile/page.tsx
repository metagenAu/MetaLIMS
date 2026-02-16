'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Save,
  Bell,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import { usePortalProfile, useUpdatePortalProfile } from '@/hooks/usePortalApi';
import { usePortalAuth } from '@/hooks/usePortalAuth';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  title: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { data: profile, isLoading, error, refetch } = usePortalProfile();
  const updateProfile = useUpdatePortalProfile();
  const { updateUser } = usePortalAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications'>('profile');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sampleReceived: true,
    testCompleted: true,
    reportReady: true,
    invoiceCreated: true,
    paymentReceived: true,
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || '',
        title: profile.title || '',
      });
      setNotifications(profile.notificationPrefs);
    }
  }, [profile]);

  async function onProfileSubmit(data: ProfileFormData) {
    setSaveSuccess(false);
    try {
      await updateProfile.mutateAsync(data);
      updateUser({ firstName: data.firstName, lastName: data.lastName });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  }

  async function onPasswordSubmit(data: PasswordFormData) {
    setSaveSuccess(false);
    try {
      await updateProfile.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  }

  async function saveNotifications() {
    setSaveSuccess(false);
    try {
      await updateProfile.mutateAsync({ notificationPrefs: notifications });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, password, and notification preferences.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load profile</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {profile && (
          <>
            {/* Account info banner */}
            <div className="flex items-center gap-4 rounded-lg border border-border bg-white p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-xl font-semibold">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <p className="text-xs text-muted-foreground">
                  {profile.companyName} &middot; {profile.role.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'password', label: 'Password', icon: Lock },
                { id: 'notifications', label: 'Notifications', icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Changes saved successfully.
              </div>
            )}

            {updateProfile.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Failed to save changes. Please try again.
              </div>
            )}

            {/* Profile tab */}
            {activeTab === 'profile' && (
              <form
                onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                className="rounded-lg border border-border bg-white p-5"
              >
                <h2 className="text-base font-semibold text-foreground">Profile Information</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      First name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...profileForm.register('firstName')}
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="mt-1 text-xs text-destructive">
                        {profileForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Last name
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...profileForm.register('lastName')}
                    />
                    {profileForm.formState.errors.lastName && (
                      <p className="mt-1 text-xs text-destructive">
                        {profileForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...profileForm.register('phone')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Lab Manager"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...profileForm.register('title')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Email
                    </label>
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Contact support to change your email.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Company
                    </label>
                    <input
                      type="text"
                      disabled
                      value={profile.companyName}
                      className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* Password tab */}
            {activeTab === 'password' && (
              <form
                onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                className="rounded-lg border border-border bg-white p-5"
              >
                <h2 className="text-base font-semibold text-foreground">Change Password</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...passwordForm.register('currentPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="mt-1 text-xs text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...passwordForm.register('newPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="mt-1 text-xs text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...passwordForm.register('confirmPassword')}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="mt-1 text-xs text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Update Password
                  </button>
                </div>
              </form>
            )}

            {/* Notifications tab */}
            {activeTab === 'notifications' && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-base font-semibold text-foreground">
                  Notification Preferences
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose which notifications you want to receive.
                </p>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifications((prev) => ({ ...prev, email: !prev.email }))
                      }
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        notifications.email ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          notifications.email ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="mb-3 text-sm font-medium text-foreground">
                      Notification Types
                    </p>
                    {[
                      {
                        key: 'sampleReceived' as const,
                        label: 'Sample Received',
                        desc: 'When your samples are received at the lab',
                      },
                      {
                        key: 'testCompleted' as const,
                        label: 'Test Completed',
                        desc: 'When tests are completed on your samples',
                      },
                      {
                        key: 'reportReady' as const,
                        label: 'Report Ready',
                        desc: 'When reports are ready for download',
                      },
                      {
                        key: 'invoiceCreated' as const,
                        label: 'Invoice Created',
                        desc: 'When new invoices are generated',
                      },
                      {
                        key: 'paymentReceived' as const,
                        label: 'Payment Received',
                        desc: 'Confirmation when payments are processed',
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <p className="text-sm text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNotifications((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            notifications[item.key] ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              notifications[item.key] ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={saveNotifications}
                    disabled={updateProfile.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Mail,
  UserPlus,
  X,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import {
  usePortalTeamMembers,
  useInviteTeamMember,
  useRemoveTeamMember,
} from '@/hooks/usePortalApi';
import { usePortalAuth } from '@/hooks/usePortalAuth';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.string().min(1, 'Please select a role'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const { user } = usePortalAuth();
  const { data: members, isLoading, error, refetch } = usePortalTeamMembers();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'CLIENT_USER' },
  });

  async function onInvite(data: InviteFormData) {
    setInviteSuccess(false);
    try {
      await inviteMember.mutateAsync(data);
      reset();
      setShowInviteForm(false);
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch {
      // Error handled by mutation
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId);
      setRemoveConfirm(null);
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage team members who can access your portal.
            </p>
          </div>
          <button
            onClick={() => {
              setShowInviteForm(!showInviteForm);
              setInviteSuccess(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {showInviteForm ? (
              <>
                <X className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </>
            )}
          </button>
        </div>

        {inviteSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Invitation sent successfully.
          </div>
        )}

        {/* Invite form */}
        {showInviteForm && (
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-foreground">Invite New Team Member</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Send an invitation email to add a new team member.
            </p>

            {inviteMember.error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Failed to send invitation. Please try again.
              </div>
            )}

            <form onSubmit={handleSubmit(onInvite)} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    First name
                  </label>
                  <input
                    type="text"
                    placeholder="John"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    {...register('firstName')}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Last name
                  </label>
                  <input
                    type="text"
                    placeholder="Doe"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    {...register('lastName')}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="john@company.com"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('role')}
                >
                  <option value="CLIENT_USER">User - Can view orders and results</option>
                  <option value="CLIENT_ADMIN">Admin - Full portal access</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-xs text-destructive">{errors.role.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={inviteMember.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviteMember.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team members list */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading team members...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">
              Failed to load team members
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {members && members.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium text-foreground">No team members</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite team members to share portal access.
            </p>
          </div>
        )}

        {members && members.length > 0 && (
          <div className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                Team Members ({members.length})
              </h2>
            </div>
            <div className="divide-y divide-border">
              {members.map((member) => {
                const isCurrentUser = member.id === user?.id;
                return (
                  <div key={member.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium',
                          member.isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {member.firstName} {member.lastName}
                          </p>
                          {isCurrentUser && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              You
                            </span>
                          )}
                          {!member.isActive && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        {member.role === 'CLIENT_ADMIN' ? 'Admin' : 'User'}
                      </div>
                      {member.lastLoginAt && (
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          Last login: {format(new Date(member.lastLoginAt), 'MMM d, yyyy')}
                        </span>
                      )}
                      {!isCurrentUser && (
                        <>
                          {removeConfirm === member.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRemove(member.id)}
                                disabled={removeMember.isPending}
                                className="rounded-md bg-destructive px-2 py-1 text-xs text-white hover:bg-destructive/90"
                              >
                                {removeMember.isPending ? 'Removing...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setRemoveConfirm(null)}
                                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirm(member.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

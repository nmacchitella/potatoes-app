'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, getErrorMessage } from '@/lib/api';
import Link from 'next/link';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border text-center">
                    <div className="text-red-500 text-5xl mb-4">&#x2715;</div>
                    <h1 className="text-xl font-bold text-charcoal mb-2">Invalid Link</h1>
                    <p className="text-warm-gray mb-6">This password reset link is invalid or missing.</p>
                    <Link href="/auth/login" className="btn-primary inline-block px-6 py-2">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await authApi.resetPassword(token, password);
            setSuccess(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to reset password. The link may be expired.'));
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border text-center">
                    <div className="text-green-500 text-5xl mb-4">&#x2713;</div>
                    <h1 className="text-2xl font-bold text-charcoal mb-2">Password Reset</h1>
                    <p className="text-warm-gray mb-8">Your password has been successfully reset.</p>
                    <Link href="/auth/login" className="btn-primary w-full block text-center py-2">
                        Login with New Password
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border">
                <h1 className="text-2xl font-bold text-charcoal mb-6 text-center">Set New Password</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="label mb-1 block">
                            New Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field w-full"
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="label mb-1 block">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input-field w-full"
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary disabled:opacity-50"
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-cream"></div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}

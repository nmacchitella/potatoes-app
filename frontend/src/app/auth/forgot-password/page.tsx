'use client';

import { useState } from 'react';
import { authApi, getErrorMessage } from '@/lib/api';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authApi.forgotPassword(email);
            setSubmitted(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'An error occurred. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border">
                <h1 className="text-2xl font-bold text-charcoal mb-2 text-center">Reset Password</h1>
                <p className="text-warm-gray text-center mb-8">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                {submitted ? (
                    <div className="text-center">
                        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded mb-6">
                            If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
                        </div>
                        <Link href="/auth/login" className="text-gold hover:underline">
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="label mb-1 block">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field w-full"
                                placeholder="you@example.com"
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
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <div className="text-center">
                            <Link href="/auth/login" className="text-sm text-warm-gray hover:text-charcoal transition-colors">
                                Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

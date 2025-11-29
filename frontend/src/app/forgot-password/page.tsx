'use client';

import { useState } from 'react';
import { authApi } from '@/lib/api';
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
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
            <div className="max-w-md w-full bg-dark-card p-8 rounded-lg border border-gray-800">
                <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">Reset Password</h1>
                <p className="text-gray-400 text-center mb-8">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                {submitted ? (
                    <div className="text-center">
                        <div className="bg-green-900/30 border border-green-800 text-green-200 p-4 rounded mb-6">
                            If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
                        </div>
                        <Link href="/login" className="text-primary hover:underline">
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
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
                            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
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
                            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                                Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

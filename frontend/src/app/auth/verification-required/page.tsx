'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import Link from 'next/link';

function VerificationRequiredContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email');

    const [resending, setResending] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    if (!email) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
                <div className="max-w-md w-full bg-dark-card p-8 rounded-lg border border-gray-800 text-center">
                    <div className="text-red-500 text-5xl mb-4">✕</div>
                    <h1 className="text-xl font-bold text-text-primary mb-2">Missing Information</h1>
                    <p className="text-gray-400 mb-6">No email address provided.</p>
                    <Link href="/auth/login" className="btn-primary inline-block px-6 py-2">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    const handleResendEmail = async () => {
        setResending(true);
        setError('');
        setMessage('');

        try {
            await authApi.resendVerification(email);
            setMessage('Verification email sent! Please check your inbox.');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to send verification email. Please try again.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
            <div className="max-w-md w-full bg-dark-card p-8 rounded-lg border border-gray-800 text-center">
                {/* Icon */}
                <div className="mb-6">
                    <div className="w-20 h-20 mx-auto bg-yellow-500/10 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-text-primary mb-2">Verify Your Email</h1>

                {/* Message */}
                <p className="text-gray-300 mb-2">
                    We've sent a verification link to:
                </p>
                <p className="text-primary font-medium mb-6">{email}</p>

                <p className="text-gray-400 text-sm mb-8">
                    Please check your inbox and click the verification link to activate your account.
                    Don't forget to check your spam folder if you don't see it.
                </p>

                {/* Success/Error Messages */}
                {message && (
                    <div className="bg-green-900/30 border border-green-800 text-green-200 px-4 py-3 rounded mb-4 text-sm">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Resend Button */}
                <button
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="w-full btn-primary mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>

                {/* Back to Login */}
                <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Back to Login
                </Link>
            </div>
        </div>
    );
}

export default function VerificationRequiredPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-dark-bg"></div>}>
            <VerificationRequiredContent />
        </Suspense>
    );
}

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authApi, getErrorMessage } from '@/lib/api';
import Link from 'next/link';

function VerificationRequiredContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email');

    const [resending, setResending] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    if (!email) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream px-4">
                <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border text-center">
                    <div className="text-red-500 text-5xl mb-4">&#x2715;</div>
                    <h1 className="text-xl font-bold text-charcoal mb-2">Missing Information</h1>
                    <p className="text-warm-gray mb-6">No email address provided.</p>
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
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to send verification email. Please try again.'));
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border text-center">
                {/* Icon */}
                <div className="mb-6">
                    <div className="w-20 h-20 mx-auto bg-gold/10 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-charcoal mb-2">Verify Your Email</h1>

                {/* Message */}
                <p className="text-warm-gray mb-2">
                    We've sent a verification link to:
                </p>
                <p className="text-gold font-medium mb-6">{email}</p>

                <p className="text-warm-gray text-sm mb-8">
                    Please check your inbox and click the verification link to activate your account.
                    Don't forget to check your spam folder if you don't see it.
                </p>

                {/* Success/Error Messages */}
                {message && (
                    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4 text-sm">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
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
                <Link href="/auth/login" className="text-sm text-warm-gray hover:text-charcoal transition-colors">
                    Back to Login
                </Link>
            </div>
        </div>
    );
}

export default function VerificationRequiredPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-cream"></div>}>
            <VerificationRequiredContent />
        </Suspense>
    );
}

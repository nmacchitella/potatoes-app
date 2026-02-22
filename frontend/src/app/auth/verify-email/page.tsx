'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, getErrorMessage } from '@/lib/api';
import Link from 'next/link';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link.');
            return;
        }

        const verify = async () => {
            try {
                await authApi.verifyEmail(token);
                setStatus('success');
                setMessage('Email verified successfully! You can now login.');
            } catch (err: unknown) {
                setStatus('error');
                setMessage(getErrorMessage(err, 'Verification failed. The link may be expired.'));
            }
        };

        verify();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg border border-border text-center">
                <h1 className="text-2xl font-bold text-charcoal mb-4">Email Verification</h1>

                <div className="mb-6">
                    {status === 'verifying' && (
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
                    )}
                    {status === 'success' && (
                        <div className="text-green-500 text-5xl mb-2">&#x2713;</div>
                    )}
                    {status === 'error' && (
                        <div className="text-red-500 text-5xl mb-2">&#x2715;</div>
                    )}
                </div>

                <p className="text-warm-gray mb-8">{message}</p>

                {status === 'success' && (
                    <Link
                        href="/auth/login"
                        className="btn-primary w-full block text-center py-2"
                    >
                        Go to Login
                    </Link>
                )}

                {status === 'error' && (
                    <Link
                        href="/auth/login"
                        className="text-gold hover:underline"
                    >
                        Back to Login
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-cream"></div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}

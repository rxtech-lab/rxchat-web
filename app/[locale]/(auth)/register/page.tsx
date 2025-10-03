'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';

import { register, type RegisterActionState } from '../actions';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';

export default function Page() {
  const router = useRouter();
  // Use translations from the auth namespace
  const t = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast({ type: 'error', description: t('userExists') });
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: t('failedToCreate') });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: t('invalidData'),
      });
    } else if (state.status === 'passwords_dont_match') {
      toast({
        type: 'error',
        description: t('passwordsDontMatch'),
      });
    } else if (state.status === 'success') {
      toast({ type: 'success', description: t('accountCreated') });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl gap-12 flex flex-col">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            {t('signUp')}
          </h3>
          <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
            {t('hasAccount')}
            <Link
              href="/login"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              {t('signIn')}
            </Link>
            {t('instead')}
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email} isRegister={true}>
          <SubmitButton isSuccessful={isSuccessful}>{t('signUp')}</SubmitButton>
          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {t('hasAccount')}
            <Link
              href="/login"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              {t('signIn')}
            </Link>
            {t('instead')}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin } from '@/api/mutations/authMutations';
import { ROUTES } from '@/config/routes';
import type { ApiError } from '@/types/api.types';

type FormErrors = {
  email?: string;
  password?: string;
};

function validateLoginForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return errors;
}

export function Component() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const login = useLogin();
  const serverError = login.error as ApiError | null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateLoginForm(email, password);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    login.mutate({ email: email.trim().toLowerCase(), password });
  }

  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
        Sign in to your account
      </h2>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {serverError.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={formErrors.email}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={login.isPending}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={formErrors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={login.isPending}
        />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={login.isPending}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Don&apos;t have an account?{' '}
        <Link
          to={ROUTES.REGISTER}
          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Create one
        </Link>
      </p>
    </>
  );
}

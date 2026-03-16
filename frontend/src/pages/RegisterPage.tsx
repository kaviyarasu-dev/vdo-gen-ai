import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRegister } from '@/api/mutations/authMutations';
import { ROUTES } from '@/config/routes';
import type { ApiError } from '@/types/api.types';

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
};

function validateRegisterForm(
  name: string,
  email: string,
  password: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!name.trim()) {
    errors.name = 'Name is required';
  } else if (name.trim().length > 100) {
    errors.name = 'Name must not exceed 100 characters';
  }

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (password.length > 128) {
    errors.password = 'Password must not exceed 128 characters';
  }

  return errors;
}

export function Component() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const register = useRegister();
  const serverError = register.error as ApiError | null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateRegisterForm(name, email, password);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    register.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
  }

  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
        Create your account
      </h2>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {serverError.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={formErrors.name}
          placeholder="Your full name"
          autoComplete="name"
          disabled={register.isPending}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={formErrors.email}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={register.isPending}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={formErrors.password}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          disabled={register.isPending}
        />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={register.isPending}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

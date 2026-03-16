import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showHomeLink?: boolean;
  className?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          showHomeLink={this.props.showHomeLink}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

type ErrorFallbackProps = {
  error: Error | null;
  onRetry: () => void;
  showHomeLink?: boolean;
  className?: string;
};

export function ErrorFallback({
  error,
  onRetry,
  showHomeLink = false,
  className,
}: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Something went wrong
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {error?.message ?? 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onRetry} size="sm">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        {showHomeLink && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}

/** Specialized fallback for canvas errors */
export function CanvasErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#1a1a2e]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Canvas error
      </h3>
      <p className="mt-2 max-w-md text-center text-sm text-gray-500 dark:text-gray-400">
        The workflow canvas encountered an error. Your work has been auto-saved.
      </p>
      <Button
        onClick={() => {
          if (onRetry) {
            onRetry();
          } else {
            window.location.reload();
          }
        }}
        className="mt-6"
        size="sm"
      >
        <RefreshCw className="h-4 w-4" />
        Reload canvas
      </Button>
    </div>
  );
}

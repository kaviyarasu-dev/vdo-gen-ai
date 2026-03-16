import { memo, useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ModelParameter } from '@/types/provider.types';

type ModelParameterFormProps = {
  parameters: ModelParameter[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  className?: string;
};

export const ModelParameterForm = memo(function ModelParameterForm({
  parameters,
  values,
  onChange,
  className,
}: ModelParameterFormProps) {
  const defaults = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const param of parameters) {
      map[param.key] = param.default;
    }
    return map;
  }, [parameters]);

  const handleResetAll = useCallback(() => {
    for (const param of parameters) {
      onChange(param.key, param.default);
    }
  }, [parameters, onChange]);

  if (parameters.length === 0) return null;

  const hasChanges = parameters.some(
    (param) => values[param.key] !== undefined && values[param.key] !== defaults[param.key],
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Model Parameters
        </label>
        {hasChanges && (
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {parameters.map((param) => (
        <ParameterField
          key={param.key}
          parameter={param}
          value={values[param.key] ?? param.default}
          onChange={(value) => onChange(param.key, value)}
        />
      ))}
    </div>
  );
});

type ParameterFieldProps = {
  parameter: ModelParameter;
  value: unknown;
  onChange: (value: unknown) => void;
};

function ParameterField({ parameter, value, onChange }: ParameterFieldProps) {
  const { type, label, description } = parameter;

  return (
    <div className="space-y-1">
      {type === 'boolean' ? (
        <BooleanField parameter={parameter} value={value} onChange={onChange} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {label}
            </label>
            {type === 'slider' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {String(value)}
              </span>
            )}
          </div>
          <FieldInput parameter={parameter} value={value} onChange={onChange} />
        </>
      )}
      {description && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{description}</p>
      )}
    </div>
  );
}

function FieldInput({ parameter, value, onChange }: ParameterFieldProps) {
  switch (parameter.type) {
    case 'number':
      return (
        <input
          type="number"
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
          )}
        />
      );

    case 'string':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
          )}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cn(
            'w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
          )}
        />
      );

    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
          )}
        >
          {parameter.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'slider':
      return (
        <input
          type="range"
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={parameter.min ?? 0}
          max={parameter.max ?? 100}
          step={parameter.step ?? 1}
          className="w-full accent-blue-600"
        />
      );

    default:
      return null;
  }
}

function BooleanField({ parameter, value, onChange }: ParameterFieldProps) {
  const isChecked = Boolean(value);

  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {parameter.label}
      </label>
      <button
        onClick={() => onChange(!isChecked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          isChecked
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            isChecked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

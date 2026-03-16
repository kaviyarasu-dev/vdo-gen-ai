import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

import { AppError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface ValidationIssue {
  instancePath?: string;
  params?: { missingProperty?: string };
  message?: string;
}

function formatValidationErrors(
  validation: ValidationIssue[],
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of validation) {
    const field = issue.instancePath?.replace(/^\//, '') ?? issue.params?.missingProperty ?? 'unknown';
    fields[field] = issue.message ?? 'Invalid value';
  }

  return fields;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof AppError) {
        const body: ErrorResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details && { details: error.details }),
          },
        };

        return reply.status(error.statusCode).send(body);
      }

      if (error.validation) {
        const body: ErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: { fields: formatValidationErrors(error.validation) },
          },
        };

        return reply.status(400).send(body);
      }

      logger.error(
        { err: error, requestId: request.id, url: request.url },
        'Unhandled error',
      );

      const body: ErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      };

      return reply.status(500).send(body);
    },
  );
}

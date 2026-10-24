import { applyDecorators, ArgumentMetadata, Body, Injectable, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';
import type { ApiErrorDetail } from '@boikonika/shared';
import { AppException } from '../errors/app-exception';

export function zodIssuesToDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || undefined,
    code: issue.code,
    message: issue.message,
  }));
}

/** Validates and transforms input with a zod schema; failures become a 400 VALIDATION_FAILED envelope. */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) throw AppException.validation(zodIssuesToDetails(result.error));
    return result.data;
  }
}

/** OpenAPI 3.0 JSON schema for a zod schema, describing the *input* the client must send. */
export function toOpenApi(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}

function attachMethodDecorator(target: object, key: string | symbol | undefined, decorator: MethodDecorator): void {
  if (key === undefined) return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) decorator(target, key, descriptor);
}

/** `@ZodBody(schema) dto` — validates the JSON body and documents it in Swagger. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key as string, index);
    attachMethodDecorator(target, key, ApiBody({ schema: toOpenApi(schema) }));
  };
}

/** `@ZodQuery(schema) query` — validates query parameters (with coercion) and documents each one. */
export function ZodQuery(schema: z.ZodObject): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key as string, index);
    const json = toOpenApi(schema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
    const decorators = Object.entries(json.properties ?? {}).map(([name, prop]) =>
      ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: prop }),
    );
    attachMethodDecorator(target, key, applyDecorators(...decorators));
  };
}

import { z } from 'zod';

export class ValidatorError extends Error {
  constructor(message: string) {
    super(message);
  }
}

// The ValidationResult object is compatible with zod "safeParse" method return value. This allows us to return the
// result of "zodSchema.safeParse" directly without wrapping the result in objects.
export type ValidationResult<T> = ValidationResultSuccess<T> | ValidationResultError;
export interface ValidationResultSuccess<T> {
  success: true;
  data: T;
}
export interface ValidationResultError {
  success: false;
  error: ValidatorError | z.ZodError<any>;
}

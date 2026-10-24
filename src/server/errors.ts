import { ZodError } from "zod";

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, details?: unknown, retryable = false) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function invalidInput(error: ZodError): DomainError {
  return new DomainError(422, "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง", error.flatten());
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

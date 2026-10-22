import { API_ERRORS } from '@vpds/ui-specification/contracts/apiErrors';
import type { ApiErrorCode } from '@vpds/ui-specification/contracts/apiErrors';
export { API_ERRORS } from '@vpds/ui-specification/contracts/apiErrors';
export type { ApiErrorCode } from '@vpds/ui-specification/contracts/apiErrors';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, readonly retryAfterSeconds?: number) {
    super(API_ERRORS[code].message);
    this.code = code;
  }
}

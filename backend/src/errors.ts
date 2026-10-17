export const API_ERRORS = {
  INVALID_REQUEST: { status: 400, message: 'Expected a JSON object with a nonblank prompt of at most 2000 characters.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request body exceeds the configured byte limit.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Use uncompressed application/json with a supported UTF charset.' },
  UNSUPPORTED_PROMPT: { status: 422, message: 'This non-AI mock supports only the documented example prompts.' },
  PROVIDER_FAILURE: { status: 502, message: 'The generation provider failed.' },
  INVALID_PROVIDER_OUTPUT: { status: 502, message: 'The provider returned an invalid UI specification.' },
  GENERATION_TIMEOUT: { status: 504, message: 'Generation exceeded the configured time limit.' },
  CORS_ORIGIN_DENIED: { status: 403, message: 'This browser origin is not allowed.' },
  METHOD_NOT_ALLOWED: { status: 405, message: 'This HTTP method is not supported for this endpoint.' },
  NOT_FOUND: { status: 404, message: 'The API endpoint was not found.' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected API error occurred.' },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode) {
    super(API_ERRORS[code].message);
    this.code = code;
  }
}

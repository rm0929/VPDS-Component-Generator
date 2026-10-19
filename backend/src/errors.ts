export const API_ERRORS = {
  INVALID_REQUEST: { status: 400, message: 'Expected a JSON object with a nonblank prompt of at most 2000 characters.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request body exceeds the configured byte limit.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Use uncompressed application/json with a supported UTF charset.' },
  UNSUPPORTED_PROMPT: { status: 422, message: 'This non-AI mock supports only the documented example prompts.' },
  UNSUPPORTED_UI_REQUEST: { status: 422, message: 'The request requires UI components or behavior outside the supported UI draft contract.' },
  PROVIDER_FAILURE: { status: 502, message: 'The generation provider failed.' },
  INVALID_PROVIDER_OUTPUT: { status: 502, message: 'The provider returned an invalid UI specification.' },
  INCOMPLETE_REQUIREMENTS: { status: 502, message: 'The generated UI is missing explicitly requested components. Try again with a simpler request.' },
  GENERATION_TIMEOUT: { status: 504, message: 'Generation exceeded the configured time limit.' },
  GENERATION_BUSY: { status: 503, message: 'Local generation is busy. Try again after the current request finishes.' },
  OLLAMA_UNAVAILABLE: { status: 503, message: 'The local Ollama server is unavailable.' },
  OLLAMA_MODEL_NOT_FOUND: { status: 503, message: 'The configured model was not found in local Ollama. Pull it before generating.' },
  OLLAMA_REQUEST_FAILED: { status: 502, message: 'Ollama rejected the generation request. Check the local runtime and model configuration.' },
  INVALID_MODEL_JSON: { status: 502, message: 'Ollama did not return a complete JSON document.' },
  MODEL_OUTPUT_TRUNCATED: { status: 502, message: 'Ollama reached the output token limit. Request a smaller UI or adjust the bounded limit.' },
  PROVIDER_RESPONSE_TOO_LARGE: { status: 502, message: 'The provider response exceeded the configured byte limit.' },
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

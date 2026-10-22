import type { z } from 'zod';
import { SelectionPocError } from './selection';
import { PocTransportError } from './ollama';
import { ModelUiCompilationError } from '../../src/compileModelUi';
import { ApiError } from '../../src/errors';

const keys = new Set(['version', 'form', 'enabled', 'formLabel', 'components', 'type', 'props', 'besidePrevious', 'unsupported',
  'label', 'placeholder', 'required', 'disabled', 'maxLength', 'content', 'level', 'root', 'children', 'id', 'name',
  'headingLevel', 'triggerLabel', 'closeLabel', 'variant', 'dismissible', 'text', 'links', 'options', 'defaultValue', 'title', 'description', 'action', 'includeCardholder', 'mode', 'value', 'paused', 'rows', 'defaultChecked', 'badgeType', 'dividerType', 'href',
  'done', 'done_reason', 'message', 'role']);
const codes = new Set(['invalid_type', 'invalid_value', 'invalid_union', 'invalid_format', 'too_big', 'too_small', 'unrecognized_keys', 'custom']);
const ownedMessages = new Set(['Expected bounded JSON selection data.', 'A supported selection must contain components.',
  'The first component has no previous component.', 'Unsupported categories must be unique.', 'Submit/reset buttons require a declared form.',
  'A disabled form must have a null label.']);

/** Only safe stages, bounded contract paths/codes and developer-owned messages. */
export function describePocFailure(error: unknown) {
  let stage = 'internal';
  let issues: readonly z.core.$ZodIssue[] = [];
  if (error instanceof SelectionPocError || error instanceof PocTransportError || error instanceof ModelUiCompilationError) {
    stage = error.stage; issues = error.issues;
  } else if (error instanceof ApiError) stage = error.code === 'GENERATION_TIMEOUT' ? 'timeout' : 'ollama_http';
  else if (error instanceof DOMException && error.name === 'AbortError') stage = 'aborted';
  return { stage, ...(error instanceof ApiError ? { code: error.code } : {}),
    ...(error instanceof SelectionPocError && error.stage === 'unsupported' ? { unsupported: error.unsupported } : {}),
    issues: issues.slice(0, 20).map(issue => ({
    path: issue.path.slice(0, 24).map(key => typeof key === 'number' && Number.isInteger(key) && key >= 0 && key <= 1000 ? key
      : typeof key === 'string' && keys.has(key) ? key : '[redacted]'),
    code: codes.has(issue.code) ? issue.code : 'custom',
    message: ownedMessages.has(issue.message) ? issue.message : 'A value violates the selection contract.',
  })) };
}

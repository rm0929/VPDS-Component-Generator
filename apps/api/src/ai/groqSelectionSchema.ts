import { z } from 'zod';
import { buildSelectionModelSchema, selectionMessages } from './model';
import { selectionSchema } from './selection';

type Schema = {
  type?: string; const?: string | number | boolean | null; enum?: string[];
  properties?: Record<string, Schema>; required?: string[]; items?: Schema;
  anyOf?: Schema[]; oneOf?: Schema[];
  minLength?: number; maxLength?: number; minimum?: number; maximum?: number;
  minItems?: number; maxItems?: number;
};
type Mapping = { schema: Record<string, unknown>; validator: z.ZodType;
  decode: (value: unknown) => unknown; encode: (value: unknown) => unknown };
const identity = (value: unknown) => value;

// Bound JSON before Zod traverses it; reject accessors, cycles and non-JSON values.
function boundedJson(value: unknown) {
  const pending = [{ value, depth: 0 }]; const seen = new Set<object>(); let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 4096 || item.depth > 12) return false;
    if (item.value === null || typeof item.value === 'boolean') continue;
    if (typeof item.value === 'number') { if (!Number.isFinite(item.value)) return false; continue; }
    if (typeof item.value === 'string') { if (item.value.length > 1000) return false; continue; }
    if (typeof item.value !== 'object' || seen.has(item.value)) return false;
    seen.add(item.value);
    if (!Array.isArray(item.value) && Object.getPrototypeOf(item.value) !== Object.prototype) return false;
    const keys = Reflect.ownKeys(item.value);
    if (keys.length + count + pending.length > 4096) return false;
    if (Array.isArray(item.value) && keys.length !== item.value.length + 1) return false;
    for (const key of keys) {
      if (Array.isArray(item.value) && key === 'length') continue;
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(item.value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor)) return false;
      pending.push({ value: descriptor.value, depth: item.depth + 1 });
    }
  }
  return true;
}

/** Provider wire grammar only. The authoritative selection/UI contracts are unchanged. */
export function createStrictSchemaAdapter(source: Schema) {
  function map(node: Schema): Mapping {
    const variants = node.oneOf ?? node.anyOf;
    if (variants) {
      const children = variants.map(map);
      const validator = z.union(children.map(child => child.validator));
      const convert = (value: unknown, direction: 'decode' | 'encode') => {
        if (direction === 'decode') {
          const match = children.find(child => child.validator.safeParse(value).success);
          if (!match) return validator.parse(value);
          return match.decode(value);
        }
        for (const child of children) {
          try {
            const converted = child.encode(value);
            if (child.validator.safeParse(converted).success) return converted;
          } catch (error) { if (!(error instanceof z.ZodError)) throw error; }
        }
        return validator.parse(value);
      };
      return { schema: { anyOf: children.map(child => child.schema) }, validator,
        decode: value => convert(value, 'decode'), encode: value => convert(value, 'encode') };
    }
    if ('const' in node) return { schema: { type: node.type, enum: [node.const] },
      validator: z.literal(node.const!), decode: identity, encode: identity };
    if (node.enum) return { schema: { type: node.type, enum: node.enum },
      validator: z.enum(node.enum), decode: identity, encode: identity };
    if (node.type === 'object' && node.properties) {
      const fields = Object.entries(node.properties).map(([key, schema]) => {
        const child = map(schema); const optional = !node.required?.includes(key);
        const meaningfulNull = child.validator.safeParse(null).success;
        return { key, child, optional, meaningfulNull };
      });
      const shape = Object.fromEntries(fields.map(field => [field.key,
        field.optional ? field.child.validator.nullable() : field.child.validator]));
      const validator = z.strictObject(shape);
      const convert = (value: unknown, direction: 'decode' | 'encode') => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        const object = value as Record<string, unknown>;
        // Do not remove unsupported keys in either direction.
        const result = { ...object };
        for (const { key, child, optional, meaningfulNull } of fields) {
          if (direction === 'decode') {
            if (optional && !meaningfulNull && object[key] === null) delete result[key];
            else if (Object.hasOwn(object, key)) result[key] = child.decode(object[key]);
          } else if (!Object.hasOwn(object, key) && optional) result[key] = null;
          else if (Object.hasOwn(object, key)) result[key] = child.encode(object[key]);
        }
        return result;
      };
      return { schema: { type: 'object', additionalProperties: false,
        properties: Object.fromEntries(fields.map(({ key, child, optional, meaningfulNull }) => [key,
          optional && !meaningfulNull ? { anyOf: [child.schema, { type: 'null' }] } : child.schema])),
        required: fields.map(field => field.key) }, validator,
        decode: value => convert(value, 'decode'), encode: value => convert(value, 'encode') };
    }
    if (node.type === 'array' && node.items) {
      const child = map(node.items); let validator = z.array(child.validator);
      if (node.minItems !== undefined) validator = validator.min(node.minItems);
      if (node.maxItems !== undefined) validator = validator.max(node.maxItems);
      return { schema: { type: 'array', items: child.schema }, validator,
        decode: value => Array.isArray(value) ? value.map(child.decode) : value,
        encode: value => Array.isArray(value) ? value.map(child.encode) : value };
    }
    let validator: z.ZodType;
    if (node.type === 'string') {
      let string = z.string();
      if (node.minLength !== undefined) string = string.min(node.minLength);
      if (node.maxLength !== undefined) string = string.max(node.maxLength);
      validator = string;
    } else if (node.type === 'number' || node.type === 'integer') {
      let number = node.type === 'integer' ? z.number().int() : z.number();
      if (node.minimum !== undefined) number = number.min(node.minimum);
      if (node.maximum !== undefined) number = number.max(node.maximum);
      validator = number;
    } else if (node.type === 'boolean') validator = z.boolean();
    else if (node.type === 'null') validator = z.null();
    else throw new Error('Unsupported internal Groq schema node.');
    return { schema: { type: node.type }, validator, decode: identity, encode: identity };
  }
  const mapping = map(source);
  const validate = (input: unknown) => {
    if (!boundedJson(input)) throw new z.ZodError([{ code: 'custom', path: [], message: 'Expected bounded JSON selection data.' }]);
    return mapping.validator.parse(input);
  };
  return { schema: mapping.schema,
    decode: (input: unknown) => mapping.decode(validate(input)),
    encode: (input: unknown) => {
      if (!boundedJson(input)) throw new z.ZodError([{ code: 'custom', path: [], message: 'Expected bounded JSON selection data.' }]);
      return validate(mapping.encode(input));
    } };
}

const adapter = createStrictSchemaAdapter(buildSelectionModelSchema() as Schema);
export const buildGroqSelectionSchema = () => structuredClone(adapter.schema);
export const decodeGroqSelection = (input: unknown) => selectionSchema.parse(adapter.decode(input));
export const encodeGroqSelection = (input: unknown) => adapter.encode(selectionSchema.parse(input));

export function groqSelectionMessages() {
  return selectionMessages().map(message => ({ ...message, content: message.role === 'assistant'
    ? JSON.stringify(encodeGroqSelection(JSON.parse(message.content)))
    : message.role === 'system' ? message.content.replace('Omit unspecified optional props instead of using null.',
      'The Groq wire schema requires all declared keys. Use null for unspecified optional properties; preserve required nullable values. Never use null instead of explicit false or zero.')
    : message.content }));
}

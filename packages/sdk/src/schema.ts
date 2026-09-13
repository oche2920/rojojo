/**
 * Canonical Rojojo manifest JSON Schema (draft-07).
 *
 * Single source of truth for the manifest contract. Provider apps must import
 * this via the `@rojojo/rojojo/schema` subpath export rather than keeping
 * their own copy, so a field addition only has to be made in one place.
 *
 * @example
 * ```ts
 * import Ajv from 'ajv'
 * import schema from '@rojojo/rojojo/schema'
 *
 * const validate = new Ajv().compile(schema)
 * ```
 */
import rojojoSchema from './schemas/rojojo.schema.json'

export const schema: Record<string, unknown> = rojojoSchema

export default schema

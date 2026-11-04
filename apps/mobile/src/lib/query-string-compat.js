// Export the existing consumers' named API without changing query semantics.
import queryString from 'query-string';

export const parse = queryString.parse;
export const stringify = queryString.stringify;

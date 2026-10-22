/**
 * Inert replacement for the `server-only` package.
 *
 * The real module throws an error when it is imported outside of a React
 * Server Component tree, which is exactly what a unit test does.
 */
export {};

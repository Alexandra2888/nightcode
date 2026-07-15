import { mock } from "bun:test";

// Shared test double for @clerk/backend so server route tests never hit the real
// Clerk API. Import this BEFORE app.ts in a test so the mock is registered before
// auth.ts constructs its client. A single shared registration (rather than one
// per test file) avoids bun's process-global mock.module clobbering across files
// — see oauth-test-double.ts in the CLI for the same pattern.
//
// Configure per test via `clerkDouble.userId`: a string = signed in as that user,
// `null` = signed out (the middleware then 401s).
export const clerkDouble: { userId: string | null } = {
  userId: "user_test",
};

mock.module("@clerk/backend", () => ({
  createClerkClient: () => ({
    authenticateRequest: async () => ({
      isAuthenticated: clerkDouble.userId !== null,
      toAuth: () => ({ userId: clerkDouble.userId }),
    }),
  }),
}));

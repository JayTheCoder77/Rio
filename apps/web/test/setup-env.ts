// Apps read AUTH_SECRET from the environment at import time (see
// lib/install-state.ts). CI has no .env file, so provide a deterministic
// value when one isn't set.
process.env.AUTH_SECRET ??= "test-secret-at-least-32-chars-long!!";

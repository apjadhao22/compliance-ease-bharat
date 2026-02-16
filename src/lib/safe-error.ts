/**
 * Maps raw error messages to safe, user-friendly messages
 * to prevent information leakage (database structure, internal details).
 */
export const getSafeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  // Log full error for debugging (server-side only in production)
  console.error("Operation failed:", error);

  // Map known error patterns to safe messages
  if (message.includes("unique constraint") || message.includes("duplicate key")) {
    return "This record already exists. Please check for duplicates.";
  }
  if (message.includes("foreign key") || message.includes("violates foreign key")) {
    return "Cannot complete: related records exist or are missing.";
  }
  if (message.includes("not-null") || message.includes("null value")) {
    return "A required field is missing. Please fill in all required fields.";
  }
  if (message.includes("check constraint")) {
    return "One or more values are invalid. Please review your input.";
  }
  if (message.includes("permission denied") || message.includes("row-level security")) {
    return "You don't have permission to perform this action.";
  }
  if (message.includes("JWT") || message.includes("token")) {
    return "Your session has expired. Please sign in again.";
  }
  if (message.includes("NetworkError") || message.includes("Failed to fetch") || message.includes("network")) {
    return "Network error. Please check your connection and try again.";
  }
  if (message.includes("Invalid login") || message.includes("invalid_credentials")) {
    return "Invalid email or password.";
  }
  if (message.includes("Email not confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (message.includes("User already registered")) {
    return "An account with this email already exists.";
  }
  if (message.includes("Password should be")) {
    return "Password does not meet the minimum requirements.";
  }

  return "An unexpected error occurred. Please try again.";
};

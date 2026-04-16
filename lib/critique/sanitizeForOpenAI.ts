/**
 * Strip C0/C1 control characters (except tab \t, newline \n, carriage-return \r)
 * from a string before including it in an OpenAI API request body.
 */
export function sanitizeForOpenAI(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
}

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
];

export default eslintConfig;

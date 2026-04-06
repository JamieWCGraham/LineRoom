import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
        Create account
      </h1>
      <p className="mb-8 text-center text-sm text-zinc-500">
        <Link href="/" className="text-zinc-400 underline hover:text-zinc-300">
          ← Back to LineRoom
        </Link>
      </p>
      <SignupForm />
    </div>
  );
}

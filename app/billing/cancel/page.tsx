import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">
        Checkout canceled
      </h1>
      <p className="mt-3 text-sm text-zinc-400">
        No charges were made. You can upgrade anytime from your account page.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/account" className="text-emerald-500/90 underline">
          Account
        </Link>
        {" · "}
        <Link href="/lineroom" className="text-emerald-500/90 underline">
          LineRoom
        </Link>
      </p>
    </div>
  );
}

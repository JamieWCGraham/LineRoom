import { TESTIMONIALS } from "@/lib/site-config";

export function Testimonials() {
  const quotes = TESTIMONIALS.slice(0, 3);
  if (quotes.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-heading">
      <h2
        id="testimonials-heading"
        className="text-2xl font-semibold tracking-tight text-zinc-50"
      >
        Songwriters are already rewriting with LineRoom
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {quotes.map((item) => (
          <li
            key={`${item.name}-${item.detail}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
          >
            <blockquote className="text-sm leading-relaxed text-zinc-200">
              “{item.quote}”
            </blockquote>
            <p className="mt-4 text-sm font-medium text-zinc-100">{item.name}</p>
            <p className="text-xs text-zinc-500">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

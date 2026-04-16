import { z } from "zod";

const literalScore = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/** Accepts slightly out-of-range or fractional scores from the model. */
export const dimensionScore1to5Schema = z
  .union([z.number(), z.string()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) return 3;
    return Math.max(1, Math.min(5, Math.round(n)));
  })
  .pipe(literalScore);

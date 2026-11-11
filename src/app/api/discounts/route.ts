import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiscountFresh } from "@/lib/catalog";
import { evaluateDiscount, normalizeCode } from "@/lib/pricing";

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().min(0).max(1_000_000),
});

/**
 * Looks up a discount code for the cart drawer. The cart uses the returned rule to show the
 * new total as items change; checkout checks the code again on the server either way.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a discount code." }, { status: 400 });

  const code = normalizeCode(parsed.data.code);
  const rule = await getDiscountFresh(code);
  const result = evaluateDiscount(rule, parsed.data.subtotal);
  if (!rule || !result.ok) {
    return NextResponse.json({ error: result.ok ? "This code isn't valid." : result.reason }, { status: 422 });
  }

  return NextResponse.json({
    discount: {
      code: rule.code,
      description: rule.description,
      type: rule.type,
      value: rule.value,
      minSubtotal: rule.minSubtotal,
      active: rule.active,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
    },
  });
}

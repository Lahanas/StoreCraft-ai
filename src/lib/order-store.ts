import "server-only";
import type { OrderStore } from "@/lib/fulfillment";
import { OrderExistsError } from "@/lib/fulfillment";
import { writeClient } from "@/sanity/write-client";

// Variant keys are interpolated into a patch path, so only allow plain keys.
const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

/** Sanity implementation of OrderStore: one transaction per order. */
export const sanityOrderStore: OrderStore = {
  async orderExists(orderId) {
    return Boolean(await writeClient.fetch<string | null>(`*[_id == $id][0]._id`, { id: orderId }));
  },

  async commitOrder(order, decrements, discountCode) {
    // `create` fails with 409 if the order id exists, which aborts the whole transaction.
    const tx = writeClient.transaction().create(order);
    for (const d of decrements) {
      if (!SAFE_KEY.test(d.variantKey)) continue;
      tx.patch(d.productId, (p) => p.dec({ [`variants[_key=="${d.variantKey}"].stock`]: d.quantity }));
    }
    if (discountCode) {
      const discountId = await writeClient.fetch<string | null>(
        `*[_type == "discount" && code == $code][0]._id`,
        { code: discountCode },
      );
      if (discountId) tx.patch(discountId, (p) => p.setIfMissing({ timesUsed: 0 }).inc({ timesUsed: 1 }));
    }
    try {
      await tx.commit();
    } catch (err) {
      if (typeof err === "object" && err !== null && "statusCode" in err && err.statusCode === 409) {
        throw new OrderExistsError(order._id);
      }
      throw err;
    }
  },
};

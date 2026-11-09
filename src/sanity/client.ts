import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "./env";

/** Read-only client, safe to use anywhere on the server. */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
});

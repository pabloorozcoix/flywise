import { redirect } from "next/navigation";

/**
 * Redirect /results to /history (preserves query string).
 * Base route was moved to /history; this keeps old links working.
 */
export default async function ResultsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query =
    typeof params === "object" && params !== null && !Array.isArray(params)
      ? new URLSearchParams(
          Object.entries(params).flatMap(([k, v]) =>
            Array.isArray(v) ? v.map((val) => [k, val]) : [[k, String(v)]]
          )
        ).toString()
      : "";
  const target = query ? `/history?${query}` : "/history";
  redirect(target);
}

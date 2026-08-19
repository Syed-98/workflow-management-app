import type { Prisma } from "@prisma/client";

/**
 * Builds a Prisma where clause for customer text search.
 * Supports single-field matches and multi-word full-name queries (e.g. "Alice Johnson").
 */
export function buildCustomerSearchWhere(
  search: string
): Prisma.CustomerWhereInput | undefined {
  const trimmed = search.trim();
  if (!trimmed) return undefined;

  const terms = trimmed.split(/\s+/).filter(Boolean);

  const fieldMatches = (value: string): Prisma.CustomerWhereInput[] => [
    { firstName: { contains: value } },
    { lastName: { contains: value } },
    { email: { contains: value } },
    { company: { contains: value } },
  ];

  if (terms.length >= 2) {
    const [first, ...rest] = terms;
    const last = rest.join(" ");

    return {
      OR: [
        {
          AND: [
            { firstName: { contains: first } },
            { lastName: { contains: last } },
          ],
        },
        {
          AND: [
            { firstName: { contains: last } },
            { lastName: { contains: first } },
          ],
        },
        ...fieldMatches(trimmed),
      ],
    };
  }

  return {
    OR: fieldMatches(trimmed),
  };
}

/**
 * Customer relation filter for application search.
 */
export function buildCustomerRelationSearchWhere(
  search: string
): Prisma.CustomerWhereInput {
  return buildCustomerSearchWhere(search) ?? {};
}

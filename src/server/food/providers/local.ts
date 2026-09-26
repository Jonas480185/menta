/**
 * LocalFoodProvider – the public food database in our own Postgres, behind the same
 * FoodProvider contract as the external providers. Only public, non-archived foods.
 *
 * `searchFoods` is intentionally simple (token ILIKE + popularity); real ranking
 * (pg_trgm/FTS, user history) is the Food Search service's job.
 */
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/create";
import { foods } from "@/server/db/schema";
import type { FoodDetails, FoodProvider, ProviderSearchOptions } from "@/server/food/types";
import { normalizeFoodText } from "@/domain/food/normalize";
import { barcodeLookupVariants } from "@/domain/food/barcode";
import { getFoodDetailsByIds, isUuid } from "@/server/food/persist";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const publicActive = () =>
  and(eq(foods.visibility, "public"), isNull(foods.ownerUserId), eq(foods.isArchived, false));

export class LocalFoodProvider implements FoodProvider {
  readonly id = "local" as const;

  constructor(private readonly db: DbOrTx) {}

  async searchFoods(query: string, opts: ProviderSearchOptions = {}): Promise<FoodDetails[]> {
    const tokens = normalizeFoodText(query).split(" ").filter(Boolean).slice(0, 6);
    if (!tokens.length) return [];
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const conditions: SQL[] = tokens.map(
      (t) => or(ilike(foods.nameNormalized, `%${escapeLike(t)}%`), ilike(foods.brandNormalized, `%${escapeLike(t)}%`))!,
    );
    const rows = await this.db
      .select({ id: foods.id })
      .from(foods)
      .where(and(publicActive(), ...conditions))
      .orderBy(
        desc(sql`(${foods.language} = ${opts.language ?? "de"})`),
        desc(foods.popularity),
        sql`length(${foods.name})`,
      )
      .limit(limit);
    return getFoodDetailsByIds(
      this.db,
      rows.map((r) => r.id),
    );
  }

  /** `sourceId` is our food id (uuid). */
  async getFood(id: string): Promise<FoodDetails | null> {
    if (!isUuid(id)) return null;
    const [row] = await this.db
      .select({ id: foods.id })
      .from(foods)
      .where(and(eq(foods.id, id), eq(foods.visibility, "public"), isNull(foods.ownerUserId)))
      .limit(1);
    return row ? ((await getFoodDetailsByIds(this.db, [row.id]))[0] ?? null) : null;
  }

  async getFoodByBarcode(barcode: string): Promise<FoodDetails | null> {
    const variants = barcodeLookupVariants(barcode);
    if (!variants.length) return null;
    const [row] = await this.db
      .select({ id: foods.id })
      .from(foods)
      .where(and(publicActive(), inArray(foods.barcode, variants)))
      .orderBy(
        sql`case ${foods.dataQuality} when 'verified' then 0 when 'complete' then 1 when 'partial' then 2 else 3 end`,
        desc(foods.popularity),
      )
      .limit(1);
    return row ? ((await getFoodDetailsByIds(this.db, [row.id]))[0] ?? null) : null;
  }
}

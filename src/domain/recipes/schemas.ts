import { z } from "@/lib/zod";

/**
 * Zod schemas for recipe input – shared by services, server actions and the client builder
 * (German messages). Ingredient grams are always derived on the server from the serving
 * (serving.grams × quantity); without a serving, `quantity` is the amount in base units (g/ml).
 */

export const RECIPE_LIMITS = {
  nameMax: 80,
  descriptionMax: 1000,
  servings: { min: 0.25, max: 100 },
  totalWeightG: { min: 1, max: 50_000 },
  quantity: { max: 100_000 },
  ingredientsMax: 100,
} as const;

const uuid = (message: string) => z.uuid(message);

export const RecipeIngredientInputSchema = z.object({
  foodId: uuid("Bitte wähle ein Lebensmittel aus."),
  servingId: uuid("Ungültige Portion.").nullable(),
  quantity: z
    .number({ error: "Bitte gib eine Menge an." })
    .finite("Bitte gib eine Menge an.")
    .positive("Die Menge muss größer als 0 sein.")
    .max(RECIPE_LIMITS.quantity.max, "Diese Menge ist zu groß."),
});

export const RecipeInputSchema = z.object({
  name: z
    .string({ error: "Bitte gib einen Namen ein." })
    .trim()
    .min(1, "Bitte gib einen Namen ein.")
    .max(RECIPE_LIMITS.nameMax, `Maximal ${RECIPE_LIMITS.nameMax} Zeichen.`),
  description: z
    .string()
    .trim()
    .max(RECIPE_LIMITS.descriptionMax, `Maximal ${RECIPE_LIMITS.descriptionMax} Zeichen.`)
    .nullable()
    .transform((v) => (v ? v : null)),
  servings: z
    .number({ error: "Bitte gib die Anzahl der Portionen an." })
    .finite("Bitte gib die Anzahl der Portionen an.")
    .min(
      RECIPE_LIMITS.servings.min,
      `Mindestens ${RECIPE_LIMITS.servings.min.toString().replace(".", ",")} Portionen.`,
    )
    .max(RECIPE_LIMITS.servings.max, `Höchstens ${RECIPE_LIMITS.servings.max} Portionen.`),
  totalWeightG: z
    .number({ error: "Bitte gib ein Gewicht in Gramm an." })
    .finite("Bitte gib ein Gewicht in Gramm an.")
    .min(RECIPE_LIMITS.totalWeightG.min, "Das Gewicht muss größer als 0 g sein.")
    .max(RECIPE_LIMITS.totalWeightG.max, "Dieses Gewicht ist zu groß.")
    .nullable(),
  ingredients: z
    .array(RecipeIngredientInputSchema)
    .min(1, "Füge mindestens eine Zutat hinzu.")
    .max(RECIPE_LIMITS.ingredientsMax, `Höchstens ${RECIPE_LIMITS.ingredientsMax} Zutaten.`),
});

export type RecipeIngredientInput = z.infer<typeof RecipeIngredientInputSchema>;
/** Parsed recipe input (description "" → null). */
export type RecipeInput = z.output<typeof RecipeInputSchema>;
/** Raw recipe input as sent by a form/action. */
export type RecipeInputRaw = z.input<typeof RecipeInputSchema>;

export const RecipeIdSchema = z.object({ id: z.uuid("Ungültiges Rezept.") });

/**
 * Thrown for missing/invalid calculator input. `message` is German and user-presentable;
 * `field` names the offending BodyProfile/GoalSettings field so services can map it to
 * AppError("VALIDATION", message, { [field]: [message] }).
 */
export class CalorieInputError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "CalorieInputError";
  }
}

export function isCalorieInputError(err: unknown): err is CalorieInputError {
  return err instanceof CalorieInputError || (err instanceof Error && err.name === "CalorieInputError");
}

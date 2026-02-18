/**
 * Interpolates template variables in the format {{args.propertyName}}
 * with values from the provided arguments object.
 */
export function interpolateTemplate(
  template: string,
  args: Record<string, unknown>
): string {
  return template.replace(/\{\{args\.(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: unknown = args;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Return original if path not found
      }
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Recursively interpolates all string values in an object or array
 */
export function interpolateDeep<T>(obj: T, args: Record<string, unknown>): T {
  if (typeof obj === "string") {
    return interpolateTemplate(obj, args) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateDeep(item, args)) as T;
  }

  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateDeep(value, args);
    }
    return result as T;
  }

  return obj;
}

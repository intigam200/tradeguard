export const validators = {
  englishName: (value: string) => /^[a-zA-Z0-9\s\-]+$/.test(value),
  email:       (value: string) => /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(value),
  telegramId:  (value: string) => /^(\d+|@[a-zA-Z0-9_]{5,})$/.test(value),
  apiKey:      (value: string) => /^[a-zA-Z0-9\-_]{10,}$/.test(value),
};

export const errorMessages = {
  englishName: "Must contain only English letters, numbers, spaces or hyphens",
  email:       "Enter a valid email address using Latin characters only",
  telegramId:  "Enter numeric Chat ID or @username in Latin characters",
  apiKey:      "Must contain only Latin letters and numbers (min 10 characters)",
};

export const filters = {
  englishName: (v: string) => v.replace(/[^a-zA-Z0-9\s\-]/g, ""),
  email:       (v: string) => v.replace(/[^a-zA-Z0-9._%+\-@]/g, ""),
  telegramId:  (v: string) => v.replace(/[^a-zA-Z0-9@_]/g, ""),
  apiKey:      (v: string) => v.replace(/[^a-zA-Z0-9\-_]/g, ""),
};

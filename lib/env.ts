export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new HttpError(500, `Missing server env var ${name}. Add it in your Buildman deployment settings.`);
  return value;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wraps a route handler: JSON in, JSON out, errors become { error } with a status. */
export function handle(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      return Response.json(await fn(req));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof Error ? e.message : String(e);
      return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
    }
  };
}

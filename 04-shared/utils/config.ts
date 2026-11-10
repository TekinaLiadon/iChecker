import {z} from "zod";

export const envSchema = z.object({
    BOT_TOKEN: z.string().min(1),
    BOT_CHAT: z.coerce.number().int().refine(value => value !== 0),
    POSTGRES_URL: z.url({protocol: /^postgres(ql)?$/}),
    KINOPOISK_TOKEN: z.string().min(1),
    IS_DEV: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: Record<string, string | undefined>): Env => envSchema.parse(source);

const parsing = envSchema.safeParse(Bun.env);
if (!parsing.success) {
    console.error(parsing.error.issues);
    process.exit(1);
}

const env: Env = parsing.data;

export default env;

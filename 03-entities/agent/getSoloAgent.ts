import { sql } from "bun";
export default async (name)=> {
    const result = await sql`SELECT * FROM agents WHERE name LIKE ${name} LIMIT 1;`
    return result[0]
}
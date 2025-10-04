import { sql } from "bun";
export default async (name:string, number:number = 0)=> {
    const result = await sql`SELECT * FROM agents WHERE SPLIT_PART(name, ' ', 1) ILIKE ${name} ORDER BY id
  LIMIT 1 OFFSET ${number}`
    const countResult = await sql`SELECT COUNT(*) FROM agents WHERE SPLIT_PART(name, ' ', 1) ILIKE ${name}`;
    return {agent: result[0], number: countResult[0].count}
}
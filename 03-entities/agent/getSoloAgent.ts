import { sql } from "bun";
export default async (name:string, number:number = 0)=> {
    const result = await sql`SELECT * FROM agents WHERE SPLIT_PART(name, ' ', 1) ILIKE ${name}`
    return {agent: result[number], number: result.length - 1}
}
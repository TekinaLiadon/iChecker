import { sql } from "bun";
export default async (name:string, number:number = 0)=> {
    const result = await sql`
        SELECT a.*, i.img, i.description 
        FROM agents a
        LEFT JOIN info i ON a.id = i.agent_id
        WHERE EXISTS (
            SELECT 1
            FROM unnest(regexp_split_to_array(a.name, '[\\s"]+')) AS part
            WHERE LOWER(trim(both '()' from part)) = LOWER(${name})
        ) 
        ORDER BY a.id 
        LIMIT 1 OFFSET ${number};`;
    const countResult = await sql`SELECT COUNT(*) FROM agents WHERE SPLIT_PART(name, ' ', 1) ILIKE ${name}`;
    return {agent: result[0], number: countResult[0].count}
}
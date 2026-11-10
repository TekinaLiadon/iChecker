import { sql, type SQL } from "bun";

const up = async (tx: SQL) => {
    await tx`CREATE TABLE agents (
            id SERIAL PRIMARY KEY,
            field_number INTEGER NOT NULL,
            name VARCHAR(256) NOT NULL,
            article TEXT NOT NULL,
            adoption_date VARCHAR(256),
            exclusion_date VARCHAR(256),
            domain_name TEXT,
            type_agent VARCHAR(256),
            kinopoisk_info jsonb,
            kinopoisk_id INTEGER,
            kinopoisk_full jsonb,
            birthday VARCHAR(64),
            last_modified BIGINT NOT NULL);`

    await tx`CREATE TABLE info (
            id SERIAL PRIMARY KEY,
            img VARCHAR(256),
            description TEXT,
            agent_id INTEGER UNIQUE REFERENCES agents(id) ON DELETE CASCADE
            );`
}

const down = async (tx: SQL) => {
    await tx`DROP TABLE IF EXISTS info;`
    await tx`DROP TABLE IF EXISTS agents;`
}

export { up, down };

// Pequena camada de acesso ao Postgres com a mesma forma do D1 usado antes
// (prepare/bind/first/all/run/batch). Os placeholders `?` viram `$1, $2, ...`.

export type QueryResult = { rows: Record<string, any>[]; count: number };
export type Executor = (sql: string, params: unknown[]) => Promise<QueryResult>;
export type Driver = { query: Executor; transaction<T>(fn: (query: Executor) => Promise<T>): Promise<T> };

const toPositional = (sql: string) => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };
const clean = (params: unknown[]) => params.map(value => (value === undefined ? null : value));

export type Statement = {
  readonly sql: string;
  readonly params: unknown[];
  bind(...params: unknown[]): Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};

function statement(sql: string, params: unknown[], exec: Executor): Statement {
  const run = () => exec(toPositional(sql), clean(params));
  return {
    sql, params,
    bind: (...next: unknown[]) => statement(sql, next, exec),
    first: async <T>() => ((await run()).rows[0] ?? null) as T | null,
    all: async <T>() => ({ results: (await run()).rows as T[] }),
    run: async () => ({ meta: { changes: (await run()).count } }),
  };
}

export class Database {
  private driver: Driver;
  constructor(driver: Driver) { this.driver = driver; }
  prepare(sql: string) { return statement(sql, [], this.driver.query); }
  /** Executa todas as instruções em uma única transação; qualquer erro desfaz tudo. */
  async batch(statements: Statement[]) {
    return await this.driver.transaction(async query => {
      const results: QueryResult[] = [];
      for (const s of statements) results.push(await query(toPositional(s.sql), clean(s.params)));
      return results;
    });
  }
}

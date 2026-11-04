import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Database} from '../functions/api/db.ts';
test('JSON já serializado chega como objeto, inclusive com driver de produção',async()=>{
 const pg=new PGlite();
 const query=async(sql,params)=>{
  // Postgres.js serializa novamente parâmetros cujo tipo inferido é jsonb.
  const wire=params.map((p,i)=>new RegExp('\\$'+(i+1)+'::jsonb').test(sql)?JSON.stringify(p):p);
  const result=await pg.query(sql,wire);return {rows:result.rows,count:result.affectedRows};
 };
 const db=new Database({query,transaction:fn=>fn(query)});
 const original={title:'Orçamento teste',items:[{name:'Polimento',price:12500,qty:2}],total:25000};
 const row=await db.prepare('SELECT ?::jsonb AS data').bind(JSON.stringify(original)).first();
 assert.deepEqual(row.data,original);
 await pg.close();
});

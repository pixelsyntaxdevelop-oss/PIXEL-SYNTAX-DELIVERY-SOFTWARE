// Stable keyset paging: PostgREST commonly caps a single response at 1000 rows.
// Never silently report a truncated tenant dataset.
export async function tenantRows(db:any, table:string, tenantId:string, columns='*', configure?:(q:any)=>any):Promise<any[]> {
  const rows:any[]=[];
  let lastId:string|undefined;
  for(let page=0;page<1000;page++){
    let q=db.from(table).select(columns).eq('tenant_id',tenantId).order('id',{ascending:true}).limit(500);
    if(configure) q=configure(q);
    if(lastId) q=q.gt('id',lastId);
    const {data,error}=await q;
    if(error) throw new Error('Unable to load '+table+': '+error.message);
    const batch=Array.isArray(data)?data:[];
    if(batch.length===0) return rows;
    rows.push(...batch);
    const nextId=String(batch[batch.length-1].id || '');
    if(!nextId || nextId===lastId) throw new Error('Pagination failed for '+table);
    lastId=nextId;
    if(batch.length<500) return rows;
  }
  throw new Error('Dataset exceeds safe request limit; use a narrower filter.');
}

import { Buffer } from 'node:buffer';
export const companyFolders = ['licenses','management','tax','invoices','contracts','insurance','banking','government','office','vendors','other'] as const;
const validFolder=(s:string)=> (companyFolders as readonly string[]).includes(s);
const adminRoles=new Set(['SUPER_ADMIN','COMPANY_ADMIN','ERP_USER']);
const financeFolders=new Set(['invoices','tax','contracts','banking','vendors']);
const opsFolders=new Set(['licenses','insurance','government','office','vendors','contracts','other']);
const allowed=(role:string,folder:string)=>adminRoles.has(role)||(role==='ACCOUNTANT'&&financeFolders.has(folder))||(role==='OPERATIONS_MANAGER'&&opsFolders.has(folder));
const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const clean=(v:unknown,max:number)=>String(v||'').trim().slice(0,max);
const dateValid=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
const validMime=(bytes:Uint8Array,mime:string)=>mime==='application/pdf'?String.fromCharCode(...bytes.slice(0,5))==='%PDF-':mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
// Store new company records independently of the legacy employee/vehicle schema.
// The binary and its searchable metadata are written together as one R2 object.
export async function companyArchive(request:Request,r2:any,tenantId:string,role:string,userId:string,path:string):Promise<Response>{
 if(!r2)return reply({error:'Private company storage unavailable'},503);
 const folders=companyFolders.filter(f=>allowed(role,f));
 if(!folders.length)return reply({error:'Company document access denied'},403);
 const prefix='documents/'+tenantId+'/company/archive/';
 const url=new URL(request.url);
 const record=(obj:any)=>{try{const d=JSON.parse(obj.customMetadata?.record||'{}');if(!validFolder(d.folder)||!allowed(role,d.folder)||d.id!==obj.key.slice(prefix.length))return null;return {...d,size:obj.size};}catch{return null;}};
 try{
  if(request.method==='GET'&&path==='/api/erp/company-archive'){
   const list:any[]=[];let cursor:string|undefined;
   do{
    const page=await r2.list({prefix,limit:500,include:['customMetadata'],...(cursor?{cursor}:{})});
    for(const obj of page.objects){const d=record(obj);if(d)list.push(d);}
    if(page.truncated&&!page.cursor)throw new Error('Incomplete archive listing');
    cursor=page.truncated?page.cursor:undefined;
   }while(cursor);
   list.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))||String(b.id).localeCompare(String(a.id)));
   const counts:Record<string,number>={};for(const d of list)counts[d.folder]=(counts[d.folder]||0)+1;
   const folder=url.searchParams.get('folder')||'',month=url.searchParams.get('month')||'',branch=url.searchParams.get('branch')||'',client=url.searchParams.get('client')||'',q=(url.searchParams.get('q')||'').toLowerCase().trim();
   const matched=list.filter(d=>(!folder||d.folder===folder)&&(!month||d.month===month)&&(!branch||d.branch===branch)&&(!client||String(d.client||'').trim().toLowerCase()===client.trim().toLowerCase())&&(!q||[d.title,d.type,d.person,d.reference,d.fileName,d.client,d.branch,d.month].join(' ').toLowerCase().includes(q)));
   const page=Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1)),limit=24;
   const choices=(key:string)=>[...new Set(list.map(d=>d[key]).filter(Boolean))].sort();
   const invoiceHistory=new Map<string,any>();for(const d of list){if(d.folder!=='invoices'||!d.client)continue;const key=String(d.client).trim().toLowerCase();let h=invoiceHistory.get(key);if(!h){h={client:d.client,count:0,latest:d,latestNumbered:null};invoiceHistory.set(key,h);}h.count++;if(d.reference&&!h.latestNumbered)h.latestNumbered=d;}
   return reply({invoiceHistory:[...invoiceHistory.values()],records:matched.slice((page-1)*limit,page*limit),total:matched.length,counts,folders,branches:choices('branch'),clients:choices('client'),page,totalPages:Math.max(1,Math.ceil(matched.length/limit))});
  }
  if(request.method==='POST'&&path==='/api/erp/company-archive'){
   if(Number(request.headers.get('Content-Length')||0)>11*1024*1024)return reply({error:'File exceeds 10 MB'},413);
   const form=await request.formData(),file=form.get('file');
   const folder=clean(form.get('folder'),30)||'other',title=clean(form.get('title'),120)||(folder==='invoices'?'Invoice':folder==='other'?'Other Documents':'Company Document'),type=clean(form.get('type'),80)||(folder==='invoices'?'Invoice':'General Document'),branch=clean(form.get('branch'),60),client=clean(form.get('client'),80),person=clean(form.get('person'),100),reference=clean(form.get('reference'),100),month=clean(form.get('month'),7),expiry=clean(form.get('expiry'),10);
   if(!validFolder(folder)||!allowed(role,folder))return reply({error:'Folder access denied'},403);
   if(!(file instanceof File)||!file.size||file.size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type))return reply({error:'PDF/JPG/PNG file up to 10 MB required'},400);
   if((month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))||!dateValid(expiry))return reply({error:'Invalid month or expiry date'},400);
   if(folder==='invoices'&&!client)return reply({error:'Enter the invoice company or client name'},400);
   const bytes=new Uint8Array(await file.arrayBuffer());if(!validMime(bytes,file.type))return reply({error:'File content does not match format'},400);
   const id=crypto.randomUUID(),data={id,folder,title,type,branch,client,person,reference,month,expiry,fileName:clean(file.name,120).replace(/[\r\n]/g,'_'),mimeType:file.type,createdAt:new Date().toISOString(),createdBy:userId};
   const meta=JSON.stringify(data);if(new TextEncoder().encode(meta).length>1800)return reply({error:'Document details are too long'},400);
   await r2.put(prefix+id,bytes,{httpMetadata:{contentType:file.type},customMetadata:{record:meta}});
   return reply({record:{...data,size:bytes.length}},201);
  }
  const match=path.match(/^\/api\/erp\/company-archive\/([a-f0-9-]{36})$/);
  if(request.method==='GET'&&match){
   const obj=await r2.get(prefix+match[1]);const d=obj&&record(obj);
   if(!d)return reply({error:'Document not found'},404);
   const bytes=await obj.arrayBuffer();
   return reply({readUrl:'data:'+d.mimeType+';base64,'+Buffer.from(bytes).toString('base64'),fileName:d.fileName,mimeType:d.mimeType});
  }
  return reply({error:'Method not allowed'},405);
 }catch(e:any){return reply({error:'Company archive request failed: '+(e?.message||'Storage unavailable')},503);}
}

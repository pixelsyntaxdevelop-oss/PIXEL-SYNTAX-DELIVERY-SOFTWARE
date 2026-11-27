import assert from 'node:assert/strict';
import {companyArchive} from '../server/companyArchive';
const objects=new Map<string,any>();
const bucket={
 async put(key:string,bytes:Uint8Array,options:any){objects.set(key,{key,size:bytes.length,customMetadata:options.customMetadata,arrayBuffer:async()=>bytes.buffer});},
 async get(key:string){return objects.get(key)||null;},
 async list({prefix,cursor}:any){const rows=[...objects.values()].filter(o=>o.key.startsWith(prefix)).sort((a,b)=>a.key.localeCompare(b.key));const i=Number(cursor||0);return {objects:rows.slice(i,i+1),truncated:i+1<rows.length,cursor:String(i+1)};}
};
const path='/api/erp/company-archive';
const invoke=(method:string,tenant:string,role:string,suffix='',body?:FormData)=>companyArchive(new Request('https://test.invalid'+path+suffix,{method,body}),bucket,tenant,role,'test-operator',path+suffix.split('?')[0]);
function form(folder:string,title:string,client='',month='',reference='',fake=false){const f=new FormData();for(const [k,v]of Object.entries({folder,title,type:'Test document',client,month,reference,branch:'Abu Dhabi'}))f.append(k,v);f.append('file',new File([fake?'not a PDF':'%PDF-1.4\n%%EOF'],'qa.pdf',{type:'application/pdf'}));return f;}
async function main(){
 const a=await invoke('POST','test_tenant','COMPANY_ADMIN','',form('licenses','Abu Dhabi license'));
 assert.equal(a.status,201);const id=(await a.json()).record.id;
 assert.equal((await invoke('POST','test_tenant','COMPANY_ADMIN','',form('licenses','Dubai license'))).status,201);
 assert.equal((await invoke('POST','test_tenant','ACCOUNTANT','',form('invoices','Noon October','Noon Minutes','2026-10','N-01'))).status,201);
 assert.equal((await invoke('POST','test_tenant','COMPANY_ADMIN','',form('invoices','Noon November','Noon Minutes','2026-11','N-02'))).status,201);
 const privateDoc=await invoke('POST','test_tenant','COMPANY_ADMIN','',form('management','Owner ID'));
 assert.equal(privateDoc.status,201);const privateId=(await privateDoc.json()).record.id;
 assert.equal((await invoke('POST','test_tenant','ACCOUNTANT','',form('management','Denied'))).status,403);
 assert.equal((await invoke('POST','test_tenant','COMPANY_ADMIN','',form('invoices','Missing client'))).status,400);
 const unnamed=form('other','');unnamed.delete('type');const other=await invoke('POST','test_tenant','COMPANY_ADMIN','',unnamed);assert.equal(other.status,201);assert.equal((await other.json()).record.title,'Other Documents');
 const optional=await invoke('POST','test_tenant','COMPANY_ADMIN','',form('invoices','','noon minutes'));assert.equal(optional.status,201);
 const newest=await (await invoke('GET','test_tenant','COMPANY_ADMIN','?folder=invoices&client=Noon%20Minutes')).json();assert.equal(newest.total,3);assert.equal(newest.invoiceHistory.length,1);assert.ok(newest.invoiceHistory[0].latestNumbered.reference);
 assert.equal((await invoke('DELETE','test_tenant','COMPANY_ADMIN','/'+id)).status,405);
 assert.equal((await invoke('POST','test_tenant','COMPANY_ADMIN','',form('licenses','Wrong file','','','',true))).status,400);
 const filtered=await (await invoke('GET','test_tenant','COMPANY_ADMIN','?folder=invoices&month=2026-10&client=Noon%20Minutes')).json();assert.equal(filtered.total,1);assert.equal(filtered.records[0].reference,'N-01');
 const all=await (await invoke('GET','test_tenant','COMPANY_ADMIN')).json();assert.equal(all.total,7);assert.equal(all.counts.licenses,2);
 const finance=await (await invoke('GET','test_tenant','ACCOUNTANT')).json();assert.equal(finance.total,3);
 assert.equal((await invoke('GET','test_tenant','ACCOUNTANT','/'+privateId)).status,404);
 assert.equal((await invoke('GET','other_tenant','COMPANY_ADMIN','/'+id)).status,404);
 const file=await (await invoke('GET','test_tenant','COMPANY_ADMIN','/'+id)).json();assert.ok(file.readUrl.startsWith('data:application/pdf;base64,'));
 console.log('PASS: multi-file retention, pagination, monthly filtering, validation, role restrictions and tenant isolation.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

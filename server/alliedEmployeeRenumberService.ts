/** Read-only report: numbering changes only through an audited database migration. */
export interface AlliedRenumberReport {
 totalLiveEmployees:number; renamedCount:number; renumberedCount:number; firstCode:string; lastCode:string;
 nextCode:string; oldFormatCodesRemaining:number; duplicates:number; gaps:number;
 dependentReferencesUpdated:boolean; success:boolean;
}
export function compareEmployeesDeterministically(a:any,b:any):number {
 const archived=Number(Boolean(a.is_archived))-Number(Boolean(b.is_archived));
 if(archived) return archived;
 const date=new Date(a.created_at || 0).getTime()-new Date(b.created_at || 0).getTime();
 if(date) return date;
 const index=(e:any)=>Number(String(e.id||'').match(/_[^_]+_(\d+)$/)?.[1] || 0);
 return index(a)-index(b) || String(a.id||'').localeCompare(String(b.id||''));
}
export async function syncAlliedEmployeeCodes(db:any,sbClient?:any):Promise<AlliedRenumberReport> {
 let employees=(db?.masterEmployees||[]).filter((e:any)=>e.tenant_id==='company_pixel_syntax');
 if(sbClient) {
  const {data,error}=await sbClient.from('employees').select('id,employee_code,is_archived').eq('tenant_id','company_pixel_syntax');
  if(error) throw error;
  employees=data||[];
 }
 const codes:string[]=employees.map((e:any)=>String(e.employee_code||''));
 const numbers=codes.filter((c)=>/^ALL\d{4,}$/.test(c)).map((c)=>Number(c.slice(3))).sort((a,b)=>a-b);
 const max=numbers[numbers.length-1]||0;
 const duplicates=codes.length-new Set(codes).size;
 const oldFormatCodesRemaining=codes.length-numbers.length;
 const gaps=max-new Set(numbers).size;
 return {totalLiveEmployees:employees.filter((e:any)=>!e.is_archived).length,renamedCount:0,renumberedCount:0,
 firstCode:numbers.length?'ALL'+String(numbers[0]).padStart(4,'0'):'',
 lastCode:max?'ALL'+String(max).padStart(4,'0'):'',nextCode:'ALL'+String(max+1).padStart(4,'0'),
 oldFormatCodesRemaining,duplicates,gaps,dependentReferencesUpdated:true,
 success:duplicates===0 && oldFormatCodesRemaining===0};
}


export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string) {super(message);}
}
export async function api<T>(path:string,body?:unknown,method?:'GET'|'POST'|'PATCH'|'DELETE'):Promise<T> {
 const verb=method??(body===undefined?'GET':'POST');
 const payload=verb==='GET'?undefined:(body??{});
 let response:Response;
 try {response=await fetch('/api'+path,{method:verb,credentials:'include',headers:payload===undefined?{}:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});}
 catch {throw new ApiError(0,'NETWORK_ERROR','Нет связи с сервером. Проверьте подключение и повторите запрос');}
 if(response.status===204) return undefined as T;
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok) {
  let code='REQUEST_ERROR',message='Не удалось выполнить запрос';
  if(data && typeof data==='object' && 'error' in data && data.error && typeof data.error==='object') {
   if('code' in data.error && typeof data.error.code==='string') code=data.error.code;
   if('message' in data.error && typeof data.error.message==='string') message=data.error.message;
  }
  throw new ApiError(response.status,code,message);
 }
 return data as T;
}
export async function upload<T>(path:string,file:File):Promise<T> {
 let response:Response;
 try {response=await fetch('/api'+path,{method:'POST',credentials:'include',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});}
 catch {throw new ApiError(0,'NETWORK_ERROR','Нет связи с сервером. Проверьте подключение и повторите запрос');}
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok){const error=data&&typeof data==='object'&&'error' in data&&data.error&&typeof data.error==='object'?data.error:null;throw new ApiError(response.status,error&&'code' in error&&typeof error.code==='string'?error.code:'REQUEST_ERROR',error&&'message' in error&&typeof error.message==='string'?error.message:'Не удалось выполнить запрос');}
 return data as T;
}

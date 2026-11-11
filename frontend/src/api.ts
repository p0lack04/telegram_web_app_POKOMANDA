export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string) {super(message);}
}
export async function api<T>(path:string,body?:unknown):Promise<T> {
 let response:Response;
 try {response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'include',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
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

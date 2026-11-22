import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Bank from './Bank';

describe('bank catalog',()=>{
 it.each([true,false])('uses server edit capability %s and marks private materials',edit=>{
  const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
  client.setQueryData(['bank','',1],{items:[{id:'b',title:'Synthetic private',description:null,category:'EDUCATIONAL',tags:['tag'],isPublic:false,capabilities:{edit}}],total:21,page:1,pageSize:20});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><Bank/></QueryClientProvider>);
  expect(html).toContain('Закрытый материал');expect(html.includes('Редактировать мероприятие банка')).toBe(edit);
  expect(html).toContain('Страницы банка');expect(html).toContain('Вложения');
 });
});

import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiError} from './api';
import {PreviewTable,mutationError,type ImportPreview} from './ChildrenImport';

describe('Предпросмотр детей',()=>{
 it('показывает все категории, исходные данные, before/after и различимые совпадения',()=>{
  const job:ImportPreview={jobId:'job',revision:1,counts:{},rows:['NEW','UPDATE','UNCHANGED','UNRESOLVED','ERROR','FORBIDDEN'].map((category,i):ImportPreview['rows'][number]=>({rowNumber:i+2,category,errors:category==='ERROR'?['INVALID_BIRTH_DATE']:[],warnings:[],data:{lastName:`Ребёнок ${i}`,firstName:'Тест',middleName:null,birthDate:'2015-01-01',squadName:'Северный',room:'12'},changes:category==='UPDATE'?{room:{before:'10',after:'12'}}:{},choice:null,candidates:category==='UNRESOLVED'?['id-one','id-two'].map(id=>({id,squadId:'squad',firstName:'Тест',lastName:'Совпадение',middleName:'Тестович',birthDate:'2015-01-01',building:'А',room:id==='id-one'?'1':'2'})):[]}))};
  const html=renderToStaticMarkup(<PreviewTable job={job} pending={false} map={()=>{}}/>);
  for(const label of ['Новая запись','Изменение','Без изменений','Требуется сопоставление','Ошибка','Нет права','10 → 12','id-one','id-two','Тестович','2015-01-01','Северный','INVALID_BIRTH_DATE'])expect(html).toContain(label);
  expect(html.match(/<tr>/g)).toHaveLength(7);
  expect(html).toContain('Пропустить строку');
 });
 it.each([[400,'Проверьте заполнение'],[403,'Нет права'],[404,'недоступны'],[409,'Обновите'],[410,'Загрузите файл заново'],[0,'Нет связи']])('различает ошибку %i', (status,message)=>{
  expect(mutationError(new ApiError(Number(status),'ERROR','Нет связи'))).toContain(message);
 });
});

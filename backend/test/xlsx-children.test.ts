import {describe,it,expect} from 'vitest';
import {parseChildrenXlsx} from '../src/domain/xlsx-children.js';
import {testWorkbook} from './xlsx-fixture.js';
const headers=['Фамилия','Имя','Дата рождения','Отряд'];
describe('bounded XLSX parser',()=>{
 it('supports exact dates, optional cells and ignored fields',async()=>{
  const rows=await parseChildrenXlsx(testWorkbook([[...headers,'Корпус','Комната','Оплата'],['Тестов','Тест','02.01.2015','A','','12','да'],['Другой','Тест','2015-01-02','A',null,null,null]]));
  expect(rows[0]).toMatchObject({birthDate:'2015-01-02',building:null,room:'12',warnings:['PAYMENT_CHECKIN_IGNORED']});expect(rows[1]!.errors).toEqual([]);
  expect((await parseChildrenXlsx(testWorkbook([headers,['Тестов','Тест','2015-01-02','A']])))[0]).not.toHaveProperty('building');
 });
 it('supports styled Excel date and rejects bare serial and ambiguous dates',async()=>{
  const rows=await parseChildrenXlsx(testWorkbook([headers,['A','B',42006,'A']],{dateCell:'C2'}));expect(rows[0]!.birthDate).toBe('2015-01-02');
  for(const value of ['02.01.15','01/02/2015','2015-02-30',42006])expect((await parseChildrenXlsx(testWorkbook([headers,['A','B',value,'A']])))[0]!.errors).toContain('INVALID_BIRTH_DATE');
 });
 it('rejects noncanonical coordinates before invoking the library',async()=>{
  for(const rowCoordinate of ['1e9','100&#48;000','1002','-1','2.0','2\n'])await expect(parseChildrenXlsx(testWorkbook([headers,['A','B','2015-01-02','A']],{rowCoordinate}))).rejects.toMatchObject({status:400});
 });
 it('rejects invalid headers, damaged and oversized files, formulas',async()=>{
  for(const file of [Buffer.from('not xlsx'),Buffer.alloc(2*1024*1024+1),testWorkbook([['Имя'],['A']]),testWorkbook([headers,['A','B',42006,'A']],{formula:true})])await expect(parseChildrenXlsx(file)).rejects.toMatchObject({status:400});
 });
});

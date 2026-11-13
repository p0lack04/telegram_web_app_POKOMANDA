import {describe,it,expect} from 'vitest';
import {readSheet} from 'read-excel-file/node';
import {checkedXlsxEntries,parseChildrenXlsx} from '../src/domain/xlsx-children.js';
import {testWorkbook} from './xlsx-fixture.js';

const headers=['Фамилия','Имя','Дата рождения','Отряд'];
const valid=()=>testWorkbook([headers,['Safe','Child','2015-01-02','A']]);
const central=(buffer:Buffer)=>{const offset=buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));if(offset<0)throw Error('central directory');return offset;};
const local=(buffer:Buffer)=>{const offset=buffer.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]));if(offset<0)throw Error('local header');return offset;};
async function both(buffer:Buffer){const checked=()=>checkedXlsxEntries(buffer);const parsed=()=>readSheet(buffer,1);return {checked,parsed};}

describe('XLSX ZIP security agreement',()=>{
 it('rejects local/central size and CRC mismatches before sheet parsing',async()=>{
  for(const mutate of [(b:Buffer)=>b.writeUInt32LE(b.readUInt32LE(central(b)+20)+1,central(b)+20),(b:Buffer)=>b.writeUInt32LE(b.readUInt32LE(local(b)+14)^1,local(b)+14)]){
   const file=valid();mutate(file);const result=await both(file);expect(()=>result.checked()).toThrow();
   // The library is intentionally exercised separately: production parsing must
   // never use it before the checked archive has passed our validation.
   await result.parsed();await expect(parseChildrenXlsx(file)).rejects.toMatchObject({status:400});
  }
 });
 it('rejects duplicate or overlapping local ranges and invalid offsets',async()=>{
  const file=valid(),dir=central(file);file.writeUInt32LE(0x7fffffff,dir+42);expect(()=>checkedXlsxEntries(file)).toThrow();
  const damaged=valid(),second=damaged.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]),central(damaged)+1);damaged.writeUInt32LE(damaged.readUInt32LE(central(damaged)+42),second+42);expect(()=>checkedXlsxEntries(damaged)).toThrow();
 });
 it('rejects truncated and malformed ZIP structures without exposing internals',async()=>{
  for(const file of [valid().subarray(0,-1),valid().subarray(0,40),Buffer.from('not zip')]){
   const result=await both(file);expect(()=>result.checked()).toThrow();await expect(result.parsed()).rejects.toThrow();await expect(parseChildrenXlsx(file)).rejects.toMatchObject({status:400});
  }
 });
 it('keeps decompression and aggregate output limits enforced',async()=>{
  const many=Array.from({length:1001},()=>['Last','First',`2015-01-02`,'A']);
  const file=testWorkbook([headers,...many]);expect(file.length).toBeLessThan(2*1024*1024);await expect(parseChildrenXlsx(file)).rejects.toMatchObject({status:400});
 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../public/csv.js';

test('CSV parser handles quoted commas and embedded double quotes',()=>{
  const rows=parseCsv('order_id,merchant_status,provider_status,notes\n"INV, 1",FAILED,PAID,"customer said ""paid"""\n');
  assert.equal(rows[0].order_id,'INV, 1');
  assert.equal(rows[0].notes,'customer said "paid"');
});
test('CSV parser rejects missing columns and unclosed quotes',()=>{
  assert.throws(()=>parseCsv('order_id,merchant_status\nx,PAID'),/provider_status/);
  assert.throws(()=>parseCsv('order_id,merchant_status,provider_status\n"bad,PAID,PAID'),/unterminated/);
});

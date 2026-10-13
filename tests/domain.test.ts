import { describe,it,expect } from 'vitest'
import { totals,cash,normalizePhone,canCollect,dayRange,dateKey,csv,paymentDelta } from '../src/domain/business'
import { invoiceFingerprint } from '../src/domain/invoices'
import type { InvoiceSnapshot } from '../src/domain/invoices'
import { Timestamp } from 'firebase/firestore'
describe('Tagihan dan pembayaran rupiah',()=>{
 it('memisahkan nilai order, DP, pelunasan dan kembalian',()=>{const dp=totals([{price:60000},{price:35000}],5000,30000);expect(dp).toEqual({subtotal:95000,discount:5000,total:90000,paid:30000,balance:60000});expect(totals([{price:90000}],0,90000).balance).toBe(0);expect(cash(60000,'tunai',100000)).toEqual({tendered:100000,change:40000})})
 it('menolak rupiah pecahan, diskon berlebih, pembayaran berlebih dan uang tunai kurang',()=>{expect(()=>totals([{price:1.5}],0)).toThrow();expect(()=>totals([{price:100}],101)).toThrow();expect(()=>totals([{price:100}],0,101)).toThrow();expect(()=>cash(100,'tunai',99)).toThrow();expect(()=>totals([{price:100}],-1)).toThrow()})
 it('refund dan pembatalan pembayaran mengurangi pembayaran bersih',()=>{expect(paymentDelta({kind:'refund',amount:20000})).toBe(-20000);expect(paymentDelta({kind:'void',amount:10000})).toBe(-10000)})
 it('pengambilan sekaligus mensyaratkan lunas dan siap',()=>{expect(canCollect({allReady:true,balance:0,cancelled:false,collected:false})).toBe(true);expect(canCollect({allReady:true,balance:100,cancelled:false,collected:false})).toBe(false);expect(canCollect({allReady:false,balance:0,cancelled:false,collected:false})).toBe(false)})
 it('tanggal dan CSV aman, nomor Indonesia dinormalisasi',()=>{expect(normalizePhone('+62 812-3456-7890')).toBe('6281234567890');expect(normalizePhone('081234567890')).toBe('6281234567890');expect(()=>normalizePhone('123')).toThrow();expect(dayRange('2026-10-11').start.toDate().toISOString()).toBe('2026-10-10T17:00:00.000Z');expect(dateKey(Date.parse('2026-10-10T17:00:00Z'))).toBe('2026-10-11');expect(csv([['=cmd','"a"']])).toContain("'=cmd")})
})
it('perubahan invoice tidak bergantung urutan key Firestore, tetapi mendeteksi tagihan baru',()=>{
 const s:InvoiceSnapshot={store:{name:'Toko',address:'',phone:'',hours:'',terms:''},number:'SK-TEST',date:Timestamp.fromMillis(1000),customerName:'Alya',items:[{description:'Nike',color:'Putih',serviceName:'Clean',price:60000,dueAt:Timestamp.fromMillis(2000)}],subtotal:60000,discount:0,total:60000,paid:30000,balance:30000,cancelled:false,collected:false}
 const reordered={...s,store:{terms:'',hours:'',phone:'',address:'',name:'Toko'},items:[{dueAt:Timestamp.fromMillis(2000),price:60000,serviceName:'Clean',color:'Putih',description:'Nike'}]}
 expect(invoiceFingerprint(reordered)).toBe(invoiceFingerprint(s))
 expect(invoiceFingerprint({...s,paid:60000,balance:0})).not.toBe(invoiceFingerprint(s))
})

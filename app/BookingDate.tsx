'use client';
import {useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {parseBookingDate,formatDateEntry} from '../lib/booking-date';
export default function BookingDate({past=false,onDateChange}:{past?:boolean;onDateChange?:(date:string)=>void}){const [text,setText]=useState('');const input=useRef<HTMLInputElement>(null);const date=parseBookingDate(text),minimum=new Date(Date.now()+28800000).toISOString().slice(0,10);
 function update(raw:string){const value=formatDateEntry(raw);setText(value);const iso=parseBookingDate(value);onDateChange?.(iso);input.current?.setCustomValidity(value&&(!iso||(!past&&iso<minimum)||(past&&iso>minimum))?'请输入有效的用餐日期，格式为年/月/日。':'');}
 return <span className="booking-date-field"><input ref={input} type="text" name="dateDisplay" aria-label="用餐日期" required placeholder="年/月/日" autoComplete="off" inputMode="numeric" value={text} onChange={e=>update(e.target.value)} maxLength={10}/><input type="hidden" name="date" value={date}/><span className="booking-date-picker"><CalendarDays size={21} aria-hidden="true"/><input type="date" aria-label="打开日历选择用餐日期" value={date} min={past?undefined:minimum} max={past?minimum:undefined} onChange={e=>update(e.target.value.replaceAll('-','/'))}/></span></span>;
}

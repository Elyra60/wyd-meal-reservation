'use client';
import {useRef,useState} from 'react';
import {Clock} from 'lucide-react';
export default function BookingTime(){const [value,setValue]=useState('18:30');const input=useRef<HTMLInputElement>(null);const valid=/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 function update(raw:string){const digits=raw.replace(/\D/g,'').slice(0,4),next=digits.length>2?digits.slice(0,2)+':'+digits.slice(2):digits;setValue(next);input.current?.setCustomValidity(/^([01]\d|2[0-3]):[0-5]\d$/.test(next)?'':'请输入有效时间，如 18:30。');}
 return <span className="booking-date-field"><input ref={input} aria-label="用餐时间" type="text" required inputMode="numeric" placeholder="时:分" value={value} onChange={e=>update(e.target.value)} maxLength={5}/><input type="hidden" name="time" value={valid?value:''}/><span className="booking-date-picker"><Clock size={19}/><input type="time" aria-label="打开时间选择器" value={valid?value:''} onClick={e=>{try{e.currentTarget.showPicker?.();}catch{}}} onChange={e=>update(e.target.value)}/></span></span>;
}

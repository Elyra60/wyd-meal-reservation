type Location={lat:number;lng:number};
export function distanceMeters(a:Location,b:Location){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
export function distanceLabel(m:number){return m<1000?Math.round(m)+' 米':(m/1000).toFixed(1)+' 公里';}

/* Beregner i blogindlæg */
(function(){var da=function(n,d){return n.toLocaleString('da-DK',{minimumFractionDigits:d,maximumFractionDigits:d});};
[].forEach.call(document.querySelectorAll('.bregner'),function(b){var mode=b.dataset.mode,res=b.querySelector('.bregner-res'),f={};
[].forEach.call(b.querySelectorAll('input'),function(i){f[i.dataset.f]=i;i.addEventListener('input',function(){kn.forEach(function(x){x.classList.remove('on');});regn();});});
var kn=[].slice.call(b.querySelectorAll('.bregner-pre button'));
var v=function(k){var x=parseFloat(String(f[k].value).replace(',','.'));return isFinite(x)&&x>=0?x:0;};
function regn(){var p=v('p');if(mode==='watt'){var kwh=v('w')*v('t')*v('d')/1000;res.innerHTML='Det bruger <b>'+da(kwh,kwh<10?2:1)+' kWh</b> og koster <b>'+da(kwh*p,2)+' kr.</b>'+(v('d')>1?' Det er '+da(kwh*p/v('d'),2)+' kr. om dagen.':'');}
else{var k=v('k'),g=v('g');res.innerHTML='Det koster <b>'+da(k*p,2)+' kr.</b> pr. gang og <b>'+da(k*g*52*p,0)+' kr.</b> om året ('+da(k*g*52,0)+' kWh).';}}
kn.forEach(function(x){x.addEventListener('click',function(){var a=x.dataset.v.split(';');if(mode==='watt'){f.w.value=a[0];f.t.value=a[1];f.d.value=a[2];}else{f.k.value=a[0];f.g.value=a[1];}kn.forEach(function(y){y.classList.toggle('on',y===x);});regn();});});
if(kn[0])kn[0].classList.add('on');regn();});})();

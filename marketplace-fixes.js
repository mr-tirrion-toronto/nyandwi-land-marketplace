/* Nyandwi Land Marketplace: public entry, reliable sign-out and GPS address helper */
(function(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const field=(form,name)=>form?.elements?.namedItem(name);
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  // Explicit logout: clear only this browser's session and immediately return to public browsing.
  if(acts){
    acts.logout=async function(_data,event){
      const button=event?.target?.closest?.('[data-act="logout"]')||document.querySelector('[data-act="logout"]');
      if(button){button.disabled=true;button.textContent='Logging out…'}
      try{
        const {error}=await sb.auth.signOut({scope:'local'});
        if(error)throw error;
        me=null;
        favs?.clear?.();
        if(byId('m')?.classList.contains('open'))closeM();
        if(byId('acct'))byId('acct').innerHTML='<button class="btn sm" data-act="auth">Login / Register</button>';
        if(byId('bAdmin'))byId('bAdmin').hidden=true;
        if(byId('bDash'))byId('bDash').hidden=true;
        toast('You have been logged out. You are now browsing as a guest.');
        await load();
      }catch(error){
        toast('Logout failed. Please try again: '+String(error?.message||'session could not be cleared').slice(0,100));
        if(button){button.disabled=false;button.textContent='Logout'}
      }
    };

    // Seller and Agent both see listings they own or are assigned to manage.
    acts.sell=async function(){
      if(!me){authM('login');return}
      if(me.role==='buyer'){
        modal('<h2>Seller / Agent access</h2><p>Your account is currently a Buyer account. Request Seller or Agent approval from your dashboard before publishing land.</p>');
        return;
      }
      let query=sb.from('lm_listings').select('*').order('created_at',{ascending:false}).limit(200);
      if(me.role==='agent'){
        const [owned,assigned]=await Promise.all([
          sb.from('lm_listings').select('*').eq('owner_id',me.id).order('created_at',{ascending:false}).limit(200),
          sb.from('lm_listings').select('*').eq('agent_id',me.id).order('created_at',{ascending:false}).limit(200)
        ]);
        if(owned.error||assigned.error){toast('Could not load your listings. Please refresh and try again.');return}
        const unique=new Map([...(owned.data||[]),...(assigned.data||[])].map(item=>[item.id,item]));
        S.mine=[...unique.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      }else{
        const {data,error}=await query.eq('owner_id',me.id);
        if(error){toast('Could not load your listings: '+error.message);return}
        S.mine=data||[];
      }
      const rows=S.mine||[];
      modal('<div class="panelhead"><div><h2>My listings</h2><p class="small">'+(me.role==='agent'?'Listings you own and listings assigned to you.':'Manage the land you have submitted.')+'</p></div><span class="bd ok st">'+(me.role==='agent'?'Agent':'Seller')+'</span></div><button class="btn" data-act="newl">+ Add new listing</button><div style="margin-top:14px">'+(rows.map(l=>'<div class="it"><b>'+esc(l.title)+'</b> '+badge(l,'st')+'<div class="small">'+tzs(l.price_tzs)+' · '+esc(locText(l)||l.region)+' · Status: '+esc(l.status)+(l.agent_id===me.id&&l.owner_id!==me.id?' · Assigned to you':'')+'</div><div class="acts"><button class="btn sm alt" data-act="edit" data-id="'+l.id+'">Edit</button>'+(l.status!=='sold'&&(l.owner_id===me.id||me.role==='agent')?'<button class="btn sm alt" data-act="sold" data-id="'+l.id+'">Mark sold</button>':'')+(l.owner_id===me.id?'<button class="btn sm red" data-act="dell" data-id="'+l.id+'">Delete</button>':'')+'</div></div>').join('')||'<p class="small">No listings are linked to your account yet.</p>')+'</div>',true);
    };

    // Ask for location only after the user presses the button. Coordinates are sent directly
    // from this browser to BigDataCloud's free client-side reverse-geocoding endpoint.
    acts.geo=async function(_data,event){
      const button=event?.target?.closest?.('[data-act="geo"]')||document.querySelector('#mb [data-act="geo"]');
      const form=document.querySelector('#mb form[data-form="sell"]');
      if(!form||!S?.put||!pmap){toast('Open the land form first, then try again.');return}
      if(!navigator.geolocation){toast('This browser does not support GPS location. You can still enter the address manually.');return}
      if(button){button.disabled=true;button.textContent='Detecting location…'}
      const setStatus=message=>{const p=byId('pc');if(p)p.textContent=message};
      try{
        const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{
          enableHighAccuracy:true,timeout:20000,maximumAge:0
        }));
        const lat=position.coords.latitude,lng=position.coords.longitude;
        if(lat> -0.8||lat< -12.5||lng<28.5||lng>42.5){
          throw new Error('The detected location appears to be outside Tanzania. Check your phone location settings or enter the land location manually.');
        }
        S.put(lat,lng);
        pmap.setView([lat,lng],15);
        setStatus('GPS pin set. Looking up the administrative area…');
        const params=new URLSearchParams({latitude:String(lat),longitude:String(lng),localityLanguage:'en'});
        const response=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+params.toString(),{
          method:'GET',headers:{Accept:'application/json'},mode:'cors',cache:'no-store'
        });
        if(!response.ok)throw new Error('Address lookup service returned '+response.status+'. Your map pin is saved; please enter the area details manually.');
        const place=await response.json();
        if(String(place.countryCode||'').toUpperCase()!=='TZ'){
          throw new Error('The detected address is not in Tanzania. Your pin is set, but please enter the land address manually.');
        }
        let photon={};
        try{
          const photonParams=new URLSearchParams({lat:String(lat),lon:String(lng),lang:'en'});
          const photonResponse=await fetch('https://photon.komoot.io/reverse?'+photonParams.toString(),{headers:{Accept:'application/json'},mode:'cors'});
          if(photonResponse.ok){
            const photonBody=await photonResponse.json();
            photon=photonBody.features?.[0]?.properties||{};
            if(String(photon.countrycode||'').toUpperCase()&&String(photon.countrycode).toUpperCase()!=='TZ')photon={};
          }
        }catch(_){/* BigDataCloud still provides the regional fallback. */}
        const admin=Array.isArray(place.localityInfo?.administrative)?place.localityInfo.administrative:[];
        const atLevel=level=>admin.find(item=>Number(item.adminLevel)===level)?.name||'';
        const regionRaw=place.principalSubdivision||atLevel(4);
        const regionNorm=normalize(regionRaw).replace(/\bregion\b/g,'').trim();
        const aliases={
          'dar es salaam':'dar es salaam',
          'dar es salaam region':'dar es salaam',
          'mjini magharibi':'zanzibar urban west',
          'kaskazini unguja':'unguja north',
          'kusini unguja':'unguja south',
          'kaskazini pemba':'pemba north',
          'kusini pemba':'pemba south'
        };
        const wanted=aliases[regionNorm]||regionNorm;
        const regionOption=[...field(form,'region').options].find(option=>{
          const n=normalize(option.value).replace(/\bregion\b/g,'').trim();
          return n===wanted||normalize(option.textContent).replace(/\bregion\b/g,'').trim()===wanted;
        });
        if(regionOption)field(form,'region').value=regionOption.value;
        const values={
          district:atLevel(5)||photon.county||'',
          division:atLevel(6),
          ward:atLevel(7)||photon.district||photon.suburb||'',
          village:atLevel(9)||photon.locality||place.locality||((photon.osm_value==='village')?photon.name:''),
          street:photon.street||'',
          hamlet:atLevel(10)||((photon.osm_value==='hamlet')?photon.name:'')
        };
        // A populated place/city can be a useful council hint, but it is not treated as an
        // official council if it duplicates the region or district.
        const city=photon.city||place.city||'';
        if(city&&normalize(city)!==normalize(values.district)&&normalize(city)!==regionNorm)values.council=city;
        const used=[values.district,values.division,values.ward,values.village,values.hamlet].filter(Boolean).map(normalize);
        const locality=place.locality||'';
        if(locality&&!used.includes(normalize(locality))&&!values.village)values.village=locality;
        Object.entries(values).forEach(([name,value])=>{
          const input=field(form,name);
          if(input&&value)input.value=String(value).slice(0,name==='street'||name==='hamlet'?100:80);
        });
        const filled=Object.entries(values).filter(([,value])=>!!value).length+(regionOption?1:0);
        const accuracy=Number(position.coords.accuracy);
        setStatus('GPS pin set ('+lat.toFixed(5)+', '+lng.toFixed(5)+'). '+filled+' address fields suggested. Please verify every field; street and kitongoji may need manual correction.');
        toast(filled?'Location found. Review the suggested address before submitting.':'GPS pin saved, but detailed address data was unavailable. Fill the fields manually.');
        if(accuracy>100)setStatus('GPS pin set (estimated accuracy '+Math.round(accuracy)+' m). Address suggestions added where available; please verify them carefully.');
      }catch(error){
        const code=error?.code;
        const message=code===1?'Location permission was denied. Allow location access in your browser settings and try again.':
          code===2?'Your device could not determine its location. Turn on GPS and try again.':
          code===3?'Location request timed out. Move outdoors or try again.':
          String(error?.message||'Could not detect location.');
        setStatus(message);
        toast(message);
      }finally{
        if(button){button.disabled=false;button.textContent='Use GPS & Auto-fill Address'}
      }
    };
  }

  // Keep the address helper visible if the listing form is opened after this script loads.
  const observer=new MutationObserver(()=>{
    const button=document.querySelector('#mb form[data-form="sell"] [data-act="geo"]');
    if(button&&button.textContent.trim()!=='Use GPS & Auto-fill Address')button.textContent='Use GPS & Auto-fill Address';
    const form=document.querySelector('#mb form[data-form="sell"]');
    if(form&&!form.querySelector('[data-location-note]')){
      const note=document.createElement('p');
      note.dataset.locationNote='1';
      note.className='small';
      note.style.margin='6px 0 10px';
      note.textContent='Use this only when you are physically at the land. GPS is requested only after you press the button. Suggestions use BigDataCloud and OpenStreetMap/Photon and may be approximate; if you are elsewhere, enter the plot address manually. Confirm every field before publishing.';
      const pin=byId('pmap');
      if(pin)pin.insertAdjacentElement('afterend',note);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});

  // Portfolio link uses this explicit public-entry flag to avoid carrying an administrator
  // session into a public visit to the marketplace.
})();

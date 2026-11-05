/* Nyandwi Land Marketplace — password quality feedback */
(function(){
  'use strict';
  function assessPassword(value){
    const p=String(value||''), lower=p.toLowerCase();
    if(!p)return {score:0,label:'Not entered',level:'empty',advice:'Use 12+ characters with a mix of character types.'};
    let score=0;
    if(p.length>=8)score++;
    if(p.length>=12)score++;
    if(p.length>=16)score++;
    if(/[a-z]/.test(p))score++;
    if(/[A-Z]/.test(p))score++;
    if(/\d/.test(p))score++;
    if(/[^A-Za-z0-9]/.test(p))score++;
    const common=['password','password123','12345678','qwerty','letmein','admin123','welcome','iloveyou'];
    const predictable=common.some(x=>lower.includes(x))||/^(.)\1{5,}$/.test(p)||/^(123|abc|qwe)/i.test(p);
    if(predictable)score=Math.min(score,2);
    if(p.length<8)score=Math.min(score,1);
    score=Math.min(5,Math.round(score/1.4));
    if(predictable||p.length<8||score<=2)return {score:Math.max(1,score),label:'Weak password',level:'weak',advice:'Too easy to guess. Use at least 12 characters and avoid common words or sequences.'};
    if(score<=3)return {score:3,label:'Fair password',level:'fair',advice:'Add more length and a symbol or number to make it harder to guess.'};
    return {score:5,label:'Strong password',level:'strong',advice:'Good. Keep it unique and do not reuse it on other websites.'};
  }
  function attach(){
    const input=document.getElementById('regPw');
    const hint=document.getElementById('regPwHint');
    if(!input||!hint||input.dataset.qualityReady==='1')return;
    input.dataset.qualityReady='1';
    hint.innerHTML='<div class="pw-quality" id="pwQuality" data-level="empty"><div class="pw-meter" data-score="0" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><strong>Not entered</strong></div><div class="pw-advice" id="pwAdvice">Use 12+ characters with a mix of character types.</div>';
    const update=()=>{
      const result=assessPassword(input.value),wrap=document.getElementById('pwQuality'),meter=wrap?.querySelector('.pw-meter'),label=wrap?.querySelector('strong'),advice=document.getElementById('pwAdvice');
      if(!wrap||!meter||!label||!advice)return;
      wrap.dataset.level=result.level;meter.dataset.score=String(result.score);label.textContent=result.label;advice.textContent=result.advice;
      input.setCustomValidity(result.level==='weak'?'Choose a stronger password before creating your account.':'');
      const confirm=document.getElementById('regPwConfirm');
      if(confirm&&confirm.value)confirm.dispatchEvent(new Event('input',{bubbles:true}));
    };
    input.addEventListener('input',update);update();
  }
  document.addEventListener('input',function(event){
    if(event.target?.id==='regPwConfirm'){
      const confirm=event.target,original=document.getElementById('regPw'),msg=document.getElementById('regMsg');
      if(!original||!msg)return;
      if(!confirm.value){confirm.setCustomValidity('');if(msg.textContent.toLowerCase().includes('passwords do not match'))msg.textContent='';return}
      const match=confirm.value===original.value;
      confirm.setCustomValidity(match?'':'Passwords do not match.');
      if(!match)msg.textContent='Passwords do not match.';
      else if(msg.textContent==='Passwords do not match.')msg.textContent='';
    }
  });
  const observer=new MutationObserver(attach);
  observer.observe(document.getElementById('mb')||document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();

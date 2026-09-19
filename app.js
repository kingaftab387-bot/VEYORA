const SUPABASE_URL='https://veqmnbradfxqkykwztmg.supabase.co';
const SUPABASE_KEY='sb_publishable_F5hYSHT8ECBX6V7E_M3uVQ_80iXDOZh';
const VEYORA_SITE_URL='https://veyora-chat.pages.dev/';
// Production OAuth must never redirect to a local development address.
function getOAuthRedirectUrl(){
  const origin=window.location.origin;
  if(origin && origin!=='null' && !/localhost|127\.0\.0\.1/i.test(origin)) return origin + (window.location.pathname || '/');
  return VEYORA_SITE_URL;
}
const PROFILE_TABLE='profiles';
let sb=null,session=null,selectedGender='',chatAccess='free',selectedPlan='',currentScreen='authScreen';
const $=s=>document.querySelector(s);
const screens=['authScreen','profileScreen','matchScreen'];
function show(id){screens.forEach(x=>$('#'+x).classList.add('hidden'));$('#'+id).classList.remove('hidden');currentScreen=id}
function msg(t){$('#authMsg').textContent=t}
function profileMsg(t){$('#profileMsg').textContent=t}

// Keep each OAuth identity's local data separate (Google and Facebook never share cached profiles).
function accountStorageKey(key){
  const uid=session?.user?.id;
  const provider=session?.user?.app_metadata?.provider || 'guest';
  return uid ? `veyora:${uid}:${key}` : `veyora:${provider}:${key}`;
}
function accountGet(key,fallback=null){try{const v=localStorage.getItem(accountStorageKey(key)); return v===null?fallback:v}catch(e){return fallback}}
function accountSet(key,value){try{localStorage.setItem(accountStorageKey(key),value)}catch(e){}}
function accountRemove(key){try{localStorage.removeItem(accountStorageKey(key))}catch(e){}}

function updatePaidPlanUI(){
 const select=$('#paidPlanSelect'), msgEl=$('#planMsg'), payBtn=$('#payNowBtn');
 if(!select || !msgEl || !payBtn) return;
 const plan=String(select.value||selectedPlan||'');
 selectedPlan=plan;
 if(!plan){
   msgEl.textContent='Choose a paid plan.';
   payBtn.classList.add('hidden');
   return;
 }
 const info=getPlanInfo();
 const isActivePurchasedPlan=info.active && info.plan===plan;
 msgEl.textContent=isActivePurchasedPlan ? '' : 'Selected: '+plan;
 payBtn.classList.toggle('hidden',isActivePurchasedPlan);
}

function setAccess(type){
 chatAccess=type;
 accountSet('veyoraAccess',type);
 const free=type==='free';
 const chatType=$('#chatTypeSelect');
 if(chatType) chatType.value=free?'free':'paid';
 $('#paidPlans').classList.toggle('hidden',free);
 if(free){
   selectedPlan='';
   accountRemove('veyoraPlan');
   if($('#paidPlanSelect')) $('#paidPlanSelect').value='';
   $('#planMsg').textContent='Free Chat selected.';
   $('#payNowBtn').classList.add('hidden');
 }else{
   selectedPlan=accountGet('veyoraPlan','')||accountGet('veyoraPaidPlan','')||'';
   if($('#paidPlanSelect')) $('#paidPlanSelect').value=selectedPlan;
   updatePaidPlanUI();
 }
}

function selectedPlanAmount(){
 const m=String(selectedPlan||'').match(/₹\s*(\d+)/);
 return m?Number(m[1]):0;
}

function planDurationDays(plan){
 const text=String(plan||'');
 if(text.includes('1 Day')) return 1;
 if(text.includes('1 Week')) return 7;
 if(text.includes('1 Month')) return 30;
 return 0;
}
function getPlanInfo(){
 const plan=accountGet('veyoraPaidPlan','')||accountGet('veyoraPlan','');
 const paidAtRaw=accountGet('veyoraPaidAt','');
 const duration=planDurationDays(plan);
 if(!plan||!paidAtRaw||!duration) return {plan:'Free Chat',active:false,duration:0};
 const paidAt=new Date(paidAtRaw);
 if(Number.isNaN(paidAt.getTime())) return {plan,active:false,duration,paidAt:null};
 const expiry=new Date(paidAt.getTime()+duration*86400000);
 const now=new Date();
 const active=now<expiry;
 const elapsed=Math.max(0,Math.min(duration,Math.floor((now-paidAt)/86400000)));
 const remaining=Math.max(0,Math.ceil((expiry-now)/86400000));
 return {plan,active,duration,paidAt,expiry,elapsed,remaining};
}
function formatPlanDate(d){
 if(!d||Number.isNaN(new Date(d).getTime())) return '—';
 return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));
}
function refreshAccountPlanDetails(){
 const info=getPlanInfo();
 const planEl=$('#accountPlan'), statusEl=$('#accountPlanStatus'), purchaseEl=$('#accountPurchaseDate'), expiryEl=$('#accountExpiryDate'), usedEl=$('#accountDaysUsed'), remainingEl=$('#accountDaysRemaining');
 if(planEl) planEl.textContent=info.plan||'Free Chat';
 if(statusEl) statusEl.textContent=info.active?'Active':'Not active';
 if(purchaseEl) purchaseEl.textContent=info.paidAt?formatPlanDate(info.paidAt):'—';
 if(expiryEl) expiryEl.textContent=info.expiry?formatPlanDate(info.expiry):'—';
 if(usedEl) usedEl.textContent=(info.elapsed||0)+' '+((info.elapsed||0)===1?'day':'days');
 if(remainingEl) remainingEl.textContent=(info.remaining||0)+' '+((info.remaining||0)===1?'day':'days');
}
function compressProfileImage(file){
 return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(new Error('Could not read image.'));
   reader.onload=()=>{
     const img=new Image();
     img.onerror=()=>reject(new Error('Could not open image.'));
     img.onload=()=>{
       const max=480, scale=Math.min(1,max/Math.max(img.width,img.height));
       const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
       const c=document.createElement('canvas'); c.width=w;c.height=h;
       const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
       resolve(c.toDataURL('image/jpeg',0.72));
     };
     img.src=reader.result;
   };
   reader.readAsDataURL(file);
 });
}

function openPaymentModal(){
 if(chatAccess!=='paid'){setAccess('paid');}
 if(!selectedPlan){alert('Please choose a paid plan first.');return;}
 $('#paymentPlanText').textContent=selectedPlan;
 if($('#paymentStatus'))$('#paymentStatus').textContent='Your selected VEYORA plan will be opened in Razorpay Checkout.';
 $('#paymentModal').classList.remove('hidden');
 $('#paymentModal').setAttribute('aria-hidden','false');
}
function closePaymentModal(){
 $('#paymentModal').classList.add('hidden');
 $('#paymentModal').setAttribute('aria-hidden','true');
}

async function startRazorpayPayment(){
 if(chatAccess!=='paid'){setAccess('paid');}
 if(!selectedPlan){alert('Please choose a paid plan first.');return;}
 if(!window.Razorpay){alert('Razorpay Checkout could not load. Please refresh the page and try again.');return;}
 const status=$('#paymentStatus');
 if(status)status.textContent='Creating secure payment order…';
 try{
   const orderResponse=await fetch('/api/create-order',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({plan:selectedPlan})
   });
   const order=await orderResponse.json().catch(()=>({}));
   if(!orderResponse.ok || !order.ok) throw new Error(order.error||'Could not create Razorpay order.');

   const configResponse=await fetch('/api/config',{cache:'no-store'});
   const config=await configResponse.json().catch(()=>({}));
   if(!configResponse.ok || !config.ok || !config.key_id) throw new Error(config.error||'Razorpay Key ID is not configured.');

   const options={
     key:config.key_id,
     amount:order.amount,
     currency:order.currency||'INR',
     name:'VEYORA',
     description:'Paid Match · '+order.plan,
     order_id:order.order_id,
     theme:{color:'#111111'},
     handler:async function(response){
       if(status)status.textContent='Verifying payment…';
       try{
         const verifyResponse=await fetch('/api/verify-payment',{
           method:'POST',
           headers:{'Content-Type':'application/json'},
           body:JSON.stringify({...response,plan:selectedPlan})
         });
         const verified=await verifyResponse.json().catch(()=>({}));
         if(!verifyResponse.ok || !verified.ok || !verified.verified) throw new Error(verified.error||'Payment verification failed.');
         accountSet('veyoraPlan',selectedPlan);
         accountSet('veyoraPaidPlan',selectedPlan);
         accountSet('veyoraPaidPaymentId',verified.payment_id);
         accountSet('veyoraPaidPlan',selectedPlan);
         accountSet('veyoraPaidAt',new Date().toISOString());
         chatAccess='paid';
         setAccess('paid');
         refreshAccountPlanDetails();
         closePaymentModal();
         alert('Payment successful. Paid Match is now active. Tap “Start Video Chat” to continue.');
       }catch(err){
         if(status)status.textContent='Payment was received but verification could not be completed. Please contact VEYORA support before paying again.';
         alert(err?.message||'Payment verification failed.');
       }
     },
     modal:{ondismiss:function(){if(status)status.textContent='Payment cancelled. You can try again.';}},
     prefill:{name:accountGet('veyoraProfile')?(()=>{try{return JSON.parse(accountGet('veyoraProfile')).name||''}catch(e){return ''}})():''},
     notes:{product:'VEYORA Paid Match',plan:selectedPlan}
   };
   const rzp=new Razorpay(options);
   rzp.on('payment.failed',function(response){
     const desc=response?.error?.description||'Payment failed. You can try again.';
     if(status)status.textContent=desc;
     alert(desc);
   });
   if(status)status.textContent='Opening Razorpay Checkout…';
   rzp.open();
 }catch(err){
   console.error('Razorpay payment error',err);
   if(status)status.textContent=err?.message||'Payment could not be started.';
   alert(err?.message||'Payment could not be started.');
 }
}
/* VEYORA language system: English by default, user-selectable, country-aware suggestions. */
const VEYORA_LANGUAGES = [
 ['English','English'],['Hindi','हिन्दी'],['Bengali','বাংলা'],['Telugu','తెలుగు'],['Marathi','मराठी'],['Tamil','தமிழ்'],['Gujarati','ગુજરાતી'],['Kannada','ಕನ್ನಡ'],['Malayalam','മലയാളം'],['Punjabi','ਪੰਜਾਬੀ'],['Urdu','اردو'],['Arabic','العربية'],['Spanish','Español'],['French','Français'],['German','Deutsch'],['Portuguese','Português'],['Russian','Русский'],['Japanese','日本語'],['Korean','한국어'],['Chinese','中文'],['Indonesian','Bahasa Indonesia'],['Turkish','Türkçe'],['Italian','Italiano'],['Dutch','Nederlands'],['Hebrew','עברית'],['Ukrainian','Українська'],['Polish','Polski'],['Czech','Čeština'],['Slovak','Slovenčina'],['Slovenian','Slovenščina'],['Croatian','Hrvatski'],['Serbian','Српски'],['Macedonian','Македонски'],['Bulgarian','Български'],['Romanian','Română'],['Hungarian','Magyar'],['Greek','Ελληνικά'],['Malay','Bahasa Melayu'],['Tagalog','Tagalog'],['Thai','ไทย']
];
const VEYORA_COUNTRY_LANGS = {
 IN:['Hindi','English','Bengali','Telugu','Marathi','Tamil','Gujarati','Kannada','Malayalam','Punjabi','Urdu'],
 US:['English','Spanish'],GB:['English'],CA:['English','French'],FR:['French','English'],DE:['German','English'],ES:['Spanish','English'],PT:['Portuguese','English'],BR:['Portuguese','English'],MX:['Spanish','English'],AR:['Spanish','English'],CL:['Spanish','English'],CO:['Spanish','English'],VE:['Spanish','English'],IT:['Italian','English'],AT:['German','English'],CH:['German','French','English'],BE:['French','Dutch','English'],NL:['Dutch','English'],LU:['French','German','English'],RU:['Russian','English'],UA:['Ukrainian','Russian','English'],BY:['Russian','English'],PL:['Polish','English'],CZ:['Czech','English'],SK:['Slovak','English'],SI:['Slovenian','English'],HR:['Croatian','English'],RS:['Serbian','English'],BA:['Bosnian','English'],ME:['Montenegrin','English'],MK:['Macedonian','English'],BG:['Bulgarian','English'],RO:['Romanian','English'],HU:['Hungarian','English'],GR:['Greek','English'],TR:['Turkish','English'],IL:['Hebrew','Arabic','English'],AE:['Arabic','English','Hindi','Urdu'],SA:['Arabic','English'],QA:['Arabic','English'],KW:['Arabic','English'],JP:['Japanese','English'],KR:['Korean','English'],CN:['Chinese','English'],TW:['Chinese','English'],TH:['Thai','English'],ID:['Indonesian','English'],MY:['Malay','English'],PH:['English','Tagalog'],SG:['English','Chinese','Malay'],ZA:['English'],NZ:['English']
};
// Core UI translations. Languages not yet translated keep English for safety/clarity.
const VY = {
 English:{'Language':'Language','Chat Rules':'Chat Rules','Safety Reminder':'Safety Reminder','Log Out':'Log Out','Country':'Country','Choose your chat':'Choose your chat','Choose a country and start a random video chat.':'Choose a country and start a random video chat.','Select Free or Paid before you start matching.':'Select Free or Paid before you start matching.','🆓 Free Chat':'🆓 Free Chat','Random matching · No payment':'Random matching · No payment','♀ Paid Match':'♀ Paid Match','Premium matching · Subscription':'Premium matching · Subscription','1 Day':'1 Day','1 Week · Best Value':'1 Week · Best Value','1 Month':'1 Month','Pay Now →':'Pay Now →','Choose payment':'Choose payment','PhonePe':'PhonePe','Google Pay':'Google Pay','Scan QR':'Scan QR','Start Video Chat':'Start Video Chat','You':'You','⚠️ Report & Block':'⚠️ Report & Block'},
 Hindi:{'Language':'भाषा','Chat Rules':'चैट नियम','Safety Reminder':'सुरक्षा याद दिलाना','Log Out':'लॉग आउट','Country':'देश','Choose your chat':'अपनी चैट चुनें','Choose a country and start a random video chat.':'देश चुनें और रैंडम वीडियो चैट शुरू करें।','Select Free or Paid before you start matching.':'मैचिंग शुरू करने से पहले फ्री या पेड चुनें।','🆓 Free Chat':'🆓 फ्री चैट','Random matching · No payment':'रैंडम मैचिंग · कोई भुगतान नहीं','♀ Paid Match':'♀ पेड मैच','Premium matching · Subscription':'प्रीमियम मैचिंग · सब्सक्रिप्शन','1 Day':'1 दिन','1 Week · Best Value':'1 सप्ताह · सबसे अच्छा विकल्प','1 Month':'1 महीना','Pay Now →':'अभी भुगतान करें →','Choose payment':'भुगतान चुनें','Start Video Chat':'वीडियो चैट शुरू करें','You':'आप','⚠️ Report & Block':'⚠️ रिपोर्ट और ब्लॉक'},
 Bengali:{'Language':'ভাষা','Chat Rules':'চ্যাটের নিয়ম','Safety Reminder':'নিরাপত্তা স্মরণিকা','Log Out':'লগ আউট','Country':'দেশ','Choose your chat':'চ্যাট বেছে নিন','Start Video Chat':'ভিডিও চ্যাট শুরু করুন','You':'আপনি'},
 Telugu:{'Language':'భాష','Chat Rules':'చాట్ నియమాలు','Safety Reminder':'భద్రతా రిమైండర్','Log Out':'లాగ్ అవుట్','Country':'దేశం','Choose your chat':'మీ చాట్ ఎంచుకోండి','Start Video Chat':'వీడియో చాట్ ప్రారంభించండి','You':'మీరు'},
 Tamil:{'Language':'மொழி','Chat Rules':'அரட்டை விதிகள்','Safety Reminder':'பாதுகாப்பு நினைவூட்டல்','Log Out':'வெளியேறு','Country':'நாடு','Choose your chat':'உங்கள் அரட்டையைத் தேர்வு செய்யவும்','Start Video Chat':'வீடியோ அரட்டையைத் தொடங்கு','You':'நீங்கள்'},
 Marathi:{'Language':'भाषा','Chat Rules':'चॅट नियम','Safety Reminder':'सुरक्षा स्मरणपत्र','Log Out':'लॉग आउट','Country':'देश','Choose your chat':'तुमची चॅट निवडा','Start Video Chat':'व्हिडिओ चॅट सुरू करा','You':'तुम्ही'},
 Gujarati:{'Language':'ભાષા','Chat Rules':'ચેટ નિયમો','Safety Reminder':'સુરક્ષા યાદ અપાવનાર','Log Out':'લૉગ આઉટ','Country':'દેશ','Choose your chat':'તમારી ચેટ પસંદ કરો','Start Video Chat':'વિડિયો ચેટ શરૂ કરો','You':'તમે'},
 Kannada:{'Language':'ಭಾಷೆ','Chat Rules':'ಚಾಟ್ ನಿಯಮಗಳು','Safety Reminder':'ಸುರಕ್ಷತಾ ಜ್ಞಾಪನೆ','Log Out':'ಲಾಗ್ ಔಟ್','Country':'ದೇಶ','Choose your chat':'ನಿಮ್ಮ ಚಾಟ್ ಆಯ್ಕೆಮಾಡಿ','Start Video Chat':'ವೀಡಿಯೊ ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ','You':'ನೀವು'},
 Malayalam:{'Language':'ഭാഷ','Chat Rules':'ചാറ്റ് നിയമങ്ങൾ','Safety Reminder':'സുരക്ഷാ ഓർമ്മപ്പെടുത്തൽ','Log Out':'ലോഗ് ഔട്ട്','Country':'രാജ്യം','Choose your chat':'നിങ്ങളുടെ ചാറ്റ് തിരഞ്ഞെടുക്കുക','Start Video Chat':'വീഡിയോ ചാറ്റ് ആരംഭിക്കുക','You':'നിങ്ങൾ'},
 Punjabi:{'Language':'ਭਾਸ਼ਾ','Chat Rules':'ਚੈਟ ਨਿਯਮ','Safety Reminder':'ਸੁਰੱਖਿਆ ਯਾਦ ਦਿਹਾਨੀ','Log Out':'ਲੌਗ ਆਉਟ','Country':'ਦੇਸ਼','Choose your chat':'ਆਪਣੀ ਚੈਟ ਚੁਣੋ','Start Video Chat':'ਵੀਡੀਓ ਚੈਟ ਸ਼ੁਰੂ ਕਰੋ','You':'ਤੁਸੀਂ'},
 Urdu:{'Language':'زبان','Chat Rules':'چیٹ کے اصول','Safety Reminder':'حفاظتی یاد دہانی','Log Out':'لاگ آؤٹ','Country':'ملک','Choose your chat':'اپنی چیٹ منتخب کریں','Start Video Chat':'ویڈیو چیٹ شروع کریں','You':'آپ'},
 Spanish:{'Language':'Idioma','Chat Rules':'Reglas del chat','Safety Reminder':'Recordatorio de seguridad','Log Out':'Cerrar sesión','Country':'País','Choose your chat':'Elige tu chat','Start Video Chat':'Iniciar videollamada','You':'Tú'},
 French:{'Language':'Langue','Chat Rules':'Règles du chat','Safety Reminder':'Rappel de sécurité','Log Out':'Se déconnecter','Country':'Pays','Choose your chat':'Choisissez votre chat','Start Video Chat':'Démarrer le chat vidéo','You':'Vous'},
 German:{'Language':'Sprache','Chat Rules':'Chat-Regeln','Safety Reminder':'Sicherheitshinweis','Log Out':'Abmelden','Country':'Land','Choose your chat':'Chat auswählen','Start Video Chat':'Video-Chat starten','You':'Du'},
 Arabic:{'Language':'اللغة','Chat Rules':'قواعد الدردشة','Safety Reminder':'تذكير بالسلامة','Log Out':'تسجيل الخروج','Country':'البلد','Choose your chat':'اختر محادثتك','Start Video Chat':'بدء دردشة الفيديو','You':'أنت'},
 Portuguese:{'Language':'Idioma','Chat Rules':'Regras do chat','Safety Reminder':'Lembrete de segurança','Log Out':'Sair','Country':'País','Choose your chat':'Escolha seu chat','Start Video Chat':'Iniciar chat de vídeo','You':'Você'},
 Russian:{'Language':'Язык','Chat Rules':'Правила чата','Safety Reminder':'Напоминание о безопасности','Log Out':'Выйти','Country':'Страна','Choose your chat':'Выберите чат','Start Video Chat':'Начать видеочат','You':'Вы'},
 Japanese:{'Language':'言語','Chat Rules':'チャットルール','Safety Reminder':'安全に関する注意','Log Out':'ログアウト','Country':'国','Choose your chat':'チャットを選択','Start Video Chat':'ビデオチャットを開始','You':'あなた'},
 Korean:{'Language':'언어','Chat Rules':'채팅 규칙','Safety Reminder':'안전 알림','Log Out':'로그아웃','Country':'국가','Choose your chat':'채팅 선택','Start Video Chat':'화상 채팅 시작','You':'나'},
 Chinese:{'Language':'语言','Chat Rules':'聊天规则','Safety Reminder':'安全提醒','Log Out':'退出登录','Country':'国家','Choose your chat':'选择聊天','Start Video Chat':'开始视频聊天','You':'你'},
 Indonesian:{'Language':'Bahasa','Chat Rules':'Aturan Chat','Safety Reminder':'Pengingat Keamanan','Log Out':'Keluar','Country':'Negara','Choose your chat':'Pilih chat','Start Video Chat':'Mulai Video Chat','You':'Anda'},
 Turkish:{'Language':'Dil','Chat Rules':'Sohbet Kuralları','Safety Reminder':'Güvenlik Hatırlatması','Log Out':'Çıkış Yap','Country':'Ülke','Choose your chat':'Sohbetinizi seçin','Start Video Chat':'Video Sohbeti Başlat','You':'Siz'}
};
function getVeyoraLanguage(){ return localStorage.getItem('veyoraLanguage') || 'English'; }
function applyVeyoraLanguage(lang){
 const chosen=VEYORA_LANGUAGES.some(x=>x[0]===lang)?lang:'English';
 localStorage.setItem('veyoraLanguage',chosen);
 const dict=VY[chosen]||VY.English;
 document.documentElement.lang=chosen.toLowerCase().slice(0,2);
 document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(dict[k]) el.textContent=dict[k]; });
 const cur=$('#languageCurrent'); if(cur) cur.textContent=(VEYORA_LANGUAGES.find(x=>x[0]===chosen)||['English','English'])[1];
}
function languageChoicesHtml(){
 const country=$('#country')?.value||'all';
 const recommended=VEYORA_COUNTRY_LANGS[country]||[];
 const sorted=[...VEYORA_LANGUAGES].sort((a,b)=>{const ar=recommended.indexOf(a[0]),br=recommended.indexOf(b[0]); return (ar<0?999:ar)-(br<0?999:br);});
 return `<div class="settingChoices">${sorted.map(([code,label])=>`<button type="button" class="detailChoice" data-language="${code}"><b>${label}</b><span>${recommended.includes(code)?'Recommended for selected country':'Use this language across Veyora'}</span></button>`).join('')}</div><p class="detailNote">English is the default. Your selected language is saved and can be changed anytime. Country-based languages are shown first.</p>`;
}
function openLanguageSettings(){ openSettingsDetail('Language',languageChoicesHtml()); }

async function init(){
 applyVeyoraLanguage(getVeyoraLanguage());
 // Create the Supabase client FIRST so OAuth sessions are restored into the real Supabase Auth client.
 if(window.supabase){
   try{sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch(e){sb=null}
 }
 // Restore an OAuth hash into the real Supabase client (and keep a fallback copy for restricted networks).
 await restoreOAuthHashSession();
 // Restore the real persisted Supabase session. Only use the local fallback when the SDK is unavailable.
 await restoreFallbackSession();
 $('#googleBtn').onclick=()=>oauth('google');
 $('#facebookBtn').onclick=()=>oauth('facebook');

 $('#profileNext').onclick=saveProfile;$('#startBtn').onclick=startVideo;$('#chatTypeSelect').onchange=e=>setAccess(e.target.value);$('#paidPlanSelect').onchange=e=>{selectedPlan=e.target.value;accountSet('veyoraPlan',selectedPlan);updatePaidPlanUI();};$('#payNowBtn').onclick=openPaymentModal;$('#paymentClose').onclick=closePaymentModal;$('#razorpayPayBtn').onclick=startRazorpayPayment;$('#exitVideo').onclick=exitVideo;$('#nextBtn').onclick=startVideo;
 setAccess(accountGet('veyoraAccess')==='paid'?'paid':'free');
 $('#settingsBtn').onclick=()=>togglePanel('settingsPanel');
 $('#chatBtn').onclick=toggleChatComposer;
 document.querySelectorAll('[data-close-panel]').forEach(b=>b.onclick=()=>$('#'+b.dataset.closePanel).classList.add('hidden'));
 document.querySelectorAll('[data-reaction]').forEach(b=>b.onclick=()=>showReaction(b.dataset.reaction));
 $('#chatForm').onsubmit=sendChatMessage;$('#chatOverlayForm').onsubmit=sendChatMessage;
 $('#languageSetting').onclick=openLanguageSettings;
 $('#rulesSetting').onclick=()=>openSettingsDetail('Chat Rules', `
   <div class="detailText">
    <p><b>1. Be respectful.</b> Talk to others politely and respect their boundaries.</p>
    <p><b>2. No harassment.</b> Do not bully, threaten, shame, stalk, or repeatedly disturb another person.</p>
    <p><b>3. No hate or discrimination.</b> Do not target people because of gender, nationality, religion, disability, or other personal characteristics.</p>
    <p><b>4. No sexual or exploitative content.</b> Do not send sexual material, sexual requests, or any content involving minors.</p>
    <p><b>5. No scams or illegal activity.</b> Do not request money, promote scams, impersonate others, or arrange illegal activity.</p>
    <p><b>6. Protect personal information.</b> Never share passwords, OTPs, bank/card details, home address, or private documents.</p>
    <p><b>7. Respect privacy.</b> Do not record, photograph, or redistribute another person's video without their permission.</p>
    <p><b>8. Use Report & Block.</b> If someone breaks the rules, end the chat and use Report & Block.</p>
   </div>`);
 $('#reminderSetting').onclick=()=>openSettingsDetail('Safety Reminder', `
   <div class="safetyChecklist">
    <p>✓ Never share your OTP, password, UPI PIN, bank/card details, or verification codes.</p>
    <p>✓ Avoid sharing your home address, workplace, school, or private contact information.</p>
    <p>✓ Do not send money to someone you meet through a random chat.</p>
    <p>✓ If someone pressures, threatens, exposes themselves, or makes you uncomfortable, leave immediately.</p>
    <p>✓ Use Report & Block for suspicious, abusive, sexual, threatening, or scam behavior.</p>
    <p>✓ Veyora is intended for adults 18+ only.</p>
   </div>
   <p class="detailNote">For an emergency or immediate danger, contact your local emergency services.</p>`);
 $('#logoutSetting').onclick=()=>openSettingsDetail('Log Out', `
   <div class="logoutDetail"><p><b>Ready to leave Veyora?</b></p><p>Logging out ends your current session. Your saved profile information, Veyora ID and selected plan remain on this device, so Page 2 will stay skipped when you sign in again.</p><button id="confirmLogout" class="detailDanger" type="button">Log Out of Veyora</button></div>`);
 $('#settingsDetailBack').onclick=closeSettingsDetail;
 $('#safetyReport').onclick=confirmReportAndBlock;$('#quickReportBtn').onclick=reportAndBlock;
 document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(b=>b.onclick=()=>{document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(x=>x.classList.remove('active'));b.classList.add('active');localStorage.setItem('veyoraPendingReportReason',b.dataset.reportReason);});
 $('#remoteVideoEl').onclick=()=>unlockRemoteAudio(); $('#enableRemoteAudio').onclick=unlockRemoteAudio; $('#enableRemoteAudio').classList.add('hidden'); $('#mediaPermissionBtn').classList.add('hidden'); $('#mediaPermissionBtn').onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){$('#callHint').textContent='This browser cannot access camera/microphone. Use Chrome, Edge, Safari or Firefox on HTTPS.';return;}
  const ok=await requestMediaAgain();
  if(ok){$('#mediaPermissionBtn').classList.add('hidden'); if(matchedUserId) beginPeerCall().catch(()=>{});}
};
 $('#switchCamBtn').onclick=switchCamera;$('#micBtn').onclick=toggleMic;$('#camBtn').onclick=toggleCam;$('#profileBtn').onclick=openAccount;$('#accountClose').onclick=closeAccount;$('#saveAccountBtn').onclick=saveAccountChanges;$('#accountLogoutBtn').onclick=logout;$('#accountPhotoInput').onchange=handleAccountPhoto;document.querySelectorAll('[data-account-gender]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-account-gender]').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
 document.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-gender]').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedGender=b.dataset.gender});
 $('#photoInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const photo=await compressProfileImage(f);$('#photoPreview').innerHTML='<img src="'+photo+'" alt="Profile">';}catch(err){profileMsg('Photo upload failed: '+(err?.message||'Please try again.'))}};
 try{
  const hasOAuthCallback = /(?:[?#].*(?:code=|access_token=|refresh_token=|error=))/.test(location.href);
  if(hasOAuthCallback && sb){ await new Promise(r=>setTimeout(r,150)); }
  await restoreFallbackSession();
  if(session) { await loadProfileFromSupabase(); }
  if(hasOAuthCallback && session){
    try{history.replaceState({},document.title,location.origin+location.pathname)}catch(e){}
    populateProfileFromSaved();
    show(getSavedProfile().name && getSavedProfile().dob && getSavedProfile().gender ? 'matchScreen' : 'profileScreen');
    await startOnlineCounter();
  }else if(session){
    populateProfileFromSaved();
    show(getSavedProfile().name && getSavedProfile().dob && getSavedProfile().gender ? 'matchScreen' : 'profileScreen');
    await startOnlineCounter();
    try{history.replaceState({veyoraScreen:currentScreen},document.title,location.href)}catch(e){}
    try{history.pushState({veyoraScreen:currentScreen},document.title,location.href)}catch(e){}
  }else{
    show('authScreen');
    try{history.replaceState({veyoraScreen:'authScreen'},document.title,location.href)}catch(e){}
  }
  window.addEventListener('popstate',()=>{
    // Keep the user on the current SPA screen when browser Back is pressed.
    // Do not send an authenticated user back to Login or an earlier setup page.
    if(session && currentScreen!=='authScreen') {
      if(currentScreen==='profileScreen') populateProfileFromSaved();
      show(currentScreen);
      history.pushState({veyoraScreen:currentScreen},document.title,location.href);
    } else if(!session) {
      show('authScreen');
      history.pushState({veyoraScreen:'authScreen'},document.title,location.href);
    }
  });
  if(session?.user?.id) await setupUserControlChannel();
  if(sb?.auth?.onAuthStateChange){
    sb.auth.onAuthStateChange((event,s)=>{
      session=s;
      if(event==='SIGNED_IN' && s){
        setupUserControlChannel().catch(()=>{});
        loadProfileFromSupabase().finally(()=>populateProfileFromSaved());
        startOnlineCounter();
        show(getSavedProfile().name && getSavedProfile().dob && getSavedProfile().gender ? 'matchScreen' : 'profileScreen');
        if(window.history && history.replaceState){
          history.replaceState({veyoraScreen:'profileScreen'},document.title,location.origin+location.pathname);
        }
      }
    });
  }
 }catch(e){console.error(e);msg('Login session could not be restored. Please refresh and try again.')}
}
async function oauth(provider){
 const redirectTo=getOAuthRedirectUrl();
 if(sb){const {error}=await sb.auth.signInWithOAuth({provider,options:{redirectTo}});if(error)msg(error.message);return}
 // REST fallback: use implicit flow so login also works when a CDN/script is blocked on Wi-Fi.
 const url=SUPABASE_URL+'/auth/v1/authorize?provider='+encodeURIComponent(provider)+'&redirect_to='+encodeURIComponent(redirectTo)+'&response_type=token';
 window.location.assign(url);
}
async function restoreOAuthHashSession(){
 try{
  const hash=new URLSearchParams((location.hash||'').replace(/^#/,'').replace(/^\?/,'').trim());
  const accessToken=hash.get('access_token');
  const refreshToken=hash.get('refresh_token');
  if(!accessToken) return;
  let user=null;
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+accessToken}});
  if(r.ok) user=await r.json(); else throw new Error('Could not restore Google login session.');
  // Critical: put the OAuth tokens into Supabase Auth itself. Merely storing them in our own
  // session variable is not enough for supabase-js authenticated REST calls.
  if(sb){
    const {data,error}=await sb.auth.setSession({access_token:accessToken,refresh_token:refreshToken||''});
    if(!error && data?.session){
      session=data.session;
      saveFallbackSession(session);
    }else{
      session={access_token:accessToken,refresh_token:refreshToken||'',user};
      saveFallbackSession(session);
    }
  }else{
    session={access_token:accessToken,refresh_token:refreshToken||'',user};
    saveFallbackSession(session);
  }
  try{history.replaceState({},document.title,location.pathname+location.search)}catch(e){}
  populateProfileFromSaved();
  show(getSavedProfile().name&&getSavedProfile().dob&&getSavedProfile().gender?'matchScreen':'profileScreen');
 }catch(e){console.error(e);msg(e.message||'Login could not be completed.');}
}
async function restoreFallbackSession(){
 try{
   // Prefer the real Supabase Auth session. On OAuth/PKCE redirects, explicitly
   // exchange the callback code before falling back to local storage.
   if(sb?.auth){
     try{
       const params=new URLSearchParams(location.search);
       const code=params.get('code');
       if(code){
         const exchanged=await sb.auth.exchangeCodeForSession(code);
         if(!exchanged?.error && exchanged?.data?.session){
           session=exchanged.data.session;
           saveFallbackSession(session);
           try{history.replaceState({},document.title,location.origin+location.pathname)}catch(e){}
           return;
         }
       }
     }catch(e){console.warn('OAuth code exchange failed:',e)}
     try{
       const result=await sb.auth.getSession();
       if(result?.data?.session){
         session=result.data.session;
         saveFallbackSession(session);
         return;
       }
       const refreshed=await sb.auth.refreshSession();
       if(refreshed?.data?.session){
         session=refreshed.data.session;
         saveFallbackSession(session);
         return;
       }
     }catch(e){console.warn('Supabase session restore failed:',e)}
   }

   // Fallback is only for the no-SDK/restricted-network path.
   const raw=localStorage.getItem('veyoraAuthSession');
   if(raw){
     const s=JSON.parse(raw);
     if(s?.access_token){
       const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+s.access_token}});
       if(r.ok){
         s.user=await r.json();
         if(sb?.auth){
           try{
             const restored=await sb.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token||''});
             if(restored?.data?.session) s=restored.data.session;
           }catch(e){}
         }
         session=s;
         saveFallbackSession(session);
         return;
       }
     }
   }
 }catch(e){console.warn('Fallback auth restore failed',e)}
}
function saveFallbackSession(s){try{localStorage.setItem('veyoraAuthSession',JSON.stringify(s))}catch(e){}}
function handleSession(s){if(s)show('profileScreen');else show('authScreen')}
function ensureVeyoraId(){let id=accountGet('veyoraId');if(!id){id='VY-'+Math.random().toString(36).slice(2,8).toUpperCase()+'-'+Date.now().toString().slice(-4);accountSet('veyoraId',id)}return id}
function getSavedProfile(){try{return JSON.parse(accountGet('veyoraProfile','{}')||'{}')}catch(e){return {}}}

async function supabaseProfileRequest(method, path, body){
  let activeSession=session;
  if(sb?.auth){
    try{
      const current=await sb.auth.getSession();
      if(current?.data?.session) activeSession=current.data.session;
      else if(session?.refresh_token){
        const refreshed=await sb.auth.refreshSession({refresh_token:session.refresh_token});
        if(refreshed?.data?.session) activeSession=refreshed.data.session;
      }
    }catch(e){}
  }
  if(activeSession) session=activeSession;
  const token=activeSession?.access_token;
  if(!token) throw new Error('Please sign in again before saving your profile.');
  const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  if(method==='POST'||method==='PATCH') headers.Prefer='return=representation,resolution=merge-duplicates';
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch(e){data=text}
  if(!r.ok){
    const detail=data?.message||data?.hint||data?.details||data?.error||text||('HTTP '+r.status);
    throw new Error(detail);
  }
  return data;
}
async function loadProfileFromSupabase(){
  if(!session?.user?.id||!session?.access_token)return null;
  try{
    const rows=await supabaseProfileRequest('GET',PROFILE_TABLE+'?id=eq.'+encodeURIComponent(session.user.id)+'&select=id,name,dob,gender,country,avatar_url,online,created_at');
    const row=Array.isArray(rows)?rows[0]:null;
    if(!row)return null;
    const p=getSavedProfile();
    const merged={...p,name:row.name||p.name||'',dob:row.dob||p.dob||'',gender:row.gender||p.gender||'',country:row.country||p.country||'',photo:(row.avatar_url&&/^(https?:|data:image\/)/i.test(row.avatar_url))?row.avatar_url:(p.photo||'')};
    accountSet('veyoraProfile',JSON.stringify(merged));
    if(row.country)accountSet('veyoraCountry',row.country);
    if(merged.photo && !row.avatar_url){
      try{await supabaseProfileRequest('PATCH',PROFILE_TABLE+'?id=eq.'+encodeURIComponent(session.user.id),{avatar_url:merged.photo});}catch(e){console.warn('Could not sync profile photo:',e)}
    }
    populateProfileFromSaved();
    return merged;
  }catch(e){
    console.warn('Could not load profile from Supabase:',e);
    return null;
  }
}
async function saveProfileToSupabase(extra={}){
  // Always ask Supabase Auth for the current session first. This avoids using a stale
  // locally cached token after an OAuth redirect or refresh.
  if(sb?.auth){
    try{
      let got=await sb.auth.getSession();
      if(got?.data?.session){
        session=got.data.session;
      }else{
        const refreshed=await sb.auth.refreshSession();
        if(refreshed?.data?.session) session=refreshed.data.session;
      }
    }catch(e){ console.warn('Supabase session refresh failed:',e); }
  }
  if(!session?.access_token && sb?.auth){
    const got=await sb.auth.getSession();
    if(got?.data?.session) session=got.data.session;
  }
  if(!session?.user?.id || !session?.access_token) throw new Error('No active Supabase login session. Please log in again.');

  const p=getSavedProfile();
  const row={
    id:session.user.id,
    name:p.name||null,
    dob:p.dob||null,
    gender:p.gender||null,
    country:extra.country ?? p.country ?? null,
    avatar_url:p.photo||null,
    online:extra.online ?? true
  };

  // One atomic upsert: creates the profile when missing and updates it when present.
  // This is simpler and avoids a race between SELECT -> INSERT/UPDATE.
  if(sb?.from){
    const {error}=await sb.from(PROFILE_TABLE).upsert(row,{onConflict:'id'});
    if(error) throw new Error(error.message || error.details || 'Supabase profile save failed.');
    return row;
  }
  return await supabaseProfileRequest('POST',PROFILE_TABLE,row);
}
async function setProfileOnline(isOnline){
  if(!session?.user?.id||!session?.access_token)return;
  try{await supabaseProfileRequest('PATCH',PROFILE_TABLE+'?id=eq.'+encodeURIComponent(session.user.id),{online:!!isOnline});}catch(e){console.warn('Online status update failed:',e)}
}
function openAccount(){
 const p=getSavedProfile();
 const id=ensureVeyoraId();
 $('#accountPanel').classList.remove('hidden');
 $('#accountPanel').setAttribute('aria-hidden','false');
 $('#accountNameInput').value=p.name||'';
 $('#accountDobInput').value=p.dob||'';
 $('#accountName').textContent=p.name||'Your name';
 $('#accountId').textContent='Veyora ID: '+id;
 $('#accountLoginMethod').textContent=session?.user?.email||session?.user?.phone||'Saved on this device';
 document.querySelectorAll('[data-account-gender]').forEach(b=>b.classList.toggle('active',b.dataset.accountGender===(p.gender||'')));
 $('#accountPhoto').innerHTML=p.photo?'<img src="'+p.photo+'" alt="Profile">':'👤';
 refreshAccountPlanDetails();
}
function closeAccount(){$('#accountPanel').classList.add('hidden');$('#accountPanel').setAttribute('aria-hidden','true')}
async function handleAccountPhoto(e){
 const f=e.target.files?.[0];
 if(!f)return;
 try{
   const photo=await compressProfileImage(f);
   const p=getSavedProfile();
   p.photo=photo;
   accountSet('veyoraProfile',JSON.stringify(p));
   $('#accountPhoto').innerHTML='<img src="'+photo+'" alt="Profile">';
   if($('#photoPreview'))$('#photoPreview').innerHTML='<img src="'+photo+'" alt="Profile">';
   await saveProfileToSupabase({online:true});
   $('#accountMsg').textContent='Profile photo updated.';
 }catch(err){
   console.warn('Profile photo update failed:',err);
   $('#accountMsg').textContent='Photo update failed: '+(err?.message||'Please try again.');
 }
}
async function saveAccountChanges(){
 const p=getSavedProfile();
 const name=$('#accountNameInput').value.trim(),dob=$('#accountDobInput').value;
 const gender=document.querySelector('[data-account-gender].active')?.dataset.accountGender||p.gender||'';
 if(!name){$('#accountMsg').textContent='Please enter your name.';return}
 if(!dob){$('#accountMsg').textContent='Please select your date of birth.';return}
 if(!gender){$('#accountMsg').textContent='Please select your gender.';return}
 p.name=name;p.dob=dob;p.gender=gender;
 accountSet('veyoraProfile',JSON.stringify(p));
 selectedGender=gender;populateProfileFromSaved();$('#accountName').textContent=name;
 try{await saveProfileToSupabase({online:true});$('#accountMsg').textContent='Changes saved to Veyora.';}
 catch(e){console.warn('Supabase profile update failed:',e);$('#accountMsg').textContent='Supabase save failed: '+(e?.message||'Please try again.');}
}
function populateProfileFromSaved(){
 const raw=accountGet('veyoraProfile','{}');
 if(!raw)return;
 try{
  const p=JSON.parse(raw);
  if(p.name)$('#profileName').value=p.name;
  if(p.dob)$('#dob').value=p.dob;
  if(p.gender){selectedGender=p.gender;document.querySelectorAll('[data-gender]').forEach(b=>b.classList.toggle('active',b.dataset.gender===p.gender));}
  if(p.photo)$('#photoPreview').innerHTML='<img src="'+p.photo+'" alt="Profile">';
 }catch(e){console.warn('Could not restore saved profile',e)}
}
async function saveProfile(){
 const name=$('#profileName').value.trim(),dob=$('#dob').value;
 if(!name)return profileMsg('Please enter your name.');
 if(!dob)return profileMsg('Please select your date of birth.');
 const age=new Date().getFullYear()-new Date(dob).getFullYear();
 if(age<18)return profileMsg('Veyora is for adults 18+ only.');
 if(!selectedGender)return profileMsg('Please select your gender.');
 const existing=getSavedProfile();
 const country=$('#country')?.value||existing.country||'all';
 const profile={name,dob,gender:selectedGender,country,photo:$('#photoPreview img')?.src||existing.photo||''};
 accountSet('veyoraProfile',JSON.stringify(profile));
 ensureVeyoraId();
 try{
   await saveProfileToSupabase({country,online:true});
   profileMsg('Profile saved.');
 }catch(e){
   console.warn('Supabase profile save failed:',e);
   profileMsg('Supabase save failed: '+(e?.message||'Please try again.'));
 }
 show('matchScreen');
 history.pushState({veyoraScreen:'matchScreen'},document.title,location.href);
 setProfileOnline(true);
}
let onlineTimer=null;
let presenceChannel=null;
let stream=null,remoteStream=null,micOn=true,camOn=true;
let matchRowId=null, matchedUserId=null, peer=null, matchPoll=null, signalPoll=null, partnerWatchTimer=null, isCaller=false;
let matchedProfile=null, currentMatchId=null, callChannel=null, chatChannel=null, processedSignalIds=new Set(), processedChatIds=new Set(), seenSignalNonces=new Set();
let endingMatch=false;
let userControlChannel=null;
let controlReady=false;


async function setupUserControlChannel(){
  if(!sb?.channel || !session?.user?.id) return;
  try{
    if(userControlChannel){try{await userControlChannel.unsubscribe()}catch(e){} userControlChannel=null;}
    const uid=session.user.id;
    userControlChannel=sb.channel('veyora-user-control-'+uid,{config:{broadcast:{self:false}}});
    userControlChannel.on('broadcast',{event:'call_end'},({payload})=>{
      if(!payload || payload.to!==session.user.id) return;
      if(payload.match_id && currentMatchId && payload.match_id!==currentMatchId) return;
      if(!matchedUserId) return;
      handleRemoteHangup(payload.message||'The other person ended the chat.').catch(e=>console.warn('user control hangup',e));
    });
    userControlChannel.on('broadcast',{event:'call_next'},({payload})=>{
      if(!payload || payload.to!==session.user.id) return;
      if(payload.match_id && currentMatchId && payload.match_id!==currentMatchId) return;
      if(!matchedUserId) return;
      handleRemoteHangup('The other person moved to the next person.').catch(e=>console.warn('user control next',e));
    });
    await new Promise((resolve,reject)=>{
      let done=false; const finish=(ok)=>{if(done)return;done=true;ok?resolve():reject(new Error('control timeout'))};
      userControlChannel.subscribe(status=>{if(status==='SUBSCRIBED')finish(true);else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')finish(false)});
      setTimeout(()=>finish(false),7000);
    });
    controlReady=true;
  }catch(e){controlReady=false;console.warn('user control channel failed',e)}
}

async function sendUserControl(event,target,matchId,message){
  if(!target || !session?.user?.id) return;
  const payload={to:target,from:session.user.id,match_id:matchId||null,message:message||'The other person ended the chat.',ts:Date.now()};
  // Keep the per-user channel alive until the receiver has had time to receive it.
  try{
    if(!userControlChannel || !controlReady) await setupUserControlChannel();
    if(userControlChannel){
      for(let i=0;i<3;i++){
        await userControlChannel.send({type:'broadcast',event,payload});
        await new Promise(r=>setTimeout(r,250));
      }
    }
  }catch(e){console.warn('user control send failed',e)}
}

async function startOnlineCounter(){
  if(!sb?.channel || !session?.user?.id){
    $('#onlineCount').textContent='1';
    const live=$('#liveNumber'); if(live) live.textContent='1';
    return;
  }
  try{
    if(presenceChannel){try{await presenceChannel.unsubscribe()}catch(e){} presenceChannel=null;}
    const key=session.user.id;
    presenceChannel=sb.channel('veyora-online',{config:{presence:{key}}});
    const update=()=>{
      const state=presenceChannel.presenceState();
      const unique=new Set(Object.keys(state||{}));
      const n=Math.max(1,unique.size);
      $('#onlineCount').textContent=String(n);
      const live=$('#liveNumber'); if(live) live.textContent=String(n);
    };
    presenceChannel.on('presence',{event:'sync'},update);
    presenceChannel.on('presence',{event:'join'},update);
    presenceChannel.on('presence',{event:'leave'},payload=>{
      update();
      if(payload?.key && matchedUserId && String(payload.key)===String(matchedUserId)) handleRemoteHangup('The other person left the chat.');
    });
    await new Promise((resolve,reject)=>{
      let done=false;
      const finish=(fn)=>{if(done)return;done=true;fn()};
      presenceChannel.subscribe(async status=>{
        if(status==='SUBSCRIBED'){
          try{await presenceChannel.track({user_id:key,online_at:new Date().toISOString()});update();finish(resolve)}
          catch(e){finish(()=>reject(e))}
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') finish(()=>reject(new Error(status)));
      });
      setTimeout(()=>finish(()=>reject(new Error('Presence timeout'))),7000);
    });
  }catch(e){
    console.warn('Presence failed:',e);
    $('#onlineCount').textContent='1';
    const live=$('#liveNumber'); if(live) live.textContent='1';
  }
}

async function stopOnlineCounter(){
  if(presenceChannel){try{await presenceChannel.untrack();await presenceChannel.unsubscribe()}catch(e){}presenceChannel=null;}
}

async function clearMyStaleSignals(){
  if(!session?.user?.id) return;
  const uid=encodeURIComponent(session.user.id);
  try{
    await supabaseProfileRequest('DELETE','video_signals?or=(sender_id.eq.'+uid+',receiver_id.eq.'+uid+')');
  }catch(e){console.warn('stale signal cleanup',e)}
}

async function requestMediaAgain(preferredKind=null){
  if(!navigator.mediaDevices?.getUserMedia) {
    $('#callHint').textContent='Camera and microphone are not supported in this browser.';
    return false;
  }
  let gotVideo=false, gotAudio=false;
  try{
    // Ask from the button itself. This works better on Android/desktop where a
    // combined request can fail completely when only one device is available.
    if(preferredKind==='video' || !stream?.getVideoTracks?.().some(t=>t.readyState==='live')){
      try{
        const desktop=!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        let vs=null;
        try{
          vs=await navigator.mediaDevices.getUserMedia({video:desktop?{width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3},frameRate:{ideal:30,max:30}}:{facingMode:'user',width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3}},audio:false});
        }catch(first){
          const devices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);
          const cam=devices.find(d=>d.kind==='videoinput' && d.deviceId);
          if(cam) vs=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:cam.deviceId}},audio:false});
          else throw first;
        }
        const vt=vs?.getVideoTracks?.()[0];
        if(vt){
          if(!stream) stream=new MediaStream();
          const old=stream.getVideoTracks()[0]; if(old && old!==vt) old.stop();
          if(!stream.getVideoTracks().includes(vt)) stream.addTrack(vt); gotVideo=true;
        }
      }catch(e){ console.warn('camera request failed',e); }
    }
    if(preferredKind==='audio' || !stream?.getAudioTracks?.().some(t=>t.readyState==='live')){
      try{
        let as=null;
        try{
          as=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
        }catch(first){
          as=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
        }
        const at=as?.getAudioTracks?.()[0];
        if(at){
          if(!stream) stream=new MediaStream();
          const old=stream.getAudioTracks()[0]; if(old && old!==at) old.stop();
          if(!stream.getAudioTracks().includes(at)) stream.addTrack(at); gotAudio=true;
        }
      }catch(e){ console.warn('microphone request failed',e); }
    }
    gotVideo = gotVideo || !!stream?.getVideoTracks?.().some(t=>t.readyState==='live');
    gotAudio = gotAudio || !!stream?.getAudioTracks?.().some(t=>t.readyState==='live');
    if(!stream || (!gotVideo && !gotAudio)) throw new Error('No media permission/device available');
    micOn=stream.getAudioTracks().some(t=>t.enabled); camOn=stream.getVideoTracks().some(t=>t.enabled);
    const preview=$('#cameraPreview');
    preview.srcObject=stream; preview.muted=true; preview.autoplay=true; preview.playsInline=true;
    preview.setAttribute('autoplay',''); preview.setAttribute('muted',''); preview.setAttribute('playsinline','');
    preview.onloadedmetadata=()=>preview.play().catch(()=>{});
    preview.oncanplay=()=>preview.play().catch(()=>{});
    await preview.play().catch(()=>{});
    $('#micBtn').textContent=micOn?'🎙️':'🔇'; $('#micBtn').classList.toggle('disabled',!micOn);
    $('#camBtn').textContent=camOn?'📹':'🚫'; $('#camBtn').classList.toggle('disabled',!camOn);
    $('#mediaPermissionBtn').classList.add('hidden');
    $('#callHint').textContent=(gotVideo&&gotAudio)?'Camera & microphone are on.':(gotVideo?'Camera is on. Tap 🎙️ to enable microphone.':'Microphone is on. Tap 📹 to enable camera.');
    if(peer){
      for(const track of stream.getTracks()){
        const sender=peer.getSenders().find(x=>x.track?.kind===track.kind);
        if(sender) await sender.replaceTrack(track); else peer.addTrack(track,stream);
      }
      if(peer.connectionState==='failed' || peer.iceConnectionState==='failed') peer.restartIce();
    }
    return true;
  }catch(e){
    $('#callHint').textContent='Tap 🎙️ for microphone or 📹 for camera to allow it.';
    return false;
  }
}

async function startVideo(){
 endingMatch=false;
 if(session?.user?.id && !controlReady) await setupUserControlChannel().catch(()=>{});
 clearInterval(partnerWatchTimer);partnerWatchTimer=null;
 if(chatAccess==='paid'&&!selectedPlan){alert('Please choose a paid plan first.');return}
 if(chatAccess==='paid') {
   const planInfo=getPlanInfo();
   if(!planInfo.active || planInfo.plan!==selectedPlan){alert('Your selected Paid Match plan is not active. Please complete a new payment.');openPaymentModal();return}
 }
 const countryValue=$('#country')?.value||'all';
 const currentProfile=getSavedProfile();
 if(currentProfile.country!==countryValue){
   currentProfile.country=countryValue;
   localStorage.setItem('veyoraProfile',JSON.stringify(currentProfile));
   try{await saveProfileToSupabase({country:countryValue,online:true});}catch(e){console.warn('Country save failed:',e)}
 } else { setProfileOnline(true); }
 if(matchedUserId){
   const oldTarget=matchedUserId, oldId=currentMatchId;
   await sendUserControl('call_next',oldTarget,oldId,'The other person moved to the next person.');
   await sendHangup();
 }
 await leaveMatchQueue();
 if(callChannel){try{await callChannel.unsubscribe()}catch(e){} callChannel=null;}
 if(chatChannel){try{await chatChannel.unsubscribe()}catch(e){} chatChannel=null;}
 if(peer){try{peer.ontrack=null;peer.close()}catch(e){}peer=null;}
 if(remoteStream){try{remoteStream.getTracks().forEach(t=>t.stop())}catch(e){}remoteStream=null;}
 pendingIce=[];
 currentMatchId=null; matchedUserId=null; matchRowId=null;
 clearInterval(matchPoll);matchPoll=null;clearInterval(signalPoll);signalPoll=null;
 $('#remoteVideoEl').srcObject=null;
 const remoteEl=$('#remoteVideoEl');
 if(remoteEl){remoteEl.muted=false;remoteEl.autoplay=true;remoteEl.playsInline=true;remoteEl.setAttribute('autoplay','');remoteEl.setAttribute('playsinline','');}
 $('#chatOverlayMessages').innerHTML='';
 $('#chatMessages').innerHTML='<p class="emptyChat">Be respectful and follow the chat rules.</p>';
 $('#videoScreen').classList.remove('hidden');
 $('#searchTitle').textContent='Finding a match…';
 $('#videoStatusText').textContent='Searching for someone…';
 $('#callHint').textContent='Starting camera and microphone…';
 $('#matchFlag').textContent='🌍';
 $('#matchCountry').textContent='Searching…';
 $('#matchGenderIcon').textContent='⚧';

 // Desktop browsers are more reliable when camera and microphone are requested
 // independently. A combined request can fail completely if one device/permission
 // is unavailable. Phones keep their front-camera preference; desktop simply asks
 // for the default webcam and then uses deviceId when switching cameras.
 let videoTrack=stream?.getVideoTracks?.().find(t=>t.readyState==='live')||null;
 let audioTrack=stream?.getAudioTracks?.().find(t=>t.readyState==='live')||null;
 if(!navigator.mediaDevices?.getUserMedia){
   $('#callHint').textContent='Camera/microphone are not supported here. Use Chrome, Edge, Safari or Firefox on HTTPS.';
 }else{
   if(!videoTrack){
     try{
       let constraints={video:{width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3},frameRate:{ideal:30,max:30}},audio:false};
       // facingMode is only a preference on phones; avoid it on desktop.
       const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
       if(mobile) constraints.video.facingMode='user';
       const vs=await navigator.mediaDevices.getUserMedia(constraints);
       videoTrack=vs.getVideoTracks()[0]||null;
       if(videoTrack){
         if(!stream) stream=new MediaStream();
         stream.getVideoTracks().forEach(t=>t!==videoTrack&&t.stop());
         if(!stream.getVideoTracks().includes(videoTrack)) stream.addTrack(videoTrack);
       }
     }catch(e){
       console.warn('video permission/device failed',e);
       // Final browser fallback: no constraints at all.
       try{
         const vs=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
         videoTrack=vs.getVideoTracks()[0]||null;
         if(videoTrack){if(!stream)stream=new MediaStream();stream.getVideoTracks().forEach(t=>t.stop());stream.addTrack(videoTrack);}
       }catch(e2){console.warn('basic video failed',e2);}
     }
   }
   if(!audioTrack){
     try{
       const as=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
       audioTrack=as.getAudioTracks()[0]||null;
       if(audioTrack){
         if(!stream)stream=new MediaStream();
         stream.getAudioTracks().forEach(t=>t!==audioTrack&&t.stop());
         if(!stream.getAudioTracks().includes(audioTrack)) stream.addTrack(audioTrack);
       }
     }catch(e){
       console.warn('audio permission/device failed',e);
       try{
         const as=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
         audioTrack=as.getAudioTracks()[0]||null;
         if(audioTrack){if(!stream)stream=new MediaStream();stream.getAudioTracks().forEach(t=>t.stop());stream.addTrack(audioTrack);}
       }catch(e2){console.warn('basic audio failed',e2);}
     }
   }
   if(stream){
     micOn=!!stream.getAudioTracks().some(t=>t.readyState==='live');
     camOn=!!stream.getVideoTracks().some(t=>t.readyState==='live');
     const preview=$('#cameraPreview');
     preview.srcObject=stream;preview.muted=true;preview.autoplay=true;preview.playsInline=true;
     try{await preview.play()}catch(e){}
     $('#micBtn').textContent=micOn?'🎙️':'🔇';$('#micBtn').classList.toggle('disabled',!micOn);
     $('#camBtn').textContent=camOn?'📹':'🚫';$('#camBtn').classList.toggle('disabled',!camOn);
     if(camOn&&micOn) $('#callHint').textContent='Camera & microphone are on. Searching for a match…';
     else if(camOn) $('#callHint').textContent='Camera is on. Tap 🎙️ to enable microphone.';
     else if(micOn) $('#callHint').textContent='Microphone is on. Tap 📹 to enable camera.';
     else $('#callHint').textContent='Tap 📹 and 🎙️ to allow camera and microphone.';
   }
 }
 // Final recovery pass: if desktop Chrome returned no live tracks, retry through
 // the same independent button-safe media routine before matchmaking begins.
 if(!stream?.getVideoTracks?.().some(t=>t.readyState==='live') || !stream?.getAudioTracks?.().some(t=>t.readyState==='live')){
   await requestMediaAgain().catch(()=>false);
 }
 const finalPreview=$('#cameraPreview');
 if(finalPreview && stream){
   finalPreview.srcObject=stream; finalPreview.muted=true; finalPreview.autoplay=true; finalPreview.playsInline=true;
   finalPreview.setAttribute('autoplay',''); finalPreview.setAttribute('muted',''); finalPreview.setAttribute('playsinline','');
   finalPreview.play().catch(()=>{});
 }
 await joinMatchQueue(countryValue);
}
async function rpcFindMatch(country){
  const uid=session?.user?.id;
  if(!uid) throw new Error('Please log in again before matching.');
  if(sb?.rpc){
    const profile=getSavedProfile()||{};
    const {data,error}=await sb.rpc('veyora_find_match',{p_user_id:uid,p_country:country||'all',p_gender:profile.gender||'',p_access:(accountGet('veyoraPlan','')||'Free Chat').toLowerCase().includes('paid')?'paid':'free'});
    if(error) throw new Error(error.message||'Matchmaking function failed.');
    return Array.isArray(data)?data[0]:data;
  }
  const token=session.access_token;
  const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/veyora_find_match',{
    method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({p_user_id:uid,p_country:country||'all',p_gender:profile.gender||'',p_access:(accountGet('veyoraPlan','')||'Free Chat').toLowerCase().includes('paid')?'paid':'free'})
  });
  const text=await r.text(); let data; try{data=text?JSON.parse(text):null}catch(e){data=text}
  if(!r.ok) throw new Error(data?.message||data?.hint||data?.details||data||'Matchmaking function failed.');
  return Array.isArray(data)?data[0]:data;
}

async function joinMatchQueue(country){
  if(!session?.user?.id){$('#callHint').textContent='Please log in again before matching.';return;}
  try{
    const result=await rpcFindMatch(country);
    matchRowId=result?.queue_id||null;
    if(result?.matched_user_id){
      matchedUserId=result.matched_user_id;
      currentMatchId=result?.match_id||null;
      isCaller=session.user.id>matchedUserId;
      await showMatchedUser(matchedUserId);
      await setupCallChannels(currentMatchId);
      startPartnerWatch();
      $('#searchTitle').textContent='Match found!';$('#videoStatusText').textContent='Connecting…';$('#callHint').textContent='Connecting video…';
      await beginPeerCall();
      return;
    }
    $('#searchTitle').textContent='Finding a match…';
    clearInterval(matchPoll);matchPoll=setInterval(pollForMatch,1200);
    await pollForMatch();
  }catch(e){
    console.error('Matchmaking failed',e);
    $('#callHint').textContent='Could not start matching: '+(e.message||'try again');
  }
}

async function pollForMatch(){
  if(!session?.user?.id||!matchRowId)return;
  try{
    const rows=await supabaseProfileRequest('GET','match_queue?id=eq.'+encodeURIComponent(matchRowId)+'&select=id,status,matched_with,match_id');
    const r=rows?.[0];
    if(r?.status==='matched'&&r.matched_with){
      clearInterval(matchPoll);matchPoll=null;matchedUserId=r.matched_with;currentMatchId=r.match_id||null;isCaller=session.user.id>matchedUserId;
      await showMatchedUser(matchedUserId);
      await setupCallChannels(currentMatchId);
      startPartnerWatch();
      $('#searchTitle').textContent='Match found!';$('#videoStatusText').textContent='Connecting…';$('#callHint').textContent='Connecting video…';
      await beginPeerCall();
    }
  }catch(e){console.warn('match poll',e)}
}

async function showMatchedUser(uid){
  try{
    const rows=await supabaseProfileRequest('GET',PROFILE_TABLE+'?id=eq.'+encodeURIComponent(uid)+'&select=country,gender,name,avatar_url');
    matchedProfile=rows?.[0]||null;
    const avatar=$('#otherUserAvatar');
    if(avatar){
      const photo=matchedProfile?.avatar_url;
      avatar.innerHTML=(photo && /^(https?:|data:image\/)/i.test(photo))
        ? '<img src="'+photo.replace(/\"/g,'&quot;')+'" alt="Profile photo">'
        : '👤';
    }
    const countryCode=matchedProfile?.country||'all';
    const sel=$('#country');
    let text='All countries',flag='🌍';
    if(sel){
      const opt=Array.from(sel.options).find(o=>o.value===countryCode);
      if(opt){text=opt.textContent.replace(/^\S+\s*/,'')||text;flag=(opt.textContent.match(/^\S+/)||['🌍'])[0];}
      else if(countryCode!=='all'){text=countryCode;}
    }
    $('#matchFlag').textContent=flag;$('#matchCountry').textContent=text;
    const g=String(matchedProfile?.gender||'').toLowerCase();
    $('#matchGenderIcon').textContent=g==='male'?'👦':g==='female'?'👩':'👤';
  }catch(e){console.warn('Matched profile load failed',e)}
}

async function leaveMatchQueue(){
  clearInterval(matchPoll);matchPoll=null;clearInterval(signalPoll);signalPoll=null;clearInterval(partnerWatchTimer);partnerWatchTimer=null;
  if(!session?.user?.id)return;
  try{await supabaseProfileRequest('DELETE','match_queue?user_id=eq.'+encodeURIComponent(session.user.id));}catch(e){}
  matchRowId=null;matchedUserId=null;matchedProfile=null;currentMatchId=null;
}

async function clearVideoSignalsForPeer(){
  if(!session?.user?.id || !matchedUserId) return;
  const a=encodeURIComponent(session.user.id);
  const b=encodeURIComponent(matchedUserId);
  try{
    await supabaseProfileRequest('DELETE',
      'video_signals?or=(and(sender_id.eq.'+a+',receiver_id.eq.'+b+'),and(sender_id.eq.'+b+',receiver_id.eq.'+a+'))'
    );
  }catch(e){console.warn('signal cleanup',e)}
}

async function setupCallChannels(matchId){
  if(!sb?.channel || !session?.user?.id || !matchId) return;
  try{
    if(callChannel){try{await callChannel.unsubscribe()}catch(e){} callChannel=null;}
    if(chatChannel){try{await chatChannel.unsubscribe()}catch(e){} chatChannel=null;}
    processedSignalIds=new Set();
    processedChatIds=new Set();
    seenSignalNonces=new Set();
    const callName='veyora-call-'+matchId;
    callChannel=sb.channel(callName,{config:{broadcast:{self:false}}});
    callChannel.on('broadcast',{event:'hangup'},({payload})=>{
      if(payload?.match_id!==currentMatchId || payload?.to!==session.user.id) return;
      handleRemoteHangup(payload?.signal?.message || payload?.message || 'The other person ended the chat.').catch(e=>console.warn('remote hangup',e));
    });
    callChannel.on('broadcast',{event:'signal'},({payload})=>{
      if(payload?.match_id!==currentMatchId || payload?.to!==session.user.id) return;
      processSignalPayload(payload.signal).catch(e=>console.warn('realtime signal',e));
    });
    await new Promise((resolve,reject)=>{
      let done=false;
      const finish=(fn)=>{if(done)return;done=true;fn()};
      callChannel.subscribe(status=>{
        if(status==='SUBSCRIBED') finish(resolve);
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') finish(()=>reject(new Error(status)));
      });
      setTimeout(()=>finish(()=>reject(new Error('Call channel timeout'))),8000);
    });

    chatChannel=sb.channel('veyora-chat-'+matchId,{config:{broadcast:{self:false}}});
    chatChannel.on('broadcast',{event:'message'},({payload})=>{
      if(payload?.match_id!==currentMatchId || payload?.to!==session.user.id) return;
      const id=payload.message_id;
      if(id && processedChatIds.has(id)) return;
      if(id) processedChatIds.add(id);
      appendChatBubble(payload.text,false);
    });
    await new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(done)return;done=true;resolve()};
      chatChannel.subscribe(status=>{if(status==='SUBSCRIBED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT')finish()});
      setTimeout(finish,8000);
    });
  }catch(e){
    console.warn('Realtime channels failed; REST fallback remains active:',e);
  }
}

async function processSignalPayload(p){
  if(!p) return;
  if(p.type!=='hangup' && p.type!=='chat' && !peer) return;
  // The same signal can arrive twice: once through Supabase Broadcast and once
  // through the REST fallback table. Ignore duplicate nonces so an offer is
  // never applied twice (a duplicate offer can break the WebRTC state machine).
  if(p.signal_id){
    if(seenSignalNonces.has(p.signal_id)) return;
    seenSignalNonces.add(p.signal_id);
  }
  try{
    if(p.type==='hangup'){
      await handleRemoteHangup(p.message||'The other person left the chat.');
      return;
    }
    if(p.type==='chat'){
      if(p.message_id && processedChatIds.has(p.message_id)) return;
      if(p.message_id) processedChatIds.add(p.message_id);
      if(p.match_id && currentMatchId && p.match_id!==currentMatchId) return;
      appendChatBubble(p.text||'',false);
      return;
    }
    if(p.type==='offer'){
      // This build has one deterministic caller, so an offer is only accepted
      // while the peer is stable and before a remote description exists.
      if(peer.remoteDescription || peer.signalingState!=='stable') return;
      await peer.setRemoteDescription(new RTCSessionDescription(p.sdp));
      await applyPendingIce();
      const ans=await peer.createAnswer();
      await peer.setLocalDescription(ans);
      // Trickle ICE is enabled. Send the answer immediately; candidates are
      // sent separately by onicecandidate instead of waiting several seconds.
      await sendSignal({type:'answer',sdp:peer.localDescription});
    }else if(p.type==='answer'){
      if(peer.signalingState==='have-local-offer' && !peer.remoteDescription){
        await peer.setRemoteDescription(new RTCSessionDescription(p.sdp));
        await applyPendingIce();
      }
    }else if(p.type==='ice'){
      if(!p.candidate)return;
      const c=new RTCIceCandidate(p.candidate);
      if(peer.remoteDescription) await peer.addIceCandidate(c);
      else pendingIce.push(c);
    }
  }catch(e){console.warn('process signal',e)}
}

function unlockRemoteAudio(){
  const v=$('#remoteVideoEl');
  if(!v) return;
  v.muted=false; v.volume=1;
  const b=$('#enableRemoteAudio'); if(b) b.classList.add('hidden');
  v.play().then(()=>{ $('#callHint').textContent='Audio enabled.'; }).catch(()=>{ const b=$('#enableRemoteAudio'); if(b) b.classList.remove('hidden'); });
}

function makePeer(){
  peer=new RTCPeerConnection({
    bundlePolicy:'max-bundle',
    rtcpMuxPolicy:'require',
    iceCandidatePoolSize:10,
    iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:stun2.l.google.com:19302'},
      {urls:'stun:stun.cloudflare.com:3478'},
      {urls:'stun:stun.nextcloud.com:443'},
      {urls:'stun:stun.voipgate.com:3478'}
    ]
  });
  pendingIce=[];
  // Do not create empty transceivers before addTrack(). That used to create
  // duplicate audio/video m-lines and could leave the remote side black/silent.
  if(stream){
    for(const track of stream.getTracks()){
      try{peer.addTrack(track,stream)}catch(e){console.warn('addTrack',e)}
    }
  }
  peer.ontrack=e=>{
    const v=$('#remoteVideoEl');
    if(!remoteStream) remoteStream=new MediaStream();
    const incoming=e.streams?.[0];
    if(incoming){
      for(const t of incoming.getTracks()){
        if(!remoteStream.getTracks().some(x=>x.id===t.id)) remoteStream.addTrack(t);
      }
    }
    if(e.track && !remoteStream.getTracks().some(t=>t.id===e.track.id)) remoteStream.addTrack(e.track);
    if(v.srcObject!==remoteStream) v.srcObject=remoteStream;
    v.autoplay=true; v.playsInline=true; v.controls=false; v.volume=1; v.muted=false;
    v.setAttribute('autoplay',''); v.setAttribute('playsinline','');
    const placeholder=$('.remotePlaceholder');
    const videoBox=$('#remoteVideo');
    if(videoBox) videoBox.classList.add('hasRemoteVideo');
    const markConnected=()=>{
      if(placeholder) placeholder.style.display='none';
      $('#searchTitle').textContent='Connected';
      $('#videoStatusText').textContent='Connected';
      $('#callHint').textContent='You are connected.';
    };
    const unlock=()=>{
      v.muted=false;
      v.volume=1;
      const b=$('#enableRemoteAudio'); if(b) b.classList.add('hidden');
      return v.play().then(markConnected).catch(()=>{ markConnected(); const b=$('#enableRemoteAudio'); if(b) b.classList.remove('hidden'); $('#callHint').textContent="Tap 🔊 for the other person's sound."; });
    };
    if(e.track) e.track.onunmute=()=>{unlock();};
    unlock();
  };
  const remoteVideo=$('#remoteVideoEl');
  if(remoteVideo){
    remoteVideo.onloadedmetadata=()=>{
      if(remoteVideo.srcObject && remoteVideo.srcObject.getVideoTracks?.().length){
        const placeholder=$('.remotePlaceholder');
        if(placeholder) placeholder.style.display='none';
      }
    };
    remoteVideo.onplaying=()=>{
      const placeholder=$('.remotePlaceholder');
      if(placeholder) placeholder.style.display='none';
    };
  }
  peer.onicecandidate=e=>{
    if(e.candidate)sendSignal({type:'ice',candidate:e.candidate.toJSON?.()||e.candidate});
  };
  peer.oniceconnectionstatechange=()=>{
    if(!peer)return;
    if(peer.iceConnectionState==='connected'||peer.iceConnectionState==='completed'){
      $('#searchTitle').textContent='Connected';
      $('#videoStatusText').textContent='Connected';
      $('#callHint').textContent='You are connected.';
    }
  };
  peer.onconnectionstatechange=()=>{
    if(!peer)return;
    const st=peer.connectionState;
    if(st==='connected'){
      $('#searchTitle').textContent='Connected';
      $('#videoStatusText').textContent='Connected';
      $('#callHint').textContent='You are connected.';
    }else if(['failed','disconnected'].includes(st)){
      $('#callHint').textContent='Video connection failed. Tap Next to try another person.';
    }
  };
}

async function handleRemoteHangup(message='The other person left the chat.'){
  if(endingMatch) return;
  const shouldAutoMatch = !!matchedUserId;
  endingMatch=true;
  const oldPeer=peer;
  const oldRemote=remoteStream;
  const oldMatchRow=matchRowId;
  const oldPartner=matchedUserId;
  clearInterval(matchPoll); matchPoll=null;
  clearInterval(signalPoll); signalPoll=null;
  clearInterval(partnerWatchTimer); partnerWatchTimer=null;
  pendingIce=[];
  // Tear down the WebRTC call immediately so no old audio/video continues.
  if(oldPeer){ try{ oldPeer.ontrack=null; oldPeer.onconnectionstatechange=null; oldPeer.oniceconnectionstatechange=null; oldPeer.close(); }catch(e){} }
  peer=null;
  if(oldRemote){ try{oldRemote.getTracks().forEach(t=>t.stop())}catch(e){} }
  remoteStream=null;
  const rv=$('#remoteVideoEl');
  if(rv) rv.srcObject=null;
  const placeholder=$('.remotePlaceholder');
  if(placeholder) placeholder.style.display='grid';
  const videoBox=$('#remoteVideo');
  if(videoBox) videoBox.classList.remove('hasRemoteVideo');
  // Remove our matched queue row as well. This guarantees Next starts from a
  // clean queue instead of inheriting the previous call's matched row.
  if(session?.user?.id){
    try{await supabaseProfileRequest('DELETE','match_queue?user_id=eq.'+encodeURIComponent(session.user.id))}catch(e){}
  }
  // Remove any old signaling packets for this pair, but only after hangup was
  // processed. A new Next click will create a new match_id and fresh signals.
  if(oldPartner && session?.user?.id){
    const a=encodeURIComponent(session.user.id), b=encodeURIComponent(oldPartner);
    try{await supabaseProfileRequest('DELETE','video_signals?or=(and(sender_id.eq.'+a+',receiver_id.eq.'+b+'),and(sender_id.eq.'+b+',receiver_id.eq.'+a+'))')}catch(e){}
  }
  if(callChannel){try{await callChannel.unsubscribe()}catch(e){} callChannel=null;}
  if(chatChannel){try{await chatChannel.unsubscribe()}catch(e){} chatChannel=null;}
  matchedUserId=null; matchedProfile=null; currentMatchId=null; matchRowId=null;
  $('#searchTitle').textContent=shouldAutoMatch?'Finding a match…':'Chat ended';
  $('#videoStatusText').textContent=shouldAutoMatch?'Searching for someone…':'Disconnected';
  $('#callHint').textContent=message;
  const chatA=$('#chatOverlayMessages'); if(chatA) chatA.innerHTML='';
  const chatB=$('#chatMessages'); if(chatB) chatB.innerHTML='<p class="emptyChat">Be respectful and follow the chat rules.</p>';
  $('#chatComposer')?.classList.add('hidden');
  $('#chatPanel')?.classList.add('hidden');
  // Keep the local camera/mic alive. The remaining user should move directly
  // into a new match without waiting for a second permission prompt.
  const preview=$('#cameraPreview');
  if(preview && stream){ preview.srcObject=stream; preview.muted=true; preview.autoplay=true; preview.playsInline=true; preview.play().catch(()=>{}); }
  $('#micBtn').textContent=micOn?'🎙️':'🔇'; $('#micBtn').classList.toggle('disabled',!micOn);
  $('#camBtn').textContent=camOn?'📹':'🚫'; $('#camBtn').classList.toggle('disabled',!camOn);
  endingMatch=false;
  // Automatically return to fresh matchmaking when the other person exits.
  // This keeps the remaining user from getting stuck on a dead call.
  if(shouldAutoMatch && session?.user?.id){
    setTimeout(()=>{ if(!endingMatch && !matchedUserId) startVideo().catch(()=>{}); },450);
  }
} 

// A user's global online presence stays active while they press Next/Exit, so
// presence "leave" cannot reliably tell the other peer that the call ended.
// Watch the exact matched queue row instead. If the partner deletes it or gets
// a different match_id, the current call is ended locally.
async function watchPartnerQueue(){
  const uid=session?.user?.id, partner=matchedUserId, matchId=currentMatchId;
  if(!uid || !partner || !matchId || endingMatch) return;
  try{
    const rows=await supabaseProfileRequest(
      'GET',
      'match_queue?user_id=eq.'+encodeURIComponent(partner)+
      '&status=eq.matched&matched_with=eq.'+encodeURIComponent(uid)+
      '&match_id=eq.'+encodeURIComponent(matchId)+
      '&select=id'
    );
    if(matchedUserId===partner && currentMatchId===matchId && (!rows || !rows.length)){
      await handleRemoteHangup('The other person left the chat.');
    }
  }catch(e){console.warn('partner queue watch',e)}
}

function startPartnerWatch(){
  clearInterval(partnerWatchTimer);
  partnerWatchTimer=setInterval(watchPartnerQueue,650);
  watchPartnerQueue().catch(()=>{});
}

async function sendHangup(){
  const target=matchedUserId;
  const matchId=currentMatchId;
  const uid=session?.user?.id;
  if(!target || !uid || !matchId) return;
  const payload={type:'hangup',message:'The other person ended the chat.',match_id:matchId,signal_id:(crypto.randomUUID?.() || String(Date.now())+'-hangup')};
  const envelope={match_id:matchId,to:target,from:uid,signal:payload};
  // A persistent per-user control channel is independent of the call channel,
  // so Exit/Next cannot be lost when the old call channel is being closed.
  await sendUserControl('call_end',target,matchId,'The other person ended the chat.');
  // Broadcast more than once before tearing the channel down. This matters on
  // mobile Safari where an immediate unsubscribe/exit can race the packet.
  for(let i=0;i<2;i++){
    try{
      if(callChannel) await callChannel.send({type:'broadcast',event:'signal',payload:envelope});
      if(callChannel) await callChannel.send({type:'broadcast',event:'hangup',payload:envelope});
    }catch(e){console.warn('hangup broadcast failed',e)}
    try{
      await supabaseProfileRequest('POST','video_signals',{
        sender_id:uid,receiver_id:target,
        payload:{...payload,match_id:matchId}
      });
    }catch(e){console.warn('hangup REST fallback failed',e)}
    await new Promise(r=>setTimeout(r,350));
  }
}

async function sendSignal(payload){
  if(!matchedUserId||!session?.user?.id)return;
  const signal_id=payload.signal_id || (crypto.randomUUID?.() || String(Date.now())+'-'+Math.random());
  const signal={...payload,signal_id};
  if(seenSignalNonces.has(signal_id)) return;
  seenSignalNonces.add(signal_id);
  const envelope={match_id:currentMatchId,to:matchedUserId,from:session.user.id,signal};
  try{
    if(callChannel) await callChannel.send({type:'broadcast',event:'signal',payload:envelope});
  }catch(e){console.warn('broadcast signal failed',e)}
  try{
    await supabaseProfileRequest('POST','video_signals',{
      sender_id:session.user.id,
      receiver_id:matchedUserId,
      payload:{...signal,match_id:currentMatchId}
    });
  }catch(e){
    console.error('signal REST fallback failed',e);
    $('#callHint').textContent='Video signaling failed. Please try Next.';
  }
}

async function waitForIceGathering(){
  if(!peer || peer.iceGatheringState==='complete')return;
  await new Promise(resolve=>{
    const timer=setTimeout(resolve,5000);
    const check=()=>{
      if(!peer || peer.iceGatheringState==='complete'){
        clearTimeout(timer);
        if(peer)peer.removeEventListener('icegatheringstatechange',check);
        resolve();
      }
    };
    peer.addEventListener('icegatheringstatechange',check);
  });
}

async function applyPendingIce(){
  if(!peer?.remoteDescription || !pendingIce.length)return;
  const list=pendingIce.splice(0);
  for(const c of list){
    try{await peer.addIceCandidate(c)}catch(e){console.warn('pending ICE',e)}
  }
}

async function readSignals(){
  if(!matchedUserId||!session?.user?.id)return;
  try{
    const rows=await supabaseProfileRequest(
      'GET',
      'video_signals?receiver_id=eq.'+encodeURIComponent(session.user.id)+
      '&sender_id=eq.'+encodeURIComponent(matchedUserId)+
      '&select=id,payload&order=created_at.asc&limit=100'
    );
    for(const row of rows||[]){
      if(processedSignalIds.has(row.id)) continue;
      const p=row.payload||{};
      if(p.match_id && currentMatchId && p.match_id!==currentMatchId){
        processedSignalIds.add(row.id);
        await supabaseProfileRequest('DELETE','video_signals?id=eq.'+encodeURIComponent(row.id)).catch(()=>{});
        continue;
      }
      try{
        await processSignalPayload(p);
        processedSignalIds.add(row.id);
        await supabaseProfileRequest('DELETE','video_signals?id=eq.'+encodeURIComponent(row.id)).catch(()=>{});
      }catch(e){console.warn('signal process',e)}
    }
  }catch(e){console.warn('signal poll',e)}
}

async function beginPeerCall(){
  if(peer)return;
  if(!callChannel && currentMatchId) await setupCallChannels(currentMatchId);
  if(!window.RTCPeerConnection){$('#callHint').textContent='This browser does not support video calls.';return;}
  makePeer();
  clearInterval(signalPoll);
  signalPoll=setInterval(readSignals,500);
  await readSignals();
  if(isCaller){
    const offer=await peer.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
    await peer.setLocalDescription(offer);
    await sendSignal({type:'offer',sdp:peer.localDescription});
  }
}

async function toggleMic(){
  const tracks=stream?.getAudioTracks?.()||[];
  if(!tracks.length){
    await requestMediaAgain('audio');
    return;
  }
  micOn=!micOn;
  tracks.forEach(t=>t.enabled=micOn);
  $('#micBtn').classList.toggle('disabled',!micOn);
  $('#micBtn').textContent=micOn?'🎙️':'🔇';
  $('#micBtn').setAttribute('aria-label',micOn?'Mute microphone':'Unmute microphone');
}
async function toggleCam(){
  const tracks=stream?.getVideoTracks?.()||[];
  if(!tracks.length){
    await requestMediaAgain('video');
    return;
  }
  camOn=!camOn;
  tracks.forEach(t=>t.enabled=camOn);
  $('#camBtn').classList.toggle('disabled',!camOn);
  $('#camBtn').textContent=camOn?'📹':'🚫';
  $('#camBtn').setAttribute('aria-label',camOn?'Turn camera off':'Turn camera on');
}
async function switchCamera(){
  if(!stream || !navigator.mediaDevices?.getUserMedia) return;
  const current=stream.getVideoTracks()[0];
  if(!current){$('#callHint').textContent='Camera is not available.';return;}
  const settings=current.getSettings?.()||{};
  const facing=settings.facingMode||'user';
  const nextFacing=facing==='environment'?'user':'environment';
  let nextStream=null;
  try{
    // First try the browser's native front/back selector.
    try{
      nextStream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{exact:nextFacing},width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3}},
        audio:false
      });
    }catch(firstErr){
      // Some desktop browsers do not expose facingMode. Pick another physical
      // camera by deviceId instead.
      const devices=await navigator.mediaDevices.enumerateDevices();
      const cams=devices.filter(d=>d.kind==='videoinput');
      if(cams.length<2) throw firstErr;
      const currentId=settings.deviceId;
      let target=cams.find(d=>d.deviceId!==currentId);
      if(!target) target=cams[0];
      nextStream=await navigator.mediaDevices.getUserMedia({
        video:{deviceId:{exact:target.deviceId},width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3}},
        audio:false
      });
    }
    const newTrack=nextStream?.getVideoTracks?.()[0];
    if(!newTrack) throw new Error('No replacement camera track');
    const oldTrack=stream.getVideoTracks()[0];
    if(peer){
      const sender=peer.getSenders().find(s=>s.track?.kind==='video');
      if(sender) await sender.replaceTrack(newTrack);
    }
    if(oldTrack) oldTrack.stop();
    try{stream.removeTrack(oldTrack)}catch(e){}
    stream.addTrack(newTrack);
    const preview=$('#cameraPreview');
    preview.srcObject=stream;
    preview.muted=true;
    preview.autoplay=true;
    preview.playsInline=true;
    try{await preview.play()}catch(e){}
    $('#callHint').textContent='Camera switched.';
  }catch(e){
    if(nextStream){try{nextStream.getTracks().forEach(t=>t.stop())}catch(x){}}
    $('#callHint').textContent='Camera switch is not available on this device/browser.';
  }
}
function stopStream(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null} if(remoteStream){remoteStream.getTracks().forEach(t=>t.stop());remoteStream=null}}
async function exitVideo(){
  if(endingMatch) return;
  endingMatch=true;
  if(matchedUserId) await sendHangup();
  // Do not delete the hangup signal here; the other phone may need the REST
  // fallback after realtime is unsubscribed.
  stopStream();
  await leaveMatchQueue();
  clearInterval(signalPoll);signalPoll=null;
  clearInterval(partnerWatchTimer);partnerWatchTimer=null;
  pendingIce=[];
  if(callChannel){try{await callChannel.unsubscribe()}catch(e){}callChannel=null}
  if(chatChannel){try{await chatChannel.unsubscribe()}catch(e){}chatChannel=null}
  if(peer){try{peer.ontrack=null;peer.onconnectionstatechange=null;peer.oniceconnectionstatechange=null;peer.close()}catch(e){}peer=null}
  if(remoteStream){try{remoteStream.getTracks().forEach(t=>t.stop())}catch(e){}remoteStream=null}
  $('#remoteVideoEl').srcObject=null;$('#cameraPreview').srcObject=null;
  $('#videoScreen').classList.add('hidden');
  matchedUserId=null;matchedProfile=null;currentMatchId=null;matchRowId=null;
  endingMatch=false;
}
async function logout(){
  await setProfileOnline(false);
  await stopOnlineCounter();
  if(userControlChannel){try{await userControlChannel.unsubscribe()}catch(e){} userControlChannel=null; controlReady=false;}
  // Log out locally first so a slow/blocked Wi-Fi connection cannot leave the UI stuck.
  session=null;
  try{localStorage.removeItem('sb-veqmnbradfxqkykwztmg-auth-token')}catch(e){}
  try{localStorage.removeItem('veyoraAuthSession')}catch(e){}
  if(sb){try{await Promise.race([sb.auth.signOut({scope:'local'}),new Promise(r=>setTimeout(r,1200))])}catch(e){}}
  // Keep saved profile/plan/Veyora ID so Page 2 stays skipped after the next login.
  closeAccount();
  exitVideo();
  show('authScreen');
  try{history.replaceState({veyoraScreen:'authScreen'},document.title,location.origin+location.pathname)}catch(e){}
}

function togglePanel(id){
 ['settingsPanel','chatPanel','safetyPanel'].forEach(x=>$('#'+x).classList.add('hidden'));
 $('#'+id).classList.remove('hidden');
}
function openSettingsDetail(title,html){
 $('#settingsMessage').textContent='';
 $('#settingsDetailTitle').textContent=title;
 $('#settingsDetailBody').innerHTML=html;
 $('#settingsDetail').classList.remove('hidden');
 $('#settingsList').classList.add('hidden');
 $('#settingsDetailBack').focus();
 const langButtons=document.querySelectorAll('[data-language]');
 langButtons.forEach(b=>b.onclick=()=>{langButtons.forEach(x=>x.classList.remove('active'));b.classList.add('active');applyVeyoraLanguage(b.dataset.language);});
 const savedLang=localStorage.getItem('veyoraLanguage');
 if(savedLang) langButtons.forEach(b=>b.classList.toggle('active',b.dataset.language===savedLang));
 document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(b=>b.onclick=()=>{
   document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(x=>x.classList.remove('active'));
   b.classList.add('active');
   localStorage.setItem('veyoraPendingReportReason',b.dataset.reportReason);
 });
 const logoutBtn=$('#confirmLogout');if(logoutBtn)logoutBtn.onclick=logout;
}
function closeSettingsDetail(){
 $('#settingsDetail').classList.add('hidden');
 $('#settingsList').classList.remove('hidden');
 $('#settingsMessage').textContent='';
}
function showSafetyMessage(text){
 $('#settingsMessage').textContent=text;
 togglePanel('settingsPanel');
}
function showReaction(reaction){
 const el=document.createElement('div');
 el.className='floatingReaction';
 el.textContent=reaction;
 el.style.position='absolute';el.style.left=(35+Math.random()*30)+'%';el.style.bottom='145px';el.style.zIndex='7';el.style.fontSize='38px';el.style.animation='floatReaction 1.4s ease-out forwards';
 $('#videoScreen').appendChild(el);
 setTimeout(()=>el.remove(),1400);
}
function toggleChatComposer(){
 const c=$('#chatComposer');
 c.classList.toggle('hidden');
 if(!c.classList.contains('hidden')){setTimeout(()=>$('#chatOverlayInput')?.focus(),0)}
}
function appendChatBubble(text,isYou){
 const bubble=document.createElement('div');
 bubble.className='chatOverlayBubble '+(isYou?'youMessage':'');
 const label=document.createElement('strong');
 if(isYou){
   label.textContent='You';
 }else{
   const g=String(matchedProfile?.gender||'').toLowerCase();
   label.textContent=g==='male'?'👦':g==='female'?'👩':'👤';
   label.setAttribute('aria-label',g==='male'?'Boy':g==='female'?'Girl':'User');
 }
 const body=document.createElement('span');
 body.textContent=' '+text;
 bubble.append(label,body);
 $('#chatOverlayMessages').appendChild(bubble);
 $('#chatOverlayMessages').scrollTop=$('#chatOverlayMessages').scrollHeight;
}
async function sendChatMessage(e){
 e.preventDefault();
 const input=$('#chatOverlayInput'), text=input.value.trim();
 if(!text || !matchedUserId || !currentMatchId || !session?.user?.id)return;
 const message_id=crypto.randomUUID?.() || String(Date.now())+'-'+Math.random();
 appendChatBubble(text,true);
 input.value='';
 $('#chatComposer').classList.add('hidden');
 const payload={type:'chat',match_id:currentMatchId,message_id,text};
 processedChatIds.add(message_id);
 // Realtime path
 try{
   if(chatChannel) await chatChannel.send({type:'broadcast',event:'message',payload:{...payload,to:matchedUserId,from:session.user.id}});
 }catch(e){console.warn('chat realtime send failed',e)}
 // REST fallback uses the existing video_signals table, so chat does not
 // depend on Realtime being available on a particular browser/network.
 try{
   await supabaseProfileRequest('POST','video_signals',{
     sender_id:session.user.id,receiver_id:matchedUserId,
     payload:{...payload,to:matchedUserId,from:session.user.id}
   });
 }catch(e){console.warn('chat REST fallback failed',e)}
}

function reportAndBlock(){
 $('#settingsPanel').classList.add('hidden');
 $('#safetyPanel').classList.remove('hidden');
 const chosen=localStorage.getItem('veyoraPendingReportReason');
 document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(b=>b.classList.toggle('active',b.dataset.reportReason===chosen));
}
function confirmReportAndBlock(){
 const reason=localStorage.getItem('veyoraPendingReportReason');
 if(!reason){
   document.querySelectorAll('#safetyPanel [data-report-reason]').forEach(b=>b.classList.remove('active'));
   const first=$('#safetyPanel [data-report-reason]');
   if(first){first.focus();}
   return;
 }
 const reportedId=matchedUserId;
 const reportMatchId=currentMatchId;
 if(!reportedId || !session?.user?.id){showSafetyMessage('No active person to report.');return;}
 (async()=>{
   try{
     if(sb?.rpc){
       const {error}=await sb.rpc('veyora_report_and_block',{p_reported_id:reportedId,p_reason:reason,p_match_id:reportMatchId});
       if(error) throw error;
     }else{
       const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/veyora_report_and_block',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+(session.access_token||SUPABASE_KEY),'Content-Type':'application/json'},body:JSON.stringify({p_reported_id:reportedId,p_reason:reason,p_match_id:reportMatchId})});
       if(!r.ok) throw new Error(await r.text());
     }
     localStorage.setItem('veyoraBlockedPartner','1');
     localStorage.setItem('veyoraLastReportReason',reason);
     localStorage.removeItem('veyoraPendingReportReason');
     $('#safetyPanel').classList.add('hidden');
     if(matchedUserId===reportedId){
       await sendHangup().catch(()=>{});
       await handleRemoteHangup('Report submitted. Finding a new person…');
     }
   }catch(e){
     console.error('Report & Block failed',e);
     showSafetyMessage('Could not submit the report. Please try again.');
   }
 })();
}


document.addEventListener('DOMContentLoaded',init);

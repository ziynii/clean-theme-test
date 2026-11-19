// ==UserScript==
// @name         Clean Cozy Integrated Tools
// @namespace    zeta-clean-cozy-integrated
// @version      66.0-integrated
// @description  Clean Cozy 테마 + 우측 도구 폴더 + 드래그 도구모음 + ZETAKIT 응답검토 퀵바 플로팅 어댑터 통합본
// @match        https://zeta-ai.io/*
// @match        https://*.zeta-ai.io/*
// @match        https://frame.pingpong.ai/*
// @all-frames   true
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){const keys=['gray','pink','yellow','blue','green','purple'];const last=window.__ccLastPalette;const list=keys.filter(x=>x!==last);const pick=list[Math.floor(Math.random()*list.length)];window.__ccLastPalette=pick;window.__ccNextPalette=pick;})();
(()=>{
'use strict';
const ID='zeta-clean-cozy-v41';
const VERSION=67;
const PALETTES={"gray":{"ko":"그레이","bg":"#F7F7F8","user":"#F1F1F3","accent":"#A7ABB1","strong":"#4B5057","soft":"#EEEFF1","hover":"#E3E5E8","stroke":"#E1E3E6","icon":"#737780","scroll":"#C8CBD0","alt":"#FAFAFB"},"pink":{"ko":"연핑크","bg":"#FCF8FA","user":"#F8EDF1","accent":"#D8B7C5","strong":"#8D6576","soft":"#F7EDF2","hover":"#F0E1E8","stroke":"#EEDFE5","icon":"#9B7B88","scroll":"#DFC9D2","alt":"#FFFBFC"},"yellow":{"ko":"연노랑","bg":"#FCFBF5","user":"#F9F4E3","accent":"#D8C89A","strong":"#8B7951","soft":"#F7F3E5","hover":"#F0EAD7","stroke":"#EBE5D1","icon":"#98855D","scroll":"#DDD4B6","alt":"#FFFEF9"},"blue":{"ko":"연파랑","bg":"#F7FAFD","user":"#ECF3FA","accent":"#B3CDE3","strong":"#587B9B","soft":"#EDF4FA","hover":"#E1EDF7","stroke":"#DDE9F2","icon":"#7895AE","scroll":"#C8D9E8","alt":"#FBFDFF"},"green":{"ko":"연두","bg":"#F8FBF7","user":"#EFF6EA","accent":"#BED3B2","strong":"#6B8961","soft":"#F0F7EC","hover":"#E4EFE0","stroke":"#DFEADD","icon":"#81997B","scroll":"#CDDCC7","alt":"#FBFDFB"},"purple":{"ko":"연보라","bg":"#FAF8FD","user":"#F2EDFA","accent":"#C9B9E1","strong":"#7E6A9C","soft":"#F3EEFA","hover":"#EAE2F5","stroke":"#E7E0EF","icon":"#9485AB","scroll":"#D7CBE5","alt":"#FDFBFF"}};
const chosen=window.__ccNextPalette;
try{delete window.__ccNextPalette;}catch(e){}
const chosenKey=PALETTES[chosen]?chosen:'gray';
const palette=PALETTES[chosenKey];
const accentRgb=[1,3,5].map(i=>parseInt(palette.accent.slice(i,i+2),16)).join(',');
const FRAME_CHAT=location.hostname==='frame.pingpong.ai';
// Parent and scene are separate documents. Keep the original parent styles,
// but never render chat-only floating controls in the outer room host.
const OUTER_ROOM=!FRAME_CHAT && /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?rooms\/[^/]+/.test(location.pathname);

// The outer Zeta page owns the stable /rooms/<id> route.
// The iframe's #run value is temporary and may change after reload.
let ccStableRoomKey='';
// Small settings payload mirrored between the outer Zeta page and scene iframe.
// It contains only UI preferences, never message text.
let ccSettingsSnapshot=null;
function outerStableRoomKey(){
 const match=location.pathname.match(/\/rooms\/([^/?#]+)/);
 return match?'/rooms/'+match[1]:location.pathname;
}

// Cross-origin coordination between our own two userscript instances only.
// No access to the other frame's DOM, Zeta data, or internal APIs.
let ccLastFrameReadyAt=0;
function announceFrameControls(force=false){
 if(!FRAME_CHAT||ccStableRoomKey)return;
 if(!document.body?.classList.contains('cc-frame-chat-root'))return;
 const button=document.getElementById('cc-toggle');
 if(!button||!button.isConnected)return;
 const now=Date.now();
 if(!force&&now-ccLastFrameReadyAt<700)return;
 ccLastFrameReadyAt=now;
 try{window.parent.postMessage({type:'clean-cozy-frame-controls-ready-v163',settings:ccSettingsSnapshot},'https://zeta-ai.io');}catch(e){}
}
function onCozyFrameReady(event){
 if(!OUTER_ROOM||event.origin!=='https://frame.pingpong.ai')return;
 const scene=document.querySelector('iframe[title="scene"][src^="https://frame.pingpong.ai/"]');
 if(!scene||event.source!==scene.contentWindow)return;
 const data=event.data;
 if(data?.type==='clean-cozy-frame-controls-ready-v163'){
  // The outer zeta-ai.io document is the source of truth for saved UI settings.
  // Do not let the iframe's startup/default snapshot overwrite persisted choices.
  const room=outerStableRoomKey();
  sendToCozyScene('room-key',room);
  sendToCozyScene('turn-store',{room,turns:roomTurnRows(room)});
  sendToCozyScene('settings',settings);
  document.documentElement.classList.add('cc-inner-controls-ready');
  return;
 }
 if(data?.type==='cc-private-ui-v164'&&data.command==='turn-sync'){
  mergeOuterTurnStore(data.payload);
  return;
 }
 if(data?.type==='cc-private-ui-v164'&&data.command==='settings-sync'&&data.payload&&typeof data.payload==='object'){
  absorbSettings(data.payload);
  persistSettingsLocal();
  return;
 }
}
if(OUTER_ROOM)window.addEventListener('message',onCozyFrameReady);
function sendToCozyScene(type, payload){
 if(!OUTER_ROOM)return false;
 const frame=document.querySelector('iframe[title="scene"][src^="https://frame.pingpong.ai/"]');
 if(!frame?.contentWindow)return false;
 try{frame.contentWindow.postMessage({type:'cc-private-ui-v164',command:type,payload},'https://frame.pingpong.ai');return true;}catch(e){return false;}
}
function sendToCozyOuter(type,payload){
 if(!FRAME_CHAT)return false;
 try{window.parent.postMessage({type:'cc-private-ui-v164',command:type,payload},'https://zeta-ai.io');return true;}catch(e){return false;}
}
function receiveCozyUIMessage(event){
 if(!FRAME_CHAT||event.origin!=='https://zeta-ai.io'||event.source!==window.parent)return;
 const data=event.data;
 if(!data||data.type!=='cc-private-ui-v164')return;
 if(data.command==='edit'){nativeEditButton()?.click();}
 else if(data.command==='line'){pressLineTool();}
 else if(data.command==='action'&&['snapshot','report','request','regen','suggest'].includes(data.payload)){
  availableNativeAction(data.payload)?.click();
 }else if(data.command==='room-key'&&typeof data.payload==='string'){
  const next=data.payload.trim();
  if(/^\/rooms\/[^/?#]+$/.test(next)){
   const changed=ccStableRoomKey!==next;
   const previous=turnRoomKey();
   ccStableRoomKey=next;
   if(changed&&previous&&previous!==next)migrateTurnRoomKey(previous,next);
   if(changed)resetTurnRoom();
   enhanceDates();
   syncTurnStoreToOuter();
  }
 }else if(data.command==='turn-store'&&data.payload&&typeof data.payload==='object'){
  receiveOuterTurnStore(data.payload);
 }else if(data.command==='settings'&&data.payload&&typeof data.payload==='object'){
  absorbSettings(data.payload);
  // Parent -> scene hydration: persist locally without echoing the same payload back.
  persistSettingsLocal();
  applyOpts();
 }
}
if(FRAME_CHAT)window.addEventListener('message',receiveCozyUIMessage);

// A parent fallback may show before iframe controls are ready. Do not leave
// a misleading, non-functional settings panel on the outer document.



// The outer Zeta page and the scene iframe have separate documents and origins.
// Mark only a visible chat subtree once Zeta has actually rendered chat elements.
function hideFrameCharacterZetaMarks(row){
 if(!FRAME_CHAT||!row||row.matches('[data-sentry-component="RightTextContent"]'))return;

 const normalize=v=>String(v||'').replace(/^['"]|['"]$/g,'').trim().toLowerCase();
 const blocked=el=>{
  if(!(el instanceof Element))return true;
  return !!el.closest(
   'button.shrink-0,.chat,.cc-meta,#cc-toggle,#cc-edit-shortcut,#cc-line-shortcut,#cc-panel,'+
   'button,a,input,textarea,select,[role="button"]'
  );
 };

 const bubble=row.querySelector('[data-sentry-component="ChatBubbleContainer"]')||
  [...row.querySelectorAll('div')].find(el=>
   el.classList.contains('w-fit')&&el.classList.contains('flex-col')&&
   (el.classList.contains('rounded-r-xl')||el.classList.contains('rounded-l-xl'))
  );

 const rowRect=row.getBoundingClientRect();
 const bubbleRect=bubble?.getBoundingClientRect?.()||null;

 for(const el of row.querySelectorAll('*')){
  // IMPORTANT: SVGElement is not HTMLElement on Safari.
  if(!(el instanceof Element)||blocked(el))continue;
  if(bubble&&bubble.contains(el))continue;

  const rect=el.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)continue;

  const text=normalize(el.textContent);
  const alt=normalize(el.getAttribute('alt'));
  const aria=normalize(el.getAttribute('aria-label'));
  const title=normalize(el.getAttribute('title'));
  const href=normalize(
   el.getAttribute('href')||
   el.getAttribute('xlink:href')||
   el.getAttribute('src')
  );
  const tag=el.tagName.toLowerCase();
  const tiny=rect.width<=120&&rect.height<=48;
  const svgTextTag=tag==='text'||tag==='tspan'||tag==='svg';

  let markup='';
  try{markup=normalize(el.outerHTML);}catch(e){}

  // Exact/explicit Zeta marks, including SVG <text>/<tspan>/<svg>.
  const explicitZeta=
   (text==='zeta'&&(el.children.length===0||svgTextTag)&&tiny)||
   alt==='zeta'||
   aria==='zeta'||
   title==='zeta'||
   aria.includes('zeta watermark')||
   title.includes('zeta watermark')||
   (tiny&&href.includes('zeta'))||
   (tiny&&svgTextTag&&markup.includes('zeta'));

  if(explicitZeta){
   el.classList.add('cc-zeta-mark-hidden');
   continue;
  }

  // Pseudo-element fallback.
  try{
   const before=normalize(getComputedStyle(el,'::before').content);
   const after=normalize(getComputedStyle(el,'::after').content);
   if(before==='zeta')el.classList.add('cc-zeta-before-hidden');
   if(after==='zeta')el.classList.add('cc-zeta-after-hidden');
  }catch(e){}

  // Final geometry fallback for the new iframe:
  // Character rows reserve ~72px at the right. Hide only a tiny, non-interactive
  // visual node living in that reserved gutter, never the message bubble itself.
  const centerX=rect.left+rect.width/2;
  const centerY=rect.top+rect.height/2;
  const inRowY=centerY>=rowRect.top-2&&centerY<=rowRect.bottom+2;
  const inRightGutter=centerX>=rowRect.right-84;
  const outsideBubble=!bubbleRect||
   rect.left>=bubbleRect.right-2||
   centerX>bubbleRect.right+4;

  if(
   tiny&&
   rect.width<=96&&rect.height<=36&&
   inRowY&&inRightGutter&&outsideBubble&&
   !el.querySelector('button,a,input,textarea,select,[role="button"]')
  ){
   el.classList.add('cc-zeta-mark-hidden');
  }
 }
}
function markFrameChatRoot(){
 if(!FRAME_CHAT)return;
 const log=document.querySelector('[role="log"][aria-label="Chat messages"]');
 if(!log)return;
 const root=document.body;
 if(!root.classList.contains('cc-frame-chat-root'))root.classList.add('cc-frame-chat-root');
 // Read only the rendered DOM. Do not access network, framework state, or APIs.
 const header=document.querySelector('header');
 if(header&&!header.hasAttribute('data-sentry-component'))header.setAttribute('data-sentry-component','Header');
 const composer=document.querySelector('[data-testid="composer-input-box"]');
 const composerDock=composer?.closest('[class*="bg-linear-to-b"]');
 if(composerDock&&!composerDock.hasAttribute('data-sentry-component'))composerDock.setAttribute('data-sentry-component','ChatComposer');
 // Old Zeta exposed named sentry wrappers. New Zeta renders left/right rows directly.
 for(const row of log.querySelectorAll('div.flex.flex-row.items-start')){
  const cls=row.classList;
  const isUser=cls.contains('ml-auto')&&cls.contains('pr-2');
  const isCharacter=cls.contains('pl-2')&&cls.contains('pr-[72px]');
  if(!isUser&&!isCharacter)continue;
  const bubble=[...row.querySelectorAll('div')].find(el=>
   el.classList.contains('w-fit')&&el.classList.contains('flex-col')&&
   (el.classList.contains('rounded-r-xl')||el.classList.contains('rounded-l-xl')));
  if(!bubble)continue;
  const role=isUser?'RightTextContent':'LeftTextContent';
  if(row.getAttribute('data-sentry-component')!==role)row.setAttribute('data-sentry-component',role);
  if(!bubble.hasAttribute('data-sentry-component'))bubble.setAttribute('data-sentry-component','ChatBubbleContainer');
  // Leave Zeta's own text tree alone. Map only a direct content wrapper if present.
  const textChild=[...bubble.children].find(el=>el.classList.contains('chat'));
  if(!textChild && bubble.children.length===1 && bubble.firstElementChild && !bubble.firstElementChild.classList.contains('cc-meta') && !bubble.firstElementChild.classList.contains('chat')) {
   const target=bubble.firstElementChild;
   // Only mark a markup container, never an interactive control.
   if(!/^(BUTTON|TEXTAREA|INPUT)$/.test(target.tagName))target.classList.add('chat');
  }
  if(isCharacter)hideFrameCharacterZetaMarks(row);
 }
}
// New scene markup does not expose the previous .caption1 name labels.
// Find a short label adjacent to the bubble without reading its message text.
function frameNameLabel(body){
 if(!FRAME_CHAT)return null;
 const stack=body.querySelector(':scope > .flex.min-w-0.flex-col.gap-1')||
  [...body.children].find(el=>el.classList?.contains('flex-col')&&el.classList?.contains('gap-1'));
 if(!stack)return null;
 for(const child of stack.children){
  if(child.querySelector('[data-sentry-component="ChatBubbleContainer"]'))continue;
  if(child.classList.contains('relative'))continue;
  const candidates=[child,...child.querySelectorAll('span,div')];
  for(const node of candidates){
   if(node.querySelector('button,textarea,img,[role="log"]'))continue;
   const value=(node.textContent||'').trim();
   if(!value||value.length>28||value.includes('\n'))continue;
   if(/^(오후|오전|\d{1,2}:\d{2}|today|\d+ day)/i.test(value))continue;
   return node;
  }
 }
 return null;
}
function frameName(body){
 const label=frameNameLabel(body);
 if(label)return label.textContent.trim();
 const image=body.querySelector(':scope > button img[alt]');
 const avatar=image?.getAttribute('alt')?.trim();
 if(avatar&&avatar.length<30)return avatar;
 if(body.matches('[data-sentry-component="RightTextContent"]'))return '유저';
 return document.querySelector('[data-testid="chat-header-profile"]')?.textContent?.trim().slice(0,28)||'캐릭터';
}
let frameNativeEditButton=null;
function nativeEditButton(){
 if(FRAME_CHAT && frameNativeEditButton?.isConnected && !frameNativeEditButton.disabled)return frameNativeEditButton;
 const options=[
  '[data-sentry-component="LastMessageControlBar"] button[aria-label="Edit message"]',
  'button[data-testid="edit-button"]',
  'button[aria-label="Edit message"]',
  'button[aria-label="메시지 수정"]',
  'button[title="Edit message"]',
  'button[title="메시지 수정"]'
 ];
 for(const selector of options){
  const candidates=[...document.querySelectorAll(selector)].filter(x=>x.id!=='cc-edit-shortcut'&&x.id!=='cc-line-shortcut');
  const found=candidates.find(el=>!el.disabled);
  if(found)return found;
 }
 if(FRAME_CHAT){markFrameNativeTools();if(frameNativeEditButton?.isConnected&&!frameNativeEditButton.disabled)return frameNativeEditButton;}
 return null;
}
const KEY='__zetaCleanCozy';
const STORE='zeta-clean-cozy-options-v1';
if(!/(^|\.)(?:zeta-ai\.io|pingpong\.ai)$/.test(location.hostname)) return;
if(window[KEY]?.stop){
 const previous=window[KEY];
 previous.stop();
 /* Replace previous instance, including another color of this version. */
}
document.getElementById(ID)?.remove();
const defaults={avatarMode:'both',dialogueHighlight:false,removeNarration:false,lineBreakMode:'short'};
let settings={...defaults};
try{
 const saved=JSON.parse(localStorage.getItem(STORE)||'{}');
 const allowed=['both','none','userHidden','userHiddenHeart'];
 settings.avatarMode=allowed.includes(saved.avatarMode)?saved.avatarMode:(saved.avatar===false?'none':'both');
 settings.removeNarration=saved.removeNarration===true;
 // Restore the user's last explicit choice. First-time default remains OFF.
 settings.dialogueHighlight=saved.dialogueHighlight===true;
 settings.lineBreakMode=['short','long'].includes(saved.lineBreakMode)?saved.lineBreakMode:'short';
}catch(e){}
function absorbSettings(p){
 if(!p||typeof p!=='object')return;
 if(['both','none','userHidden','userHiddenHeart'].includes(p.avatarMode))settings.avatarMode=p.avatarMode;
 if(typeof p.dialogueHighlight==='boolean')settings.dialogueHighlight=p.dialogueHighlight;
 if(typeof p.removeNarration==='boolean')settings.removeNarration=p.removeNarration;
 if(['short','long'].includes(p.lineBreakMode))settings.lineBreakMode=p.lineBreakMode;
 ccSettingsSnapshot={
  avatarMode:settings.avatarMode,
  dialogueHighlight:settings.dialogueHighlight===true,
  removeNarration:settings.removeNarration===true,
  lineBreakMode:settings.lineBreakMode
 };
}
function persistSettingsLocal(){
 ccSettingsSnapshot={
  avatarMode:settings.avatarMode,
  dialogueHighlight:settings.dialogueHighlight===true,
  removeNarration:settings.removeNarration===true,
  lineBreakMode:settings.lineBreakMode
 };
 try{localStorage.setItem(STORE,JSON.stringify(ccSettingsSnapshot));}catch(e){}
}
absorbSettings(settings);
const style=document.createElement('style');
style.id=ID;
style.textContent=`
:root{--cc-accent:${palette.accent};--cc-accent-strong:${palette.strong};--cc-accent-soft:${palette.soft};--cc-accent-hover:${palette.hover};--cc-bg:${palette.bg};--cc-panel:#FFFFFF;--cc-user:${palette.user};--cc-text:#292B30;--cc-muted:#72767E;--cc-stroke:${palette.stroke};--cc-icon:${palette.icon};--cc-scroll:${palette.scroll};--cc-panel-alt:${palette.alt}}
html,body,#__next,main#contents{background:var(--cc-bg)!important;color:var(--cc-text)!important}
header[data-sentry-component="Header"]{background:rgba(255,255,255,.94)!important;background-image:none!important;border-bottom:1px solid var(--cc-stroke)!important;box-shadow:none!important}
header[data-sentry-component="Header"] :is(span,svg){color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
header[data-sentry-component="Header"] [data-testid="chat-header-model"]{background:#F4F4F4!important;border:1px solid var(--cc-stroke)!important}
header[data-sentry-component="Header"] [data-testid="chat-header-model"] svg{color:#6D7276!important}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root),
[role="log"][aria-label="Chat messages"]{background:#FFFFFF!important;background-image:none!important}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)>div:first-child,
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)>div[aria-hidden="true"]{background:rgba(255,255,255,.94)!important;background-image:none!important}
[data-sentry-component="LeftTextContent"], [data-sentry-component="RightTextContent"],
[data-sentry-component="LeftTextContent"]>div,[data-sentry-component="RightTextContent"]>div{background:transparent!important;background-image:none!important}
[data-sentry-component="LeftTextContent"] .caption1,[data-sentry-component="RightTextContent"] .caption1{color:var(--cc-muted)!important}
[data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"],
[data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 border:1px solid var(--cc-stroke)!important;border-radius:18px!important;
 background:#FFFFFF!important;color:var(--cc-text)!important;
 box-shadow:none!important;position:relative!important;overflow:visible!important;
 max-width:min(612px,100%)!important;padding:12px 14px!important;
}
/* 캐릭터 메시지는 테두리 없이 */
[data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 border:0!important;
}
/* 유저 메시지는 원래보다 조금 더 각지게 */
[data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 background:var(--cc-user)!important;border-color:#F0F0EF!important;
 border-radius:10px!important;
}
/* 채팅방 상단: 이름을 정확히 중앙에, 모델 선택 버튼 숨김 */
body:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)) header[data-sentry-component="Header"] nav{
 position:relative!important;
}
body:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)) header[data-sentry-component="Header"] [data-testid="chat-header-model"]{
 display:none!important;
}
body:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)) header[data-sentry-component="Header"] [data-testid="chat-header-profile"]{
 position:absolute!important;
 left:50%!important;
 top:50%!important;
 transform:translate(-50%,-50%)!important;
 flex:none!important;
 width:max-content!important;
 max-width:calc(100% - 160px)!important;
 min-width:0!important;
 justify-content:center!important;
 text-align:center!important;
 z-index:1!important;
}
body:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)) header[data-sentry-component="Header"] [data-testid="chat-header-profile"] span{
 text-align:center!important;
}
body:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)) header[data-sentry-component="Header"] nav > div:last-child{
 margin-left:auto!important;
 z-index:2!important;
}

[data-sentry-component="ChatBubbleContainer"]::before,
[data-sentry-component="ChatBubbleContainer"]::after{content:none!important;display:none!important}
[data-sentry-component="ChatBubbleContainer"] .chat,
[data-sentry-component="ChatBubbleContainer"] .chat p,
[data-sentry-component="ChatBubbleContainer"] .chat :not(em):not(i){color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
[data-sentry-component="ChatBubbleContainer"] .chat :is(em,i){color:#96999D!important;-webkit-text-fill-color:#96999D!important;font-style:italic!important;opacity:1!important}
[data-sentry-component="ChatBubbleContainer"] blockquote>div.w-1{background:#B8BBC0!important}
.cc-meta{display:flex;align-items:baseline;gap:7px;min-width:0;margin:0 0 7px 0;line-height:1.35;user-select:none}
.cc-meta-name{font-size:12px;font-weight:650;color:#282B2F;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
.cc-meta-time{font-size:11px;color:#999CA0;white-space:nowrap}
.cc-name-hidden{display:none!important}
.cc-avatar-hidden [data-sentry-component="LeftTextContent"]>button.shrink-0,
.cc-avatar-hidden [data-sentry-component="RightTextContent"]>button.shrink-0{display:none!important}
.cc-avatar-hidden [data-sentry-component="LeftTextContent"]{padding-right:14px!important;padding-left:14px!important}
.cc-avatar-hidden [data-sentry-component="RightTextContent"]{padding-left:14px!important;padding-right:14px!important}
.cc-avatar-hidden [data-sentry-component="RightTextContent"]>div{margin-left:auto!important}
[data-sentry-component="NarratorBubble"] .message-context-menu-trigger,
.message-context-menu-trigger:has(svg[data-sentry-source-file="NarratorBubble.tsx"]){background:#F8F8F8!important;border:1px solid var(--cc-stroke)!important;border-radius:14px!important;box-shadow:none!important}
[data-sentry-component="NarratorBubble"] .chat,
[data-sentry-component="NarratorBubble"] .chat *,
.message-context-menu-trigger:has(svg[data-sentry-source-file="NarratorBubble.tsx"]) .chat *{color:#868A8E!important;-webkit-text-fill-color:#868A8E!important}
[data-sentry-component="NarratorBubble"] svg[data-sentry-source-file="NarratorBubble.tsx"]{color:#90959A!important}
[data-testid="chat-bottom-dock"],[data-sentry-component="ChatComposer"],
[data-sentry-component="ChatComposer"]>div{background:transparent!important;background-image:none!important;box-shadow:none!important;--tw-gradient-from:transparent!important;--tw-gradient-to:transparent!important}
[data-testid="composer-input-box"]{background:#FFFFFF!important;background-image:none!important;border:1px solid #DEDFE0!important;border-radius:20px!important;box-shadow:0 2px 10px rgba(0,0,0,.045)!important}
[data-testid="composer-input-box"] textarea[name="message"]{background:transparent!important;color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
[data-testid="composer-input-box"] textarea[name="message"]::placeholder{color:#9A9DA0!important;-webkit-text-fill-color:#9A9DA0!important}
[data-testid="chat-send-button"]{background:#292B2D!important;color:#FFFFFF!important}
[data-testid="chat-send-button"] svg{color:#FFFFFF!important}
[data-sentry-component="QuickReplyPanel"],[data-sentry-component="QuickReplyRegenControlBar"]{background:#FAFAFA!important;border-color:var(--cc-stroke)!important;background-image:none!important}
[data-sentry-component="QuickReplySetSlide"]>button{background:#FFFFFF!important;border:1px solid var(--cc-stroke)!important;border-radius:15px!important;box-shadow:none!important}
[data-sentry-component="QuickReplySetSlide"] .chat,
[data-sentry-component="QuickReplySetSlide"] .chat p{color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
[data-sentry-component="QuickReplySetSlide"] .chat :is(em,i){color:#93979B!important;-webkit-text-fill-color:#93979B!important}
[data-sentry-component="LastMessageControlBar"] button[aria-label],
[data-sentry-component="SnapshotButton"]>button{background:rgba(255,255,255,.92)!important;border:1px solid var(--cc-stroke)!important;color:#676A6E!important;box-shadow:none!important}
[data-sentry-component="LastMessageControlBar"] button[aria-label] :is(svg,span),
[data-sentry-component="SnapshotButton"]>button :is(svg,span){color:#676A6E!important;-webkit-text-fill-color:#676A6E!important}
[data-sentry-component="SnapshotButton"]>button,
[data-sentry-component="SnapshotButton"]>button span{white-space:nowrap!important}
[data-sentry-component="InfoBoxContent"],[data-sentry-component="InfoBoxExpandedContent"],
[data-sentry-component="InfoBoxCharacterSection"]{background:#FFFFFF!important;background-image:none!important;color:var(--cc-text)!important;border-color:var(--cc-stroke)!important}
[data-sentry-component="InfoBoxContent"] .chat,[data-sentry-component="InfoBoxExpandedContent"] .chat{color:var(--cc-text)!important}
body:has([data-sentry-component="MyPlotChatProfileEdit"]) [data-sentry-component="MyPlotChatProfileEdit"]{background:#FAFAFA!important;color:var(--cc-text)!important}
[data-sentry-component="MyPlotChatProfileEdit"] :is(input[name="name"],textarea[name="description"]){background:#FFFFFF!important;color:var(--cc-text)!important;border:1px solid var(--cc-stroke)!important;border-radius:12px!important}
[data-sentry-component="RoomList"]{color:var(--cc-text)!important}
a[testid^="room-list-item-"] span.line-clamp-1,
a[href^="/ko/rooms/"] span.line-clamp-1{color:#75797E!important;-webkit-text-fill-color:#75797E!important;opacity:1!important}
a[testid^="room-list-item-"] span.body1{color:#25272A!important;-webkit-text-fill-color:#25272A!important}
[data-sentry-component="ScrappedPlotsPreview"] a.caption1,
[data-sentry-component="ScrappedPlotsPreview"] a span.caption1{color:#74787C!important;-webkit-text-fill-color:#74787C!important}
[data-sentry-source-file="Select.tsx"].body2,[data-sentry-source-file="Select.tsx"].text-gray-200{color:#5B6065!important;-webkit-text-fill-color:#5B6065!important}
#cc-toggle{position:fixed;z-index:2147483000;bottom:102px;left:12px;width:33px;height:33px;display:flex;align-items:center;justify-content:center;background:#FFFFFF;color:#45484C;border:1px solid #DDDFE0;border-radius:50%;font:18px/1 sans-serif;box-shadow:0 2px 8px #00000015;cursor:pointer}
#cc-panel{position:fixed;z-index:2147483001;bottom:143px;left:12px;width:210px;padding:13px;border:1px solid #E4E5E6;border-radius:14px;background:#FFFFFF;color:#292B2D;box-shadow:0 8px 25px #0000001A;font:13px/1.5 sans-serif}
#cc-panel[hidden]{display:none!important}
#cc-panel .cc-heading{font-size:13px;font-weight:700;margin-bottom:9px}
#cc-panel label{display:flex;gap:9px;align-items:center;margin:8px 0;cursor:pointer}
#cc-panel input{accent-color:#484C51}

/* Reference-inspired narrow, centered message column on larger screens */
[role="log"][aria-label="Chat messages"] [data-sentry-component="BodyView"],
[role="log"][aria-label="Chat messages"] [data-sentry-component="NarratorBubble"],
[role="log"][aria-label="Chat messages"] [data-sentry-component="LastMessageControlBar"]{
  width:100%!important;
  max-width:610px!important;
  margin-left:auto!important;
  margin-right:auto!important;
  box-sizing:border-box!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="ChatBubbleContainer"]{
  max-width:100%!important;
}
/* Assistant-side text should read like a clean chat transcript, not a full-width colored card */
[data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"]{
  background:transparent!important;
  border:none!important;
  border-radius:0!important;
  box-shadow:none!important;
  padding:8px 10px 10px!important;
}
[data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
  max-width:min(100%,430px)!important;
  border:none!important;
  border-radius:10px!important;
  padding:11px 13px!important;
  background:#F5F5F5!important;
}
/* Name and body typography follow the supplied minimal chat reference */
.cc-meta{gap:5px!important;margin-bottom:5px!important;align-items:baseline!important;}
.cc-meta-name{font-family:inherit!important;font-size:13px!important;font-weight:600!important;letter-spacing:-.015em!important;line-height:1.4!important;}
.cc-meta-time{font-family:inherit!important;font-size:11px!important;font-weight:400!important;line-height:1.4!important;}
[data-sentry-component="ChatBubbleContainer"] .chat,
[data-sentry-component="ChatBubbleContainer"] .chat p{
  font-family:inherit!important;font-size:13.5px!important;
  font-weight:400!important;line-height:1.55!important;
  letter-spacing:-.01em!important;
}
[data-sentry-component="ChatBubbleContainer"] .chat :is(em,i){
  font-size:inherit!important;font-weight:400!important;
}
/* Don't give the content column desktop-sized margins on mobile. */
@media(max-width:640px){
  [role="log"][aria-label="Chat messages"] [data-sentry-component="BodyView"],
  [role="log"][aria-label="Chat messages"] [data-sentry-component="NarratorBubble"]{
    max-width:100%!important;
  }
  [data-sentry-component="ChatBubbleContainer"] .chat,
  [data-sentry-component="ChatBubbleContainer"] .chat p{font-size:14px!important;}
}
/* Hide native shortcuts only while the theme's settings menu can forward clicks */
/* ZETAKIT compatibility: keep the native action bar alive in rendered DOM.
   Move it out of normal layout instead of display:none so third-party DOM tools
   can still discover the original Edit/Report/Regenerate buttons. */
html.cc-tools-ready [data-sentry-component="LastMessageControlBar"]{
  position:fixed!important;
  left:8px!important;
  bottom:8px!important;
  right:auto!important;
  top:auto!important;
  opacity:0!important;
  pointer-events:none!important;
  user-select:none!important;
  z-index:-1!important;
}
html.cc-tools-ready [data-sentry-component="QuickReplyButton"]{display:none!important;}
#cc-panel{width:255px!important;max-width:calc(100vw - 24px)!important;max-height:min(68vh,470px)!important;overflow:auto!important;}
#cc-panel .cc-section-title{font-size:11px;font-weight:600;color:#8D9196;letter-spacing:.02em;margin:12px 0 6px;}
#cc-panel .cc-action-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
#cc-panel .cc-action{width:100%;min-width:0;min-height:36px;padding:7px 8px;border:1px solid #ECEDEE;border-radius:9px;
  background:#FAFAFA;color:#33363A;font:12px/1.25 sans-serif;text-align:center;cursor:pointer;}
#cc-panel .cc-action:disabled{color:#B4B6B9;cursor:not-allowed;opacity:.65;}
#cc-panel .cc-action:not(:disabled):active{background:#EDEEEF;}
#cc-panel .cc-action.cc-capture-active{
 background:var(--cc-user)!important;
 border-color:var(--cc-accent)!important;
 color:var(--cc-accent-strong)!important;
 font-weight:600!important;
}

#cc-panel .cc-help{color:#898C90;font-size:11px;line-height:1.4;margin-top:10px}
#cc-toggle{left:auto!important;right:12px;bottom:128px;}
#cc-panel{left:auto!important;right:12px;bottom:171px;}

/* V5: calm narrow dialogue columns (not full-bleed messages) */
[role="log"][aria-label="Chat messages"] [data-sentry-component="LeftTextContent"],
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"]{
  width:100%!important;max-width:610px!important;
  margin-left:auto!important;margin-right:auto!important;
  box-sizing:border-box!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="LeftTextContent"]{
  padding-right:14px!important;padding-left:14px!important;
  justify-content:flex-start!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"]{
  padding-right:14px!important;padding-left:14px!important;
  justify-content:flex-end!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="LeftTextContent"] > div,
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"] > div{
  flex:0 1 auto!important;min-width:0!important;width:fit-content!important;
  max-width:min(82%,450px)!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"] > div{
  max-width:min(76%,400px)!important;margin-left:auto!important;
}
/* Prevent flex grandchildren from stretching the bubble all the way across. */
[role="log"][aria-label="Chat messages"] [data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"],
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
  width:fit-content!important;max-width:100%!important;
  min-width:0!important;box-sizing:border-box!important;
  overflow-wrap:anywhere!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"]{
  padding:6px 4px 8px!important;background:transparent!important;border:0!important;
}
[role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
  padding:11px 13px!important;background:#F3F3F3!important;border:0!important;border-radius:12px!important;
}
/* Keep author name at the same size as the body, with subtle emphasis. */
.cc-meta-name{
  font-size:14px!important;font-weight:600!important;line-height:1.5!important;
  letter-spacing:-.01em!important;
}
.cc-meta{margin-bottom:5px!important;}
/* Visually gentle scrollbar without changing the scroll behavior */
[role="log"][aria-label="Chat messages"],
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [class*="overflow-y-auto"]{
  scrollbar-width:thin!important;
  scrollbar-color:rgba(140,145,150,.25) transparent!important;
}
[role="log"][aria-label="Chat messages"]::-webkit-scrollbar,
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [class*="overflow-y-auto"]::-webkit-scrollbar{width:4px!important;}
[role="log"][aria-label="Chat messages"]::-webkit-scrollbar-track,
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [class*="overflow-y-auto"]::-webkit-scrollbar-track{background:transparent!important;}
[role="log"][aria-label="Chat messages"]::-webkit-scrollbar-thumb,
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [class*="overflow-y-auto"]::-webkit-scrollbar-thumb{
 background:rgba(145,149,153,.26)!important;border-radius:8px!important;
}
/* Settings button stays in one place, regardless of whether jump-to-latest is shown */
#cc-toggle{position:fixed!important;left:auto!important;right:12px!important;bottom:153px!important;}
#cc-panel{position:fixed!important;left:auto!important;right:12px!important;bottom:197px!important;}
/* Sidebar Chat menu: light surface and correct text/icon contrast */
[role="dialog"][aria-label="Chat menu"]{
  background:#FFFFFF!important;background-image:none!important;
  color:#292C30!important;border-left:1px solid #E6E7E8!important;
  box-shadow:-7px 0 24px rgba(0,0,0,.08)!important;
}
[role="dialog"][aria-label="Chat menu"] > div,
[role="dialog"][aria-label="Chat menu"] .bg-gray-sub2{
  background:#FFFFFF!important;background-image:none!important;
}
[role="dialog"][aria-label="Chat menu"] [data-sentry-component="SidebarPieceBalance"]{
  background:#F5F5F5!important;border:1px solid #E8E9EA!important;
}
[role="dialog"][aria-label="Chat menu"] :is(.text-gray-200,.text-white,[class~="text-white/50"]),
[role="dialog"][aria-label="Chat menu"] button:not(.bg-primary-400):not(.bg-error-light) :is(span,div){
  color:#34383C!important;-webkit-text-fill-color:#34383C!important;
}
/* Literal slash classes require escaped CSS, and were present in the supplied markup. */
[role="dialog"][aria-label="Chat menu"] [class~="text-white/50"],
[role="dialog"][aria-label="Chat menu"] :is(svg[class~="text-white/50"],svg.text-white){
  color:#82878C!important;-webkit-text-fill-color:#82878C!important;
}
[role="dialog"][aria-label="Chat menu"] :is(svg.text-white,svg.text-gray-200){color:#52575B!important;}
[role="dialog"][aria-label="Chat menu"] [data-sentry-component="SnapshotArchiveSection"] button,
[role="dialog"][aria-label="Chat menu"] button{border-color:#E5E6E8!important;}
[role="dialog"][aria-label="Chat menu"] :is([class~="border-t-white/5"],[class~="border-l-white/[8%]"]){
 border-color:#E9EAEC!important;
}
[role="dialog"][aria-label="Chat menu"] [data-sentry-component="SidebarPieceBalance"] button,
[role="dialog"][aria-label="Chat menu"] button.bg-primary-400{
 background:#292C30!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[role="dialog"][aria-label="Chat menu"] [data-sentry-component="SidebarPieceBalance"] button :is(span,svg),
[role="dialog"][aria-label="Chat menu"] button.bg-primary-400 :is(span,svg){
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[role="dialog"][aria-label="Chat menu"] [class~="bg-white/5"],
[role="dialog"][aria-label="Chat menu"] [class~="bg-white/10"]{background:#F6F6F6!important;}
[role="dialog"][aria-label="Chat menu"] button:hover{background-color:#F4F4F4!important;}
[role="dialog"][aria-label="Chat menu"] button.bg-primary-400:hover{background:#42464A!important;}


/* === V6: Profile editor / quick replies / profile chooser light surfaces === */
/* Profile edit view */
body:has([data-sentry-component="MyPlotChatProfileEdit"])
 [data-sentry-component="KeyboardStickyScrollContainer"],
[data-sentry-component="MyPlotChatProfileEdit"],
[data-sentry-component="MyPlotChatProfileEdit"] form{
 background:#FAFAFA!important;
 background-image:none!important;
 color:#25272A!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] :is(h3,.heading3,.body16,.title18),
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-source-file="ChatProfilePreview.tsx"] span{
 color:#292B2E!important;-webkit-text-fill-color:#292B2E!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-component="EditFormSectionContainer"] span[class~="text-white/50"]{
 color:#757A80!important;-webkit-text-fill-color:#757A80!important;
 opacity:1!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-component="InputField"] label[for],
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-element="Label"][data-sentry-component="Input"]{
 background:#FFFFFF!important;
 border:1px solid #DCDEE1!important;border-radius:12px!important;
 color:#25272A!important;-webkit-text-fill-color:#25272A!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] input[name="name"],
[data-sentry-component="MyPlotChatProfileEdit"] textarea[name="description"]{
 background:#FFFFFF!important;color:#25272A!important;
 -webkit-text-fill-color:#25272A!important;
 border:1px solid #DCDEE1!important;border-radius:12px!important;
 caret-color:#34383E!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] input[name="name"]{
 background:transparent!important;border:0!important;box-shadow:none!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] :is(input[name="name"],textarea[name="description"])::placeholder{
 color:#898D93!important;-webkit-text-fill-color:#898D93!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-source-file="TextareaField.tsx"] span[class*="text-primary-"]{
 color:#666C73!important;-webkit-text-fill-color:#666C73!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-source-file="ChatProfilePreview.tsx"] .bg-primary-400{
 background:#44484E!important;
}
[data-sentry-component="MyPlotChatProfileEdit"] [data-sentry-source-file="ChatProfilePreview.tsx"] .bg-primary-400 svg{
 color:#FFFFFF!important;
}

/* Suggestion panel, slide/cards and footer */
[data-testid="bottom-panel-slot"],
[data-sentry-component="QuickReplyPanel"],
[data-sentry-component="QuickReplyPanel"] [data-sentry-component="InlineTooltip"]{
 background:#FAFAFA!important;background-image:none!important;
 color:#292C30!important;
}
[data-sentry-component="QuickReplySetSlide"] > button,
[data-sentry-component="QuickReplySetSlide"] > div[aria-label="Loading suggestions"]{
 background:#FFFFFF!important;
 background-image:none!important;
 border:1px solid #E1E3E5!important;
 border-radius:14px!important;box-shadow:0 2px 7px rgba(0,0,0,.035)!important;
}
[data-sentry-component="QuickReplySetSlide"] > button > div,
[data-sentry-component="QuickReplySetSlide"] > button p,
[data-sentry-component="QuickReplySetSlide"] > button .body14{
 color:#292C30!important;-webkit-text-fill-color:#292C30!important;
}
[data-sentry-component="QuickReplySetSlide"] > button :is(em,i){
 color:#7D8288!important;-webkit-text-fill-color:#7D8288!important;
 opacity:1!important;
}
[data-sentry-component="QuickReplySetSlide"] [aria-label="Loading suggestions"] svg{
 color:#73777C!important;
}
[data-sentry-component="QuickReplyRegenControlBar"]{
 background:#FAFAFA!important;border-top:1px solid #E6E7E9!important;
}
[data-sentry-component="QuickReplyQuota"] :is(span,svg),
[data-sentry-component="QuickReplyQuota"] [class~="text-white/50"],
[data-sentry-component="QuickReplyQuota"] [data-sentry-component="renderWhite"]{
 color:#5A5F65!important;-webkit-text-fill-color:#5A5F65!important;opacity:1!important;
}
[data-sentry-component="QuickReplyRegenControlBar"] button[aria-label="See other suggestions"]{
 background:#FFFFFF!important;border:1px solid #DDE0E2!important;
}
[data-sentry-component="QuickReplyRegenControlBar"] button[aria-label="See other suggestions"] svg{
 color:#4D5157!important;
}

/* Profile selector bottom sheet: target the actual dialog and its containing sheet */
[data-sentry-component="KeyboardAvoidingView"]:has([role="dialog"][aria-label="대화 프로필"])
 > [data-sentry-element="AnimatedDiv"],
[data-sentry-component="KeyboardAvoidingView"] [role="dialog"][aria-label="대화 프로필"]{
 background:#FCFCFC!important;background-image:none!important;
 color:#272A2E!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ProfileHubHeader"] h3,
[role="dialog"][aria-label="대화 프로필"] h3[class~="text-white/50"]{
 color:#686D73!important;-webkit-text-fill-color:#686D73!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"],
[role="dialog"][aria-label="대화 프로필"] button:has(>div >svg[data-sentry-source-file="ProfileHubBottomSheet.tsx"]),
[role="dialog"][aria-label="대화 프로필"] >div >div >button[class~="bg-white/5"]{
 background:#F4F4F4!important;border-color:#E8E8E8!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] .body1,
[role="dialog"][aria-label="대화 프로필"] :is(.body14,.text-gray-200){
 color:#2B2E32!important;-webkit-text-fill-color:#2B2E32!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] .caption1,
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] [class~="text-white/50"]{
 color:#777C83!important;-webkit-text-fill-color:#777C83!important;opacity:1!important;
}
[role="dialog"][aria-label="대화 프로필"] button[aria-label^="edit-"] svg,
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ProfileHubBottomSheet.tsx"] svg{
 color:#62676D!important;
}
[role="dialog"][aria-label="대화 프로필"] [class~="bg-white/5"],
[role="dialog"][aria-label="대화 프로필"] [class~="bg-white/[8%]"]{
 background-color:#F3F3F3!important;
}
[role="dialog"][aria-label="대화 프로필"] [class~="bg-white/5"] > div[class~="h-px"]{
 background:#E1E2E3!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] button:active{
 background:#EBEDEF!important;
}
/* Keep white check mark visible over its dark circular indicator */
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] .bg-primary-400{
 background:#44484E!important;
}
[role="dialog"][aria-label="대화 프로필"] [data-sentry-component="ChatProfileListItem"] .bg-primary-400 svg{
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
/* Drag handle for profile selector */
[data-sentry-component="KeyboardAvoidingView"]:has([role="dialog"][aria-label="대화 프로필"])
 svg.text-gray-700{color:#A0A4A9!important;}



/* V7 - Room list & navigation light-mode finishing pass */
[data-sentry-component="RoomList"]{
 background:#FAFAF9!important;
 color:#27292D!important;
}
[data-sentry-component="RoomList"] [data-sentry-component="FlatList"]{
 background:#FAFAF9!important;
 scrollbar-width:thin!important;
 scrollbar-color:#CDD1D3 transparent!important;
}
[data-sentry-component="RoomList"] [data-sentry-component="FlatList"]::-webkit-scrollbar,
[data-sentry-component="RoomList"] [data-sentry-component="ScrappedPlotsPreview"] [data-sentry-component="WrappedDiv"]::-webkit-scrollbar{
 width:4px!important;
 height:4px!important;
}
[data-sentry-component="RoomList"] [data-sentry-component="FlatList"]::-webkit-scrollbar-track,
[data-sentry-component="RoomList"] [data-sentry-component="ScrappedPlotsPreview"] [data-sentry-component="WrappedDiv"]::-webkit-scrollbar-track{
 background:transparent!important;
}
[data-sentry-component="RoomList"] [data-sentry-component="FlatList"]::-webkit-scrollbar-thumb,
[data-sentry-component="RoomList"] [data-sentry-component="ScrappedPlotsPreview"] [data-sentry-component="WrappedDiv"]::-webkit-scrollbar-thumb{
 background:#CDD1D3!important;border-radius:20px!important;
}
[data-sentry-component="RoomList"] [data-sentry-component="ScrappedPlotsPreview"] [data-sentry-component="WrappedDiv"]{
 scrollbar-width:thin!important;scrollbar-color:#CDD1D3 transparent!important;
}
[data-sentry-component="ScrappedPlotsPreview"]{
 border-bottom:1px solid #E9EAEB!important;
}
[data-sentry-component="ScrappedPlotsPreview"] h3,
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] span.body1{
 color:#25282C!important;-webkit-text-fill-color:#25282C!important;
}
[data-sentry-component="ScrappedPlotsPreview"] a[href*="scrapped-plots"],
[data-sentry-component="ScrappedPlotsPreview"] a[href*="scrapped-plots"] svg,
[data-sentry-source-file="ScrappedPlotsPreviewItem.tsx"] span{
 color:#62676D!important;-webkit-text-fill-color:#62676D!important;
}
[data-sentry-component="RoomList"] [data-sentry-source-file="Select.tsx"],
[data-sentry-component="RoomList"] [data-sentry-source-file="Select.tsx"] svg{
 color:#5A6066!important;-webkit-text-fill-color:#5A6066!important;
}
/* Exact room-preview markup uses testid (not data-testid), and a direct span. */
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] span.line-clamp-1,
a[testid^="room-list-item-"] span.line-clamp-1.body2,
a[href^="/ko/rooms/"] span.line-clamp-1.text-white\/50{
 color:#747A80!important;
 -webkit-text-fill-color:#747A80!important;
 opacity:1!important;
}
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] svg.text-gray-600{
 color:#8B9197!important;
}
/* Bottom nav: white surface, readable inactive + dark active icon/label. */
[data-sentry-component="NavigationBar"]{
 background:#FFFFFF!important;background-image:none!important;
 border-top:1px solid #E6E8EA!important;
 box-shadow:0 -2px 10px rgba(20,24,28,.025)!important;
}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"]{
 color:#888E95!important;-webkit-text-fill-color:#888E95!important;
}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"] svg,
[data-sentry-component="NavigationBar"] [id^="navigation-item-"] span{
 color:#888E95!important;-webkit-text-fill-color:#888E95!important;
}
/* Active tab on room list, selected by its actual DOM title/id. */
body:has([data-sentry-component="RoomList"]) [data-sentry-component="NavigationBar"] #navigation-item-Rooms,
body:has([data-sentry-component="RoomList"]) [data-sentry-component="NavigationBar"] #navigation-item-Rooms svg,
body:has([data-sentry-component="RoomList"]) [data-sentry-component="NavigationBar"] #navigation-item-Rooms span{
 color:#292D31!important;-webkit-text-fill-color:#292D31!important;
}
/* Retain active indication for other tabs if their class becomes gray-200. */
[data-sentry-component="NavigationBar"] [id^="navigation-item-"][class*="text-gray-200"]:is(:hover,:focus-visible) svg,
[data-sentry-component="NavigationBar"] [id^="navigation-item-"]:hover svg{
 color:#4F545B!important;
}


/* V8: shared theme palette. Change only the --cc-* tokens at :root for future colors. */
html,body,#__next,main#contents{background:var(--cc-bg)!important;color:var(--cc-text)!important}
/* Scrollbar repair: content scrolling is on nested WrappedDiv/FlatList, not window. */
html,body,main#contents,main#contents *,
[data-sentry-component="Home"], [data-sentry-component="CreatorCenterPage"],
[data-sentry-component="RoomList"], [data-sentry-component="MyPlotChatProfileEdit"]{
 scrollbar-width:thin!important;
 scrollbar-color:var(--cc-scroll) transparent!important;
}
html::-webkit-scrollbar,body::-webkit-scrollbar,main#contents::-webkit-scrollbar,
main#contents *::-webkit-scrollbar{width:4px!important;height:4px!important;background:transparent!important}
html::-webkit-scrollbar-track,body::-webkit-scrollbar-track,main#contents::-webkit-scrollbar-track,
main#contents *::-webkit-scrollbar-track{background:transparent!important;border:0!important;box-shadow:none!important}
html::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb,main#contents::-webkit-scrollbar-thumb,
main#contents *::-webkit-scrollbar-thumb{
 background:var(--cc-scroll)!important;border-radius:999px!important;
 border:0!important;box-shadow:none!important;
}
html::-webkit-scrollbar-corner,body::-webkit-scrollbar-corner,main#contents *::-webkit-scrollbar-corner{background:transparent!important}
/* Generic bottom navigation: active tab is detected by the class used by Zeta, not room-only. */
[data-sentry-component="NavigationBar"]{
 background:var(--cc-panel)!important;border-color:var(--cc-stroke)!important;
 border-top:1px solid var(--cc-stroke)!important;
 box-shadow:0 -2px 8px rgba(25,27,30,.035)!important;
}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"]:not([class*="text-gray-200"]),
[data-sentry-component="NavigationBar"] [id^="navigation-item-"]:not([class*="text-gray-200"]) :is(svg,span){
 color:#83878D!important;-webkit-text-fill-color:#83878D!important;
}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"][class*="text-gray-200"],
[data-sentry-component="NavigationBar"] [id^="navigation-item-"][class*="text-gray-200"] :is(svg,span){
 color:var(--cc-accent-strong)!important;-webkit-text-fill-color:var(--cc-accent-strong)!important;
}
/* Don't override the red notification dot. */
[data-sentry-component="NavigationBar"] [class*="bg-error-main"]{background-color:#D45E59!important}
/* Creator center: consistent quiet surface, title + chips + list */
[data-sentry-component="CreatorCenterPage"]{background:var(--cc-bg)!important;color:var(--cc-text)!important}
[data-sentry-component="CreatorCenterModeFilter"]{
 background:var(--cc-bg)!important;border-bottom:1px solid var(--cc-stroke)!important;
}
[data-sentry-component="CreatorCenterModeFilter"] > button{color:#81858B!important;-webkit-text-fill-color:#81858B!important}
[data-sentry-component="CreatorCenterModeFilter"] > button:not([class*="text-white/50"]){
 color:var(--cc-accent-strong)!important;-webkit-text-fill-color:var(--cc-accent-strong)!important;
}
[data-sentry-component="CreatorCenterMyPlotListTabBar"]{background:var(--cc-bg)!important}
[data-sentry-component="CreatorCenterMyPlotListTabBar"] button[data-sentry-element="Chip"]{
 color:#555A61!important;-webkit-text-fill-color:#555A61!important;
 background:var(--cc-accent-soft)!important;border:1px solid var(--cc-stroke)!important;
}
[data-sentry-component="CreatorCenterMyPlotListTabBar"] button[data-sentry-element="Chip"][class*="bg-primary-400"]{
 background:var(--cc-accent)!important;border-color:var(--cc-accent)!important;
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
[data-sentry-component="CreatorCenterMyPlotListTabBar"] [data-sentry-source-file="Select.tsx"]{
 color:#6F747B!important;-webkit-text-fill-color:#6F747B!important;
}
[data-sentry-component="CreatorCenterMyPlotListHeader"] span,
[data-sentry-component="CreatorCenterMyPlotListItem"] .caption1,
[data-sentry-component="CreatorCenterMyPlotListItem"] [class*="text-white/50"]{
 color:#747980!important;-webkit-text-fill-color:#747980!important;
}
[data-sentry-component="CreatorCenterMyPlotListItem"]{border-color:var(--cc-stroke)!important}
[data-sentry-component="CreatorCenterMyPlotListItem"] .body1,
[data-sentry-component="CreatorCenterMyPlotListEmpty"] .heading3{
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
[data-sentry-component="CreatorCenterMyPlotListItem"] button svg{
 color:#747980!important;-webkit-text-fill-color:#747980!important;
}
[data-sentry-component="CreatorCenterMyPlotListItem"] button:disabled svg{color:#B8BBC1!important}
[data-sentry-component="CreatorCenterMyPlotListEmpty"] button[class*="bg-primary-400"]{
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
 background:var(--cc-accent)!important;border:1px solid var(--cc-accent)!important;
}
/* Home surface: white light panels, preserve promo/banner imagery. */
[data-sentry-component="Home"],[data-sentry-component="HomeContents"],
[data-testid="home-feed"]{background:var(--cc-bg)!important;color:var(--cc-text)!important}
[data-sentry-component="HomeContents"] [class*="bg-gray-sub1"]:not(:has(img[alt="main banner image"])){
 background:var(--cc-panel)!important;
 border-color:var(--cc-stroke)!important;
}
[data-sentry-component="HomeContents"] :is(.body1,.body2,.body14,.caption1)[class*="text-white/50"]{
 color:#747980!important;-webkit-text-fill-color:#747980!important;
}
/* My page, pass/credits/account widgets, preserve images and brand logos. */
main#contents:has([data-sentry-source-file="MyPage.tsx"]) {
 background:var(--cc-bg)!important;color:var(--cc-text)!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) :is(
 [data-sentry-component="MyPass"],[data-sentry-component="MyPagePieceManagement"],
 section[class*="bg-gray-sub1"]){background:#FFFFFF!important;border-color:var(--cc-stroke)!important}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) .body2,
main#contents:has([data-sentry-source-file="MyPage.tsx"]) .text-gray-200:not(button):not(a),
main#contents:has([data-sentry-source-file="MyPage.tsx"]) .body14:not(button):not(a){
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) :is(.caption1,.caption12,.body12)[class*="text-white/50"],
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="MyPass"] .text-white\/50,
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="MyPagePieceManagement"] [class*="text-white/50"]{
 color:#747980!important;-webkit-text-fill-color:#747980!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="MyPagePieceManagement"] [class*="bg-white/"]{
 background-color:#E9EBEE!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) :is(a,button)[class*="bg-gray-800"]{
 background:var(--cc-accent-soft)!important;color:var(--cc-accent-strong)!important;
 -webkit-text-fill-color:var(--cc-accent-strong)!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) :is(a,button)[class*="bg-primary-400"]{
 background:var(--cc-accent)!important;color:#292B30!important;
 -webkit-text-fill-color:#292B30!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="Footer"]{
 border-color:var(--cc-stroke)!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="Footer"] :is(.text-footer,.body12){
 color:#81858B!important;-webkit-text-fill-color:#81858B!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="Footer"] [data-sentry-component="SnsLinks"] a{
 background:var(--cc-accent-soft)!important;
}
main#contents:has([data-sentry-source-file="MyPage.tsx"]) [data-sentry-component="Footer"] [data-sentry-component="SnsLinks"] svg{
 color:#646971!important;-webkit-text-fill-color:#646971!important;
}
/* Distinct scrollbar visibility in menus and overlays too. */
[data-sentry-component="KeyboardAvoidingView"] *,[role="dialog"] *,
[data-sentry-component="QuickReplyPanel"] *{
 scrollbar-width:thin!important;scrollbar-color:var(--cc-scroll) transparent!important;
}
[data-sentry-component="KeyboardAvoidingView"] *::-webkit-scrollbar,
[role="dialog"] *::-webkit-scrollbar,
[data-sentry-component="QuickReplyPanel"] *::-webkit-scrollbar{width:4px!important;height:4px!important}
[data-sentry-component="KeyboardAvoidingView"] *::-webkit-scrollbar-thumb,
[role="dialog"] *::-webkit-scrollbar-thumb,
[data-sentry-component="QuickReplyPanel"] *::-webkit-scrollbar-thumb{
 background:var(--cc-scroll)!important;border-radius:999px!important;
}


/* === V9: Neutral light-gray design system === */
:root{color-scheme:light}
/* Consistent neutral gray scroll bars, including horizontal lists and dialogs */
html,body,body *,#contents,#contents *,[role="dialog"],[role="dialog"] *,
[data-sentry-component="KeyboardAvoidingView"] *,[data-sentry-component="DropdownMenuItem"] *{
  scrollbar-width:thin!important;scrollbar-color:var(--cc-scroll) transparent!important;
}
html::-webkit-scrollbar,body::-webkit-scrollbar,body *::-webkit-scrollbar,
#contents *::-webkit-scrollbar,[role="dialog"] *::-webkit-scrollbar{
  width:4px!important;height:4px!important;background:transparent!important;
}
html::-webkit-scrollbar-track,body::-webkit-scrollbar-track,body *::-webkit-scrollbar-track,
#contents *::-webkit-scrollbar-track,[role="dialog"] *::-webkit-scrollbar-track{
  background:transparent!important;border:0!important;
}
html::-webkit-scrollbar-thumb,body::-webkit-scrollbar-thumb,body *::-webkit-scrollbar-thumb,
#contents *::-webkit-scrollbar-thumb,[role="dialog"] *::-webkit-scrollbar-thumb{
  background:var(--cc-scroll)!important;border:0!important;border-radius:999px!important;
  box-shadow:none!important;
}
/* Round thumbnails in list views, not discover's large poster covers */
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] img,
[data-sentry-component="RoomList"] [data-sentry-source-file="ScrappedPlotsPreviewItem.tsx"] img,
[data-sentry-component="CreatorCenterMyPlotListItem"] a img{
  border-radius:50%!important;object-fit:cover!important;aspect-ratio:1/1!important;
}
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] img{
  width:48px!important;height:48px!important;
}
[data-sentry-component="RoomList"] [data-sentry-source-file="ScrappedPlotsPreviewItem.tsx"] img{
  width:60px!important;height:60px!important;
}
[data-sentry-component="CreatorCenterMyPlotListItem"] a img{
  width:46px!important;height:46px!important;flex-shrink:0!important;
}
/* Room list preview text stays readable even with Zeta's explicit text-white/50 */
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] span.line-clamp-1,
[data-sentry-component="RoomList"] a[testid^="room-list-item-"] span[class*="text-white/50"]{
 color:#747980!important;-webkit-text-fill-color:#747980!important;opacity:1!important;
}
/* Creator tabs and counts */
[data-sentry-component="CreatorCenterModeFilter"] button:not([class*="text-white/50"]){
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
[data-sentry-component="CreatorCenterModeFilter"] button[class*="text-white/50"],
[data-sentry-component="CreatorCenterMyPlotListHeader"] span,
[data-sentry-component="CreatorCenterMyPlotListItem"] .caption1{
 color:#757A81!important;-webkit-text-fill-color:#757A81!important;
}
[data-sentry-component="CreatorCenterMyPlotListTabBar"] button[data-sentry-element="Chip"]{
 background:var(--cc-accent-soft)!important;border-color:var(--cc-stroke)!important;
 color:#5B6067!important;-webkit-text-fill-color:#5B6067!important;
}
[data-sentry-component="CreatorCenterMyPlotListTabBar"] button[data-sentry-element="Chip"][class*="bg-primary-400"]{
 background:#D7D9DE!important;border-color:#D7D9DE!important;
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
/* Dropdown menu: original component has dark-surface utility classes */
[data-sentry-source-file="DropdownMenu.tsx"] [class*="bg-gray-sub1"]{
 background:#FFFFFF!important;color:var(--cc-text)!important;
 border:1px solid var(--cc-stroke)!important;
 box-shadow:0 8px 30px rgba(29,31,34,.12)!important;
}
[data-sentry-component="DropdownMenuItem"]{
 background:#FFFFFF!important;border-color:var(--cc-stroke)!important;
}
[data-sentry-component="DropdownMenuItem"]:hover,
[data-sentry-component="DropdownMenuItem"]:focus-within{
 background:#F3F4F5!important;
}
[data-sentry-component="DropdownMenuItem"] button,
[data-sentry-component="DropdownMenuItem"] :is(.body2,.font-medium),
[data-sentry-component="DropdownMenuItem"] [class*="text-gray-200"]{
 color:#31343A!important;-webkit-text-fill-color:#31343A!important;
}
[data-sentry-component="DropdownMenuItem"] [class*="border-b-white"]{
 border-color:var(--cc-stroke)!important;
}
[data-sentry-component="DropdownMenuItem"] svg[class*="text-white/50"]{
 color:#747980!important;
}
/* Respect real ON / OFF from its existing toggle classes, only recolor backgrounds */
[data-sentry-component="DropdownMenuItem"] [data-sentry-component="ReadOnlyToggle"] [class*="bg-primary-300"]{
 background:#747980!important;
}
[data-sentry-component="DropdownMenuItem"] [data-sentry-component="ReadOnlyToggle"] [class*="bg-gray"]{
 background:#D8DADF!important;
}
/* Discover page layout + plot cards: preserve original full-size cover art */
[data-sentry-component="DiscoverPage"],[data-sentry-component="DiscoverLayout"]{
 background:var(--cc-bg)!important;color:var(--cc-text)!important;
}
[data-sentry-component="DiscoverSection"]>h2{
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
[data-sentry-component="FrameProfileCard"]{
 background:#FFFFFF!important;border:1px solid var(--cc-stroke)!important;
 box-shadow:0 1px 3px rgba(0,0,0,.025)!important;
}
/* The plot title sits over a cover gradient; preserve its light lettering there */
[data-sentry-component="FrameProfileCard"] [data-sentry-source-file="FrameProfileCard.tsx"] .body1.font-semibold{
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[data-sentry-component="FrameProfileCard"] .caption1:not([data-sentry-component="CountTag"] *),
[data-sentry-component="FrameProfileCard"] [data-sentry-component="Hashtags"] a{
 color:#666B73!important;-webkit-text-fill-color:#666B73!important;
}
[data-sentry-component="FrameProfileCard"] [data-sentry-component="Hashtags"] div[class*="to-gray-sub1"]{
 background:linear-gradient(to right,transparent,#FFFFFF)!important;
}
/* Text which is just below image and not a label overlay */
[data-sentry-component="FrameProfileCard"] > div > a > span.line-clamp-2{
 color:#5D626A!important;-webkit-text-fill-color:#5D626A!important;
}
/* Neutral bottom navigation, light active tab */
[data-sentry-component="NavigationBar"]{background:#FFFFFF!important;border-top:1px solid var(--cc-stroke)!important;}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"]:not([class*="text-gray-200"]) :is(svg,span){
 color:#858991!important;-webkit-text-fill-color:#858991!important;
}
[data-sentry-component="NavigationBar"] [id^="navigation-item-"][class*="text-gray-200"] :is(svg,span){
 color:#3E434A!important;-webkit-text-fill-color:#3E434A!important;
}


/* V10: discover feed filters — active neutral chip, readable inactive tabs */
[data-sentry-component="DiscoverPage"] [data-sentry-component="WrappedDiv"]:has(>div>button[class*="rounded-full"]) >div>button,
[data-sentry-component="DiscoverPage"] [data-sentry-component="WrappedDiv"]:has(>div>button[class*="rounded-full"]) >div>button[class*="text-white/50"]{
 color:#6D727A!important;-webkit-text-fill-color:#6D727A!important;
 background:transparent!important;
}
[data-sentry-component="DiscoverPage"] [data-sentry-component="WrappedDiv"]:has(>div>button[class*="rounded-full"]) >div>button[class*="bg-primary-400"]{
 background:#E9EAED!important;color:#30343A!important;-webkit-text-fill-color:#30343A!important;
 border:1px solid #DCDDDF!important;
}
/* Discover: image is a full intact poster, title/description remain BELOW it. */
[data-sentry-component="FrameProfileCard"]{
 background:#FFFFFF!important;color:#292B30!important;
 border:1px solid var(--cc-stroke)!important;
 border-radius:12px!important;overflow:hidden!important;
}
[data-sentry-component="FrameProfileCard"] > a:first-child{
 display:block!important;position:relative!important;flex:none!important;
 width:100%!important;aspect-ratio:3/4!important;overflow:hidden!important;
 border-radius:11px 11px 0 0!important;
}
[data-sentry-component="FrameProfileCard"] > a:first-child > img{
 width:100%!important;height:100%!important;object-fit:cover!important;
 border-radius:11px 11px 0 0!important;
}
/* This dark overlay was designed for titles superimposed ON the poster. Remove it. */
[data-sentry-component="FrameProfileCard"] > a:first-child > div[class*="bg-linear-to-b"]{
 display:none!important;
}
/* Zeta uses -mt-10 to overlap the title and image; reset it on light cards. */
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"][data-sentry-source-file="FrameProfileCard.tsx"]{
 margin-top:0!important;position:relative!important;z-index:1!important;
 padding-top:10px!important;min-width:0!important;
}
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"] > a:first-child{
 margin:0!important;position:relative!important;min-width:0!important;
}
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"] > a:first-child > span.body1,
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"] > a:first-child > span.font-semibold{
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
 text-shadow:none!important;
}
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"] > a:first-child > span.caption1{
 color:#676D76!important;-webkit-text-fill-color:#676D76!important;
 text-shadow:none!important;
}
[data-sentry-component="FrameProfileCard"] [data-sentry-component="Hashtags"] a,
[data-sentry-component="FrameProfileCard"] > div[data-sentry-element="Box"] > div > a[class*="text-primary-"]{
 color:#747980!important;-webkit-text-fill-color:#747980!important;
}
[data-sentry-component="FrameProfileCard"] [data-sentry-component="Hashtags"] div[class*="to-gray-sub1"]{
 background:linear-gradient(to right,transparent,#FFFFFF)!important;
}
/* Views counters sit ON image: keep a dark background with white text. */
[data-sentry-component="FrameProfileCard"] [data-sentry-component="CountTag"] > div[class*="bg-gray-800"]{
 background:rgba(43,46,51,.79)!important;
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[data-sentry-component="FrameProfileCard"] [data-sentry-component="CountTag"] > div[class*="bg-gray-800"] svg{
 color:#FFFFFF!important;
}
/* Ensure settings cog does not float over cards on non-chat pages. */
body:not(:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root))) #cc-toggle,
body:not(:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root))) #cc-panel{display:none!important;}


/* V11: Exact container for home feed tabs */
[data-sentry-component="FeedTabNavigator"]{
 background:var(--cc-bg)!important;background-image:none!important;
 border-bottom:1px solid #E8E9EB!important;
}
[data-sentry-component="FeedTabNavigator"] button{
 color:#666A72!important;-webkit-text-fill-color:#666A72!important;
 background:transparent!important;
}
[data-sentry-component="FeedTabNavigator"] button[class*="bg-primary-400"]{
 background:#E9EAED!important;color:#292B30!important;
 -webkit-text-fill-color:#292B30!important;
 border:1px solid #DCDDDF!important;
}
/* Scrapped row: override 60x80 intrinsic Tailwind dimensions; keep text underneath */
[data-sentry-component="ScrappedPlotsPreview"] a[href*="/plots/"]{
 width:60px!important;min-width:60px!important;
}
[data-sentry-component="ScrappedPlotsPreview"] a[href*="/plots/"] img{
 width:60px!important;height:60px!important;min-height:60px!important;
 aspect-ratio:1/1!important;border-radius:50%!important;
 object-fit:cover!important;display:block!important;
}
[data-sentry-component="ScrappedPlotsPreview"] a[href*="/plots/"] span{
 color:#61666E!important;-webkit-text-fill-color:#61666E!important;
}
[data-sentry-component="ScrappedPlotsPreview"]{
 border-bottom:1px solid #E7E8EA!important;background:var(--cc-panel-alt)!important;
}
/* Plot profile: neutral backgrounds, distinct image overlays and readable labels */
[data-sentry-component="PlotProfile"]{
 background:var(--cc-panel-alt)!important;color:#292B30!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotBasic"],
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotDetail"],
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotIntro"],
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLorebook"]{
 color:#292B30!important;
}
[data-sentry-component="PlotProfile"] :is(.heading1,.heading2,.title1,.title16),
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotBasic"] > span.title1,
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotCharacter"] > div.heading2{
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotDetail"] p,
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotCharacter"] p,
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotDate"],
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotCreatorTopRow"] span[class*="text-white/50"],
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLorebookItem"] .caption1{
 color:#656A72!important;-webkit-text-fill-color:#656A72!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotCharacter"],
[data-sentry-component="PlotProfile"] [data-sentry-source-file="PlotLorebook.tsx"] a[href*="/lorebooks/"]{
 background:#FFFFFF!important;border:1px solid #E5E6E9!important;
 border-radius:12px!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLorebookItem"] p,
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotCreatorTopRow"] span[class*="text-gray-200"]{
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLorebookItem"] svg,
[data-sentry-component="PlotProfile"] [data-sentry-source-file="PlotLorebook.tsx"] button svg{
 color:#737980!important;
}
/* The source has a dark cover dimmer and gradients, keep a gentle white blending */
[data-sentry-component="PlotCoverMulti"] .bg-gray-main\/70{
 background:rgba(247,247,248,.67)!important;
}
[data-sentry-component="PlotCoverMulti"] [class*="from-gray-main/50"]{
 background:linear-gradient(to bottom,rgba(247,247,248,.6),transparent)!important;
}
[data-sentry-component="PlotCoverMulti"] [class*="via-gray-main/80"]{
 background:linear-gradient(to bottom,transparent,rgba(247,247,248,.8) 70%,var(--cc-panel-alt))!important;
}
/* Like pill and small tags are deliberately dark on top of a photograph */
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLikePill"],
[data-sentry-component="PlotProfile"] [data-sentry-component="CountTag"] [class*="bg-gray-800"]{
 background:rgba(39,42,46,.78)!important;color:#FFFFFF!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="PlotLikePill"] :is(span,svg),
[data-sentry-component="PlotProfile"] [data-sentry-component="CountTag"] [class*="bg-gray-800"] svg{
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
/* Intro: clear character name, dialogue and soft em styling */
[data-sentry-component="PlotIntro"] [data-sentry-component="ChatBubbleContainer"]{
 background:#FFFFFF!important;border:1px solid #E5E6E9!important;
 color:#292B30!important;
}
[data-sentry-component="PlotIntro"] [data-sentry-component="ChatBubbleContainer"] .chat,
[data-sentry-component="PlotIntro"] [data-sentry-component="ChatBubbleContainer"] p{
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
[data-sentry-component="PlotIntro"] [data-sentry-component="ChatBubbleContainer"] :is(i,em){
 color:#858990!important;-webkit-text-fill-color:#858990!important;
}
[data-sentry-component="PlotIntro"] [data-sentry-component="StaticIntroMessage"] span.caption1{
 color:#51565E!important;-webkit-text-fill-color:#51565E!important;
}
/* Header has a dark inline backdrop; overwrite precisely that overlay */
[data-sentry-source-file="PlotProfileHeader.tsx"] header[data-sentry-component="Header"]{
 background:var(--cc-panel-alt)!important;border-bottom:1px solid #E8E9EB!important;
}
[data-sentry-source-file="PlotProfileHeader.tsx"] header[data-sentry-component="Header"] > div.absolute{
 background:var(--cc-panel-alt)!important;background-color:var(--cc-panel-alt)!important;
}
[data-sentry-source-file="PlotProfileHeader.tsx"] header[data-sentry-component="Header"] :is(h3,span,svg){
 color:#292B30!important;-webkit-text-fill-color:#292B30!important;
}
/* Plot profile bottom bar */
[data-sentry-component="PlotProfile"] [data-sentry-component="BottomActionArea"]{
 background:#FFFFFF!important;border-top:1px solid #E6E7EA!important;
}
[data-sentry-component="PlotProfile"] [data-sentry-component="BottomActionArea"] button:not([data-testid="plot-profile-start-chat"]),
[data-sentry-component="PlotProfile"] [data-sentry-component="BottomActionArea"] button:not([data-testid="plot-profile-start-chat"]) :is(svg,span){
 color:#5B6169!important;-webkit-text-fill-color:#5B6169!important;
}
[data-sentry-component="PlotProfile"] [data-testid="plot-profile-start-chat"]{
 background:#474C54!important;color:#FFFFFF!important;
 -webkit-text-fill-color:#FFFFFF!important;
}
/* Intro and general scrolling remain neutral, even in nested profile views */
[data-sentry-component="PlotProfile"] *,
[data-sentry-component="FeedTabNavigator"] *,
[data-sentry-component="ScrappedPlotsPreview"] *{
 scrollbar-width:thin!important;scrollbar-color:#CED0D4 transparent!important;
}


/* V12 — narration is a soft white card with a delicate dashed gray outline */
[data-sentry-component="NarratorBubble"] .message-context-menu-trigger,
.message-context-menu-trigger:has(svg[data-sentry-source-file="NarratorBubble.tsx"]){
  background:#FFFFFF!important;
  background-image:none!important;
  border:1.5px dashed #CDD0D4!important;
  border-radius:13px!important;
  box-shadow:none!important;
  box-sizing:border-box!important;
}
[data-sentry-component="NarratorBubble"] .chat,
[data-sentry-component="NarratorBubble"] .chat *,
.message-context-menu-trigger:has(svg[data-sentry-source-file="NarratorBubble.tsx"]) .chat,
.message-context-menu-trigger:has(svg[data-sentry-source-file="NarratorBubble.tsx"]) .chat *{
  color:#858A90!important;
  -webkit-text-fill-color:#858A90!important;
}
/* Hide only NarratorBubble's original text-lines icon, leaving all other SVGs intact. */
svg[data-sentry-source-file="NarratorBubble.tsx"][data-sentry-element="TextIcon"],
.message-context-menu-trigger svg[data-sentry-source-file="NarratorBubble.tsx"]{
  display:none!important;
}
/* Text-only narration. No injected emoji or replacement icon. */
[data-sentry-component="NarratorBubble"] .message-context-menu-trigger{
 gap:0!important;
 padding:12px 14px!important;
}
[data-sentry-component="NarratorBubble"] .message-context-menu-trigger::before,
[data-sentry-component="NarratorBubble"] .message-context-menu-trigger::after{
 content:none!important;
 display:none!important;
}
/* Keep the floating settings control exactly centered above native scroll-down. */
#cc-toggle{
 width:40px!important;height:40px!important;
 border-radius:50%!important;
 padding:0!important;
}

/* V14: equal-sized buttons, fixed location irrespective of scroll state */
#cc-toggle{
 width:32px!important;
 height:32px!important;
 min-width:32px!important;
 min-height:32px!important;
 right:8px!important;
 bottom:120px!important;
 left:auto!important;
 font-size:17px!important;
}
#cc-panel{right:8px!important;bottom:164px!important;left:auto!important;}


/* V15 — quoted user messages styled as handwritten letters */
@font-face{
 font-family:'OngleipParkDahyeon';
 src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/2411-3@1.0/Ownglyph_ParkDaHyun.woff2') format('woff2');
 font-weight:400;
 font-style:normal;
 font-display:swap;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) [data-sentry-component="ChatBubbleContainer"] blockquote.cc-letter{
 box-sizing:border-box!important;
 display:flex!important;
 flex-direction:column!important;
 align-items:stretch!important;
 gap:7px!important;
 margin:7px 0!important;
 padding:12px 14px!important;
 border:1px solid #E2E3E7!important;
 border-radius:15px!important;
 background:#FFFFFF!important;
 background-image:none!important;
 box-shadow:0 1px 2px rgba(30,34,38,.035)!important;
 min-width:0!important;
 max-width:100%!important;
 font-family:'OngleipParkDahyeon',sans-serif!important;
 font-weight:400!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter > div.w-1,
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter > div[class*="bg-white/20"]{display:none!important;}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter > .shrink{
 flex:1 1 auto!important;
 min-width:0!important;
 width:100%!important;
 font-family:'OngleipParkDahyeon',sans-serif!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter .cc-letter-meta{
 display:flex!important;align-items:baseline!important;
 flex-wrap:wrap!important;gap:3px!important;
 font:400 14px/1.35 'OngleipParkDahyeon',sans-serif!important;
 color:#5C6066!important;-webkit-text-fill-color:#5C6066!important;
 border-bottom:1px solid var(--cc-user)!important;
 padding-bottom:7px!important;
 letter-spacing:0!important;
 user-select:none!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter .cc-letter-meta .cc-letter-stamp{
 margin-right:3px!important;font-size:15px!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter .cc-letter-meta .cc-letter-time{
 color:#92969D!important;-webkit-text-fill-color:#92969D!important;
 margin-left:3px!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter :is(p,span,em,i),
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter > .shrink{
 font-family:'OngleipParkDahyeon',sans-serif!important;
 font-size:17px!important;
 font-weight:400!important;
 line-height:1.55!important;
 color:#4D5055!important;
 -webkit-text-fill-color:#4D5055!important;
 letter-spacing:0!important;
 overflow-wrap:anywhere!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter p{margin:0!important;}

/* Header typography stays separate from handwritten message text. */
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter .cc-letter-meta span{
 font-family:'OngleipParkDahyeon',sans-serif!important;
 font-size:14px!important;
 line-height:1.35!important;
 color:#5C6066!important;
 -webkit-text-fill-color:#5C6066!important;
}
:is([data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]) blockquote.cc-letter .cc-letter-meta .cc-letter-time{
 color:#92969D!important;-webkit-text-fill-color:#92969D!important;
}


/* V18 · Native message-action sheet (report, snapshot, bookmark, reset, copy, capture, delete) */
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"]:has(button[data-sentry-element="LogRawButton"]){
 background:#FFFFFF!important;background-image:none!important;
 border:1px solid var(--cc-stroke)!important;border-bottom:0!important;
 box-shadow:0 -8px 28px rgba(35,38,45,.08)!important;
 color:var(--cc-text)!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"]:has(button[data-sentry-element="LogRawButton"]) > div:first-child svg{
 color:#C7CBD1!important;-webkit-text-fill-color:#C7CBD1!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"]{
 background:#F6F6F8!important;background-image:none!important;
 border-color:#E8E9EC!important;color:var(--cc-text)!important;
 box-shadow:none!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"]:not(:disabled):active{
 background:#E8E9EC!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"] :is(span,svg){
 color:#3F434A!important;-webkit-text-fill-color:#3F434A!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"]:disabled{
 background:#F6F6F8!important;opacity:.4!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"]:has(.text-error-light){
 background:#FFF4F4!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] button[data-sentry-element="LogRawButton"]:has(.text-error-light) :is(svg,span){
 color:#C35257!important;-webkit-text-fill-color:#C35257!important;
}
[data-sentry-element="AnimatedDiv"].mt-auto[class*="rounded-t-"] [class*="border-b-white"]{
 border-bottom-color:var(--cc-stroke)!important;
}
/* Capture and deletion selection UI */
[data-sentry-component="CaptureModeBottom"],
[data-sentry-component="DeleteModeBottom"],
[data-sentry-component="DeleteStartNotice"]{
 background:var(--cc-bg)!important;background-image:none!important;
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
[data-sentry-component="CaptureModeBottom"],
[data-sentry-component="DeleteModeBottom"]{border-top:1px solid var(--cc-stroke)!important;}
[data-sentry-component="CaptureModeBottom"] button{
 background:var(--cc-accent-strong)!important;color:#FFFFFF!important;
 -webkit-text-fill-color:#FFFFFF!important;border:0!important;
}
[data-sentry-component="DeleteModeBottom"] button{
 background:#C35257!important;color:#FFFFFF!important;
 -webkit-text-fill-color:#FFFFFF!important;border:0!important;
}
:is([data-sentry-component="CaptureModeBottom"],[data-sentry-component="DeleteModeBottom"]) button:disabled{
 background:#E0E2E5!important;color:#989DA4!important;
 -webkit-text-fill-color:#989DA4!important;
}

/* V19 — restrained relative dates beside message author names */
.cc-meta-date{
 font:400 11px/1.5 inherit!important;
 font-size:11px!important;
 font-weight:400!important;
 color:#9A9DA3!important;
 -webkit-text-fill-color:#9A9DA3!important;
 letter-spacing:0!important;
 white-space:nowrap!important;
}

/* V20 — quieter typography and measured spacing, retaining existing colors */
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) :is([data-sentry-component="LeftTextContent"],[data-sentry-component="RightTextContent"]){
 padding-top:6px!important;padding-bottom:6px!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 max-width:min(410px,100%)!important;
 padding:7px 10px 8px!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 max-width:min(380px,100%)!important;
 padding:11px 13px!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) .cc-meta{
 gap:5px!important;margin-bottom:6px!important;line-height:1.4!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) .cc-meta-name{
 font-size:13px!important;font-weight:600!important;letter-spacing:-.018em!important;
 color:#303238!important;-webkit-text-fill-color:#303238!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) .cc-meta-date{
 font-size:11px!important;font-weight:400!important;line-height:1.4!important;
 letter-spacing:-.01em!important;color:#A0A3A9!important;
 -webkit-text-fill-color:#A0A3A9!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="ChatBubbleContainer"] .chat :is(em,i){
 color:#858A91!important;-webkit-text-fill-color:#858A91!important;
}
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="ChatBubbleContainer"] .chat p+p{
 margin-top:7px!important;
}


/* V21: light edit-message composer; only the dedicated edit surface */
[data-sentry-component="EditModeInputPanelContent"]{background:#FFFFFF!important;color:var(--cc-text)!important}
[data-sentry-component="EditModeInputPanelContent"] section>div:first-child{
 background:#FFFFFF!important;border-color:#E0E2E5!important;box-shadow:none!important;
}
[data-sentry-component="EditModeInputPanelContent"] [aria-label="Resize edit area"]>div{
 background:#C9CCD1!important;
}
[data-sentry-component="EditModeInputPanelContent"] textarea[name="message"]{
 background:#FFFFFF!important;background-image:none!important;
 color:#303238!important;-webkit-text-fill-color:#303238!important;
 caret-color:#555B63!important;
 font-size:14px!important;line-height:1.65!important;
}
[data-sentry-component="EditModeInputPanelContent"] textarea[name="message"]::placeholder{
 color:#A2A6AC!important;-webkit-text-fill-color:#A2A6AC!important;
}
[data-sentry-component="EditModeInputPanelContent"] section>div:nth-child(2){
 background:#FFFFFF!important;border-color:#E0E2E5!important;
 border-top:1px solid #EBECEE!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Cancel editing"],
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Insert asterisk"]{
 background:#F0F1F3!important;color:#5B6068!important;
 border:1px solid #E4E6E9!important;box-shadow:none!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Save edit"]:not(:disabled){
 background:#444950!important;color:#FFFFFF!important;
 border:1px solid #444950!important;box-shadow:none!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Save edit"]:disabled{
 background:#ECEEF0!important;color:#A1A4AB!important;
 border:1px solid var(--cc-stroke)!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Cancel editing"] svg,
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Insert asterisk"] svg{
 color:#5B6068!important;-webkit-text-fill-color:#5B6068!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Save edit"]:not(:disabled) svg{
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[data-sentry-component="EditModeInputPanelContent"] button[aria-label="Save edit"]:disabled svg{
 color:#A1A4AB!important;-webkit-text-fill-color:#A1A4AB!important;
}
[data-sentry-component="EditModeInputPanelContent"] button:not(:disabled):active{opacity:.78!important}

/* V21: Piece purchasing sheet only, preserving original content and actions */
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="PieceChargeBalance"]) > [data-sentry-element="AnimatedDiv"][class*="rounded-t-"]{
 background:#FFFFFF!important;background-image:none!important;
 color:var(--cc-text)!important;box-shadow:0 -8px 28px rgba(35,38,45,.09)!important;
}
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="PieceChargeBalance"]) > [data-sentry-element="AnimatedDiv"][class*="rounded-t-"] >div:first-child svg{
 color:var(--cc-scroll)!important;
}
[data-sentry-component="PieceChargeBalance"]{
 background:#FFFFFF!important;border-bottom-color:#E7E8EB!important;
 color:#303238!important;
}
[data-sentry-component="PieceChargeBalance"] [class*="text-primary"]{
 color:#4B5057!important;-webkit-text-fill-color:#4B5057!important;
}
[data-sentry-component="PieceChargeItemList"]{
 background:#FFFFFF!important;color:#303238!important;
}
[data-sentry-component="PieceChargeItem"]{
 border-color:#EBECEF!important;background:#FFFFFF!important;
 color:#34373B!important;
}
[data-sentry-component="PieceChargeItem"] button[aria-label]{
 background:#484D54!important;border:1px solid #484D54!important;
 color:#FFFFFF!important;box-shadow:none!important;
}
[data-sentry-component="PieceChargeItem"] button[aria-label] :is(span,div){
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
[data-sentry-component="PieceChargeItem"] button[aria-label]:disabled{
 background:#E5E7EA!important;border-color:#E5E7EA!important;
}
[data-sentry-component="PieceChargeTerms"]{
 background:#FFFFFF!important;border-top-color:#E8EAED!important;
 color:#737780!important;
}
[data-sentry-component="PieceChargeTerms"] :is(span,div,li){
 color:#737780!important;-webkit-text-fill-color:#737780!important;
}
/* Native image banner remains intact; only its card outline changes */
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="PieceChargeBalance"])
 [data-sentry-source-file="PieceChargeBannerItem.tsx"]{color:inherit}

/* V22: edit shortcut floats above settings, both independently anchored */
#cc-edit-shortcut{
 position:fixed!important;
 z-index:2147483000!important;
 right:8px!important;bottom:164px!important;left:auto!important;
 display:flex!important;align-items:center!important;justify-content:center!important;
 width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;
 border:1px solid #DDDFE0!important;border-radius:50%!important;
 background:#FFFFFF!important;color:#45484C!important;
 box-shadow:0 2px 8px #00000015!important;
 font:17px/1 sans-serif!important;cursor:pointer!important;
 padding:0!important;
}
#cc-edit-shortcut:hover:not(:disabled){background:#F1F2F4!important;}
#cc-edit-shortcut:disabled{opacity:.46!important;cursor:default!important;}
body:not(:has(:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root))) #cc-edit-shortcut{display:none!important;}
#cc-panel{bottom:208px!important;}


/* V24 - avatar appearance choices. No changes to native profile data or image sources. */
html.cc-avatar-user-hidden [data-sentry-component="RightTextContent"] > button.shrink-0,
html.cc-avatar-hidden [data-sentry-component="RightTextContent"] > button.shrink-0 {display:none!important;}
html.cc-avatar-hidden [data-sentry-component="LeftTextContent"] > button.shrink-0 {display:none!important;}
html.cc-avatar-heart [data-sentry-component="LeftTextContent"] > button.shrink-0{
 position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;
 flex-shrink:0!important;min-width:32px!important;width:32px!important;height:32px!important;
 overflow:hidden!important;border:1px solid var(--cc-stroke)!important;border-radius:50%!important;
 background:#FFFFFF!important;background-image:none!important;box-shadow:none!important;
 color:var(--cc-accent-strong)!important;
}
html.cc-avatar-heart [data-sentry-component="LeftTextContent"] > button.shrink-0 > * {visibility:hidden!important;opacity:0!important;}
html.cc-avatar-heart [data-sentry-component="LeftTextContent"] > button.shrink-0::after{
 content:''!important;position:absolute!important;inset:0!important;
 display:block!important;visibility:visible!important;opacity:1!important;
 width:19px!important;height:19px!important;margin:auto!important;
 background:var(--cc-accent-strong)!important;pointer-events:none!important;
 -webkit-mask-image:url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M19.0711%2013.1421L13.4142%2018.799C12.6332%2019.58%2011.3668%2019.58%2010.5858%2018.799L4.92894%2013.1421C2.97632%2011.1895%202.97632%208.02369%204.92894%206.07106C6.88157%204.11844%2010.0474%204.11844%2012%206.07106C13.9526%204.11844%2017.1185%204.11844%2019.0711%206.07106C21.0237%208.02369%2021.0237%2011.1895%2019.0711%2013.1421Z%22%20stroke%3D%22black%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")!important;
 mask-image:url("data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M19.0711%2013.1421L13.4142%2018.799C12.6332%2019.58%2011.3668%2019.58%2010.5858%2018.799L4.92894%2013.1421C2.97632%2011.1895%202.97632%208.02369%204.92894%206.07106C6.88157%204.11844%2010.0474%204.11844%2012%206.07106C13.9526%204.11844%2017.1185%204.11844%2019.0711%206.07106C21.0237%208.02369%2021.0237%2011.1895%2019.0711%2013.1421Z%22%20stroke%3D%22black%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")!important;
 -webkit-mask-position:center!important;mask-position:center!important;
 -webkit-mask-repeat:no-repeat!important;mask-repeat:no-repeat!important;
 -webkit-mask-size:19px 19px!important;mask-size:19px 19px!important;
}
/* Keep avatar visually aligned with the top of the message body. */
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="LeftTextContent"] > button.shrink-0{
 transform:translateY(5px)!important;
}
html.cc-avatar-user-hidden [data-sentry-component="RightTextContent"] > div{margin-left:auto!important;}
#cc-panel .cc-avatar-options{display:flex!important;flex-direction:column!important;gap:3px!important;margin:4px 0 10px!important;}
#cc-panel .cc-avatar-option{display:flex!important;align-items:center!important;gap:9px!important;
 padding:7px 8px!important;border-radius:9px!important;color:#3D4147!important;
 background:transparent!important;font:12px/1.4 sans-serif!important;cursor:pointer!important;}
#cc-panel .cc-avatar-option:has(input:checked){background:#F2F3F5!important;}
#cc-panel .cc-avatar-option input{accent-color:#626971!important;width:14px!important;height:14px!important;margin:0!important;flex-shrink:0!important;}


/* V29 compact settings: less chrome, same native controls */
#cc-panel{
 width:226px!important;
 padding:9px 10px 10px!important;
 border-radius:12px!important;
 max-height:min(70vh,420px)!important;
 box-shadow:0 7px 22px #00000012!important;
}
#cc-panel .cc-section-title{
 margin:6px 0 3px!important;
 font-size:10px!important;
 line-height:1.3!important;
 letter-spacing:0!important;
}
#cc-panel .cc-section-title:first-child{margin-top:1px!important;}
#cc-panel .cc-avatar-options{gap:1px!important;margin:0 0 4px!important;}
#cc-panel .cc-avatar-option{
 padding:5px 7px!important;
 min-height:26px!important;
 gap:7px!important;
 border-radius:7px!important;
 font-size:11px!important;
}
#cc-panel .cc-avatar-option input{width:13px!important;height:13px!important;}
#cc-panel .cc-action-list{gap:5px!important;}
#cc-panel .cc-action{
 min-height:30px!important;
 padding:5px 6px!important;
 border-radius:7px!important;
 font-size:11px!important;
}
#cc-panel .cc-action.cc-help-open{
 grid-column:1/-1!important;
 display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;
 font-weight:650!important;
}
#cc-panel .cc-action.cc-help-open .cc-help-open-icon{
 font-size:13px!important;line-height:1!important;color:var(--cc-accent-strong)!important;
}
#cc-help-backdrop{
 position:fixed!important;inset:0!important;z-index:2147483646!important;
 background:rgba(24,27,31,.18)!important;
}
#cc-help-backdrop[hidden],#cc-help-dialog[hidden]{display:none!important}
#cc-help-dialog{
 position:fixed!important;z-index:2147483647!important;
 left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;
 width:min(330px,calc(100vw - 28px))!important;max-height:min(78dvh,570px)!important;
 overflow:auto!important;padding:12px!important;
 border:1px solid var(--cc-stroke)!important;border-radius:16px!important;
 background:#FFFFFF!important;color:var(--cc-text)!important;
 box-shadow:0 14px 42px rgba(25,29,34,.18)!important;
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif!important;
}
#cc-help-dialog .cc-help-head{
 display:flex!important;align-items:center!important;gap:8px!important;
 padding:1px 1px 10px!important;border-bottom:1px solid var(--cc-stroke)!important;
}
#cc-help-dialog .cc-help-title{flex:1!important;font-size:14px!important;font-weight:750!important;letter-spacing:-.02em!important}
#cc-help-dialog .cc-help-close{
 width:29px!important;height:29px!important;padding:0!important;border:1px solid #ECEDEE!important;
 border-radius:9px!important;background:#FAFAFA!important;color:#70757A!important;
 font:17px/1 sans-serif!important;cursor:pointer!important;
}
#cc-help-dialog .cc-help-body{display:flex!important;flex-direction:column!important;gap:8px!important;padding-top:10px!important}
#cc-help-dialog .cc-help-card{
 padding:10px 11px!important;border:1px solid #ECEDEE!important;border-radius:12px!important;background:#FAFAFA!important;
}
#cc-help-dialog .cc-help-card-title{
 display:flex!important;align-items:center!important;gap:7px!important;
 margin-bottom:6px!important;color:#34383C!important;font-size:12px!important;font-weight:750!important;
}
#cc-help-dialog .cc-help-card-title .cc-help-icon{
 display:grid!important;place-items:center!important;width:22px!important;height:22px!important;flex:0 0 22px!important;
 border-radius:7px!important;background:var(--cc-accent-soft)!important;color:var(--cc-accent-strong)!important;
 font-size:12px!important;line-height:1!important;
}
#cc-help-dialog .cc-help-card-title .cc-help-icon svg{
 width:14px!important;height:14px!important;display:block!important;
 fill:none!important;stroke:currentColor!important;stroke-width:1.7!important;
 stroke-linecap:round!important;stroke-linejoin:round!important;
}
#cc-help-dialog .cc-help-lines{display:flex!important;flex-direction:column!important;gap:5px!important}
#cc-help-dialog .cc-help-line{
 display:flex!important;align-items:flex-start!important;gap:6px!important;
 color:#656A70!important;font-size:11px!important;line-height:1.5!important;letter-spacing:-.01em!important;
}
#cc-help-dialog .cc-help-dot{flex:0 0 auto!important;color:var(--cc-accent-strong)!important;font-weight:800!important}
#cc-help-dialog .cc-help-key{
 flex:0 0 auto!important;min-width:54px!important;color:#41464C!important;font-weight:700!important;
}

/* One consistent inline text highlight on desktop and mobile.
   Dialogue-only spans sit with the text, so there is no overlay or scrolling lag. */
html.cc-dialogue-highlight [data-sentry-component="ChatBubbleContainer"] .chat span.cc-dialogue-inline{
 background-image:linear-gradient(to bottom,transparent 62%,rgba(${accentRgb},.42) 62%,rgba(${accentRgb},.42) 90%,transparent 90%)!important;
 background-repeat:repeat!important;
 -webkit-box-decoration-break:clone;box-decoration-break:clone;
 text-decoration:none!important;
}
html:not(.cc-dialogue-highlight) [data-sentry-component="ChatBubbleContainer"] .chat span.cc-dialogue-inline{
 background-image:none!important;background-color:transparent!important;
 text-decoration:none!important;
}
/* V32: pastel user bubble wins over inherited gray overrides */
html [role="log"][aria-label="Chat messages"] [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"],
html :is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{
 background:var(--cc-user)!important;background-image:none!important;
 border-color:var(--cc-stroke)!important;
}
/* V34: hide native small Zeta watermark next to character bubbles only. */
:is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) :is([data-sentry-component="ZetaWatermarkRaw"],[data-sentry-component="ZetaWatermarkEditedRaw"]){display:none!important;}
/* V47: new iframe direct watermark override. Keep this after the legacy rule so later scene styles cannot revive it. */
body.cc-frame-chat-root [data-sentry-component="ZetaWatermarkRaw"],
body.cc-frame-chat-root [data-sentry-component="ZetaWatermarkEditedRaw"],
html.cc-tools-ready body.cc-frame-chat-root [data-sentry-component="ZetaWatermarkRaw"],
html.cc-tools-ready body.cc-frame-chat-root [data-sentry-component="ZetaWatermarkEditedRaw"]{
 display:none!important;
 visibility:hidden!important;
 opacity:0!important;
 pointer-events:none!important;
}
/* V62: new iframe watermark fallback — includes SVG elements and right-gutter geometry. */
body.cc-frame-chat-root .cc-zeta-mark-hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}
body.cc-frame-chat-root .cc-zeta-before-hidden::before{content:none!important;display:none!important;}
body.cc-frame-chat-root .cc-zeta-after-hidden::after{content:none!important;display:none!important;}
/* V32: third floating tool sits 44px above edit */
#cc-line-shortcut{position:fixed!important;right:8px!important;bottom:208px!important;z-index:2147483000!important;
 width:32px!important;height:32px!important;min-height:32px!important;min-width:32px!important;
 padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;
 border:1px solid var(--cc-stroke)!important;border-radius:50%!important;
 background:white!important;color:var(--cc-accent-strong)!important;
 box-shadow:0 2px 8px #00000012!important;cursor:pointer!important;}
#cc-line-shortcut svg{width:17px;height:17px;stroke:currentColor!important;fill:none!important}
#cc-line-shortcut[aria-pressed="true"]{background:var(--cc-user)!important;border-color:var(--cc-accent)!important;}
/* V56: settings opens as a viewport bottom sheet. */
#cc-settings-backdrop{
 position:fixed!important;inset:0!important;z-index:2147483645!important;
 background:rgba(24,27,31,.18)!important;
}
#cc-settings-backdrop[hidden]{display:none!important;}
#cc-panel{
 position:fixed!important;
 left:50%!important;right:auto!important;top:auto!important;bottom:0!important;
 transform:translateX(-50%)!important;
 width:min(100%,560px)!important;max-width:100%!important;
 max-height:min(78vh,620px)!important;
 box-sizing:border-box!important;
 padding:18px 16px calc(18px + env(safe-area-inset-bottom))!important;
 border:1px solid var(--cc-stroke)!important;border-bottom:0!important;
 border-radius:20px 20px 0 0!important;
 background:#fff!important;color:var(--cc-text)!important;
 box-shadow:0 -10px 32px rgba(25,29,34,.14)!important;
 overflow:auto!important;overscroll-behavior:contain!important;
 z-index:2147483646!important;
}
#cc-panel::before{
 content:''!important;display:block!important;
 width:38px!important;height:4px!important;border-radius:999px!important;
 background:#D7D9DD!important;margin:-7px auto 12px!important;
}
#cc-panel:not([hidden]){animation:cc-sheet-in .18s ease-out both;}
@keyframes cc-sheet-in{from{transform:translate(-50%,18px);opacity:.65}to{transform:translate(-50%,0);opacity:1}}
@media (prefers-reduced-motion:reduce){#cc-panel:not([hidden]){animation:none!important;}}

/* V57: compact settings layout — avatar and output choices use two columns. */
#cc-panel .cc-avatar-options,
#cc-panel .cc-output-options{
 display:grid!important;
 grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
 gap:4px 6px!important;
 margin:0 0 6px!important;
}
#cc-panel .cc-avatar-options{flex-direction:unset!important;}
#cc-panel .cc-avatar-option{min-width:0!important;}
#cc-panel .cc-avatar-option span{min-width:0!important;}


/* V36 — profile-selection light palette, scoped only to this step. */
[data-sentry-component="PlayerCharacterSelect"]{background:var(--cc-bg)!important;color:var(--cc-text)!important;}
[data-sentry-component="PlayerCharacterSelect"]>h4{color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"]{background:#fff!important;border:1px solid var(--cc-stroke)!important;box-shadow:0 6px 22px rgba(40,45,50,.06)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"]>div[class*="bg-black/30"]{background:linear-gradient(180deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.90) 77%,#fff 100%)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] h4,
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] span{color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] button[aria-label="Edit chat profile"]{background:var(--cc-panel-alt)!important;border:1px solid var(--cc-stroke)!important;color:var(--cc-icon)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] button[aria-label="Edit chat profile"] svg{color:var(--cc-icon)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] button:not([aria-label]){background:var(--cc-user)!important;border:1px solid var(--cc-stroke)!important;color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;}
[data-sentry-component="PlayerCharacterSelect"] [data-sentry-component="PlotProfileCard"] button:not([aria-label]):active{background:var(--cc-accent-hover)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"]{background:#fff!important;border:0!important;border-radius:12px!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] button{color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;border-color:var(--cc-stroke)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] button:active{background:var(--cc-accent-soft)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] span{color:var(--cc-muted)!important;-webkit-text-fill-color:var(--cc-muted)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] span.body1{color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] svg{color:var(--cc-icon)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] .divide-y>div{border-color:var(--cc-stroke)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] .border-b{border-color:var(--cc-stroke)!important;}
[data-sentry-component="PlayerCharacterSelect"] [role="group"][aria-label="My chat profiles"] button:first-child .rounded-full{background:var(--cc-accent-soft)!important;}


/* V37: Chat profile edit full-screen modal (not the profile selection sheet) */
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="ChatProfileEditForm"]),
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="ChatProfileEditForm"]) > [role="presentation"],
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="ChatProfileEditForm"]) > div[class*="bg-gray-main"]{
 background:var(--cc-bg)!important;background-image:none!important;color:var(--cc-text)!important;
}
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="ChatProfileEditForm"]) [data-sentry-component="ModalHeader"]{
 background:#fff!important;border-bottom:1px solid var(--cc-stroke)!important;color:var(--cc-text)!important;
}
[data-sentry-component="KeyboardAvoidingView"]:has([data-sentry-component="ChatProfileEditForm"]) [data-sentry-component="ModalHeader"] :is(h3,svg){
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
[data-sentry-component="ChatProfileEditForm"]{background:var(--cc-bg)!important;color:var(--cc-text)!important;}
[data-sentry-component="ChatProfileEditForm"] :is(h3,span.title18,.heading3,.body16){color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;}
[data-sentry-component="ChatProfileEditForm"] section [class*="text-white/50"],
[data-sentry-component="ChatProfileEditForm"] section .body12{color:var(--cc-muted)!important;-webkit-text-fill-color:var(--cc-muted)!important;}
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="InputField"] [data-sentry-component="Input"],
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="TextareaField"] textarea{
 background:#fff!important;border:1px solid var(--cc-stroke)!important;border-radius:10px!important;
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
 caret-color:var(--cc-accent-strong)!important;box-shadow:none!important;
}
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="InputField"] input{
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;caret-color:var(--cc-accent-strong)!important;
}
[data-sentry-component="ChatProfileEditForm"] :is(input,textarea)::placeholder{
 color:#A0A4AB!important;-webkit-text-fill-color:#A0A4AB!important;opacity:1!important;
}
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="TextareaField"] .caption12{
 color:var(--cc-accent-strong)!important;-webkit-text-fill-color:var(--cc-accent-strong)!important;
}
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="Preview"] button > div[class*="bg-primary-400"]{
 background:var(--cc-accent-strong)!important;
}
[data-sentry-component="ChatProfileEditForm"] [data-sentry-component="Preview"] button > div[class*="bg-primary-400"] svg{
 color:#fff!important;-webkit-text-fill-color:#fff!important;
}
[data-sentry-component="ChatProfileEditForm"] > button[data-sentry-component="Button"]{
 background:var(--cc-user)!important;border:1px solid var(--cc-stroke)!important;
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;box-shadow:none!important;
}
[data-sentry-component="ChatProfileEditForm"] > button[data-sentry-component="Button"]:active{background:var(--cc-accent-hover)!important;}
[data-sentry-component="ChatProfileEditForm"] > button[data-sentry-component="Button"]:disabled{
 background:#F1F2F4!important;color:#A7ABB0!important;-webkit-text-fill-color:#A7ABB0!important;
}


/* Info box on light themes: Zeta supplies white text on nested spans. */
[data-sentry-component="InfoBoxContent"],
[data-sentry-component="InfoBoxExpandedContent"],
[data-sentry-component="InfoBoxCharacterSection"]{
  background:#FFFFFF!important;
  color:var(--cc-text)!important;
  -webkit-text-fill-color:var(--cc-text)!important;
}
[data-sentry-component="InfoBoxContent"] .chat,
[data-sentry-component="InfoBoxExpandedContent"] .chat,
[data-sentry-component="InfoBoxCharacterSection"] .chat,
[data-sentry-component="InfoBoxContent"] .chat span,
[data-sentry-component="InfoBoxExpandedContent"] .chat span,
[data-sentry-component="InfoBoxCharacterSection"] .chat span{
  color:var(--cc-text)!important;
  -webkit-text-fill-color:var(--cc-text)!important;
  opacity:1!important;
}
[data-sentry-component="InfoBoxContent"] .chat .font-bold,
[data-sentry-component="InfoBoxExpandedContent"] .chat .font-bold,
[data-sentry-component="InfoBoxCharacterSection"] .chat .font-bold{
  color:#34383E!important;
  -webkit-text-fill-color:#34383E!important;
  font-weight:650!important;
}
[data-sentry-component="InfoBoxContent"] .chat [class*="text-white/70"],
[data-sentry-component="InfoBoxExpandedContent"] .chat [class*="text-white/70"],
[data-sentry-component="InfoBoxCharacterSection"] .chat [class*="text-white/70"],
[data-sentry-component="InfoBoxCharacterSection"] > span.caption1{
  color:#737981!important;
  -webkit-text-fill-color:#737981!important;
  opacity:1!important;
}
[data-sentry-component="InfoBoxContent"] [data-sentry-component="InfoBoxCollapseToggle"] svg{
  color:#747981!important;
}

/* Info box spacing: compact-but-readable 2~3 step gaps. */
[data-sentry-component="InfoBoxExpandedContent"]{
  row-gap:12px!important;
}
[data-sentry-component="InfoBoxExpandedContent"] > [data-sentry-component="InfoBoxContent"],
[data-sentry-component="InfoBoxExpandedContent"] > [data-sentry-component="InfoBoxCharacterSection"]{
  row-gap:10px!important;
}

`;
// Target only the new scene document, using diagnostic-confirmed structure.
if(FRAME_CHAT)style.textContent+=`

html,body,body.cc-frame-chat-root{background:var(--cc-bg)!important;color:var(--cc-text)!important}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]{background:#fff!important}
body.cc-frame-chat-root header{background:rgba(255,255,255,.96)!important;border-bottom:1px solid var(--cc-stroke)!important;color:var(--cc-text)!important}
body.cc-frame-chat-root header :is(button,span,svg){color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
body.cc-frame-chat-root header [data-testid="chat-header-model"]{display:none!important}
body.cc-frame-chat-root header nav{position:relative!important}
body.cc-frame-chat-root header [data-testid="chat-header-profile"]{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:calc(100% - 140px)!important;width:max-content!important;flex:none!important;text-align:center!important;justify-content:center!important}
body.cc-frame-chat-root header [data-testid="chat-header-profile"] :is(span,div){text-align:center!important}
body.cc-frame-chat-root [role="log"] [data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"]{background:#fff!important;color:var(--cc-text)!important;border:0!important;border-radius:18px!important;box-shadow:none!important;max-width:min(612px,100%)!important}
body.cc-frame-chat-root [role="log"] [data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]{background:var(--cc-user)!important;color:var(--cc-text)!important;border:1px solid var(--cc-stroke)!important;border-radius:11px!important;box-shadow:none!important;max-width:min(612px,100%)!important}
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] :is(p,span,div){color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important}
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] :is(em,i){color:#96999D!important;-webkit-text-fill-color:#96999D!important;font-style:italic!important}
/* New iframe InfoBox: exact live DOM structure, light card treatment. */
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold){
 background:#FFFFFF!important;background-image:none!important;
 border:0!important;border-radius:12px!important;
 box-shadow:none!important;
 color:var(--cc-text)!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) > button{
 color:var(--cc-icon)!important;background:transparent!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) > button svg{
 color:var(--cc-icon)!important;-webkit-text-fill-color:var(--cc-icon)!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) .chat,
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) .chat span{
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;opacity:1!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) .chat .font-bold{
 color:#34383E!important;-webkit-text-fill-color:#34383E!important;font-weight:650!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) .chat [class*="text-white/70"]{
 color:#737981!important;-webkit-text-fill-color:#737981!important;opacity:1!important;
}
body.cc-frame-chat-root [role="log"][aria-label="Chat messages"]
 div.mx-2.my-3.flex.flex-row.items-start.rounded-12.bg-gray-main.py-2:has(.chat .font-bold) .caption1{
 color:var(--cc-accent-strong)!important;-webkit-text-fill-color:var(--cc-accent-strong)!important;opacity:1!important;
}
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] blockquote{background:var(--cc-panel-alt)!important;color:var(--cc-text)!important;border-color:var(--cc-stroke)!important}
body.cc-frame-chat-root [data-testid="composer-input-box"]{background:rgba(255,255,255,.96)!important;border:1px solid var(--cc-stroke)!important;border-radius:20px!important;color:var(--cc-text)!important;box-shadow:0 4px 14px #0000000a!important}
body.cc-frame-chat-root [data-testid="composer-input-box"] textarea{background:transparent!important;color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;caret-color:var(--cc-accent-strong)!important}
body.cc-frame-chat-root [data-testid="composer-input-box"] textarea::placeholder{color:var(--cc-muted)!important;-webkit-text-fill-color:var(--cc-muted)!important}
body.cc-frame-chat-root [data-sentry-component="ChatComposer"]{background:transparent!important;background-image:none!important;--tw-gradient-from:transparent!important;--tw-gradient-to:transparent!important}
body.cc-frame-chat-root [role="log"] [data-sentry-component="LeftTextContent"]>button.shrink-0,body.cc-frame-chat-root [role="log"] [data-sentry-component="RightTextContent"]>button.shrink-0{flex-shrink:0!important}
html.cc-tools-ready body.cc-frame-chat-root #cc-edit-shortcut:disabled,html.cc-tools-ready body.cc-frame-chat-root #cc-line-shortcut:disabled{opacity:.4!important}
`;
if(FRAME_CHAT)style.textContent+=`
/* Scene-specific patches verified against the user's diagnostic DOM structure. */
body.cc-frame-chat-root [role="log"] .message-context-menu-trigger.bg-gray-main{
 background:#fff!important;background-image:none!important;color:#8C9097!important;
 border:1px dashed #D4D7DC!important;border-radius:13px!important;
 box-shadow:none!important;padding:12px 14px!important;
}
body.cc-frame-chat-root [role="log"] .message-context-menu-trigger.bg-gray-main :is(p,span,div,em,i){
 color:#94979E!important;-webkit-text-fill-color:#94979E!important;
}
body.cc-frame-chat-root [role="log"] .message-context-menu-trigger.bg-gray-main svg{
 color:var(--cc-accent-strong)!important;
}
/* The scene has no BodyView, so names are attached to directly marked rows. */
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] > .cc-meta{
 display:flex!important;align-items:baseline!important;margin:0 0 6px!important;
 color:var(--cc-text)!important;
}
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] .cc-meta-name{
 font-size:13px!important;font-weight:600!important;color:var(--cc-text)!important;
}
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] .cc-meta-time,
body.cc-frame-chat-root [role="log"] [data-sentry-component="ChatBubbleContainer"] .cc-meta-date{
 font-size:11px!important;
 color:#A0A3A9!important;
 -webkit-text-fill-color:#A0A3A9!important;
}
body.cc-frame-chat-root #cc-toggle,body.cc-frame-chat-root #cc-edit-shortcut,
body.cc-frame-chat-root #cc-line-shortcut{z-index:2147483000!important;visibility:visible!important;display:flex!important;}
body.cc-frame-chat-root #cc-toggle{opacity:1!important;}
/* Fixed floating-control positions: no drag, viewport tracking, or keyboard repositioning. */
body.cc-frame-chat-root #cc-toggle{right:8px!important;bottom:170px!important;left:auto!important;top:auto!important;}
body.cc-frame-chat-root #cc-edit-shortcut{right:8px!important;bottom:214px!important;left:auto!important;top:auto!important;}
body.cc-frame-chat-root #cc-line-shortcut{right:8px!important;bottom:258px!important;left:auto!important;top:auto!important;}
`;
if(FRAME_CHAT)style.textContent+=`
/* Extra frame styles based on the live edit panel and suggestions DOM. */
body.cc-frame-chat-root header,
body.cc-frame-chat-root header nav,
body.cc-frame-chat-root header nav > div{background-color:#fff!important;background-image:none!important;}
body.cc-frame-chat-root header nav{position:relative!important;width:100%!important;min-height:48px!important;}
/* The profile is centered independently of the left-side back button. */
body.cc-frame-chat-root header [data-testid="chat-header-profile"]{
 position:absolute!important;left:50%!important;right:auto!important;top:50%!important;
 transform:translate(-50%,-50%)!important;margin:0!important;z-index:1!important;
}
/* The chat menu remains a native Zeta button; only its visual placement changes. */
body.cc-frame-chat-root header button[aria-label="Open chat menu"]{
 position:absolute!important;right:12px!important;left:auto!important;top:50%!important;
 transform:translateY(-50%)!important;z-index:5!important;
 color:var(--cc-text)!important;
}
body.cc-frame-chat-root header nav > div:has(>button[aria-label="Open chat menu"]){
 position:static!important;margin-left:auto!important;
}
/* Message edit sheet: keep native controls and textarea functional. */
body.cc-frame-chat-root section:has(textarea[name="message"]){
 background:#fff!important;color:var(--cc-text)!important;
 border-color:var(--cc-stroke)!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) > div,
body.cc-frame-chat-root section:has(textarea[name="message"]) > div > div{
 background:#fff!important;background-image:none!important;
 border-color:var(--cc-stroke)!important;color:var(--cc-text)!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) textarea[name="message"]{
 background:#fff!important;color:var(--cc-text)!important;
 -webkit-text-fill-color:var(--cc-text)!important;caret-color:var(--cc-accent-strong)!important;
 border:0!important;outline:0!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) [aria-label="Resize edit area"] > div{
 background:var(--cc-stroke)!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) button[aria-label="Cancel editing"],
body.cc-frame-chat-root section:has(textarea[name="message"]) button[aria-label="Insert asterisk"]{
 background:var(--cc-accent-soft)!important;border:1px solid var(--cc-stroke)!important;
 color:var(--cc-accent-strong)!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) button[aria-label="Save edit"]{
 background:var(--cc-accent-strong)!important;color:#fff!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) button[aria-label="Save edit"]:disabled{
 opacity:.4!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) button:is([aria-label="Cancel editing"],[aria-label="Insert asterisk"]) svg{
 color:var(--cc-accent-strong)!important;
}
body.cc-frame-chat-root section:has(textarea[name="message"]) button[aria-label="Save edit"] svg{
 color:#fff!important;
}
/* Suggested response tray and its generated swipe cards. */
body.cc-frame-chat-root [data-testid="bottom-panel-slot"],
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] > div{
 background:var(--cc-bg)!important;background-image:none!important;color:var(--cc-text)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] .swiper-slide button{
 background:var(--cc-user)!important;border:1px solid var(--cc-stroke)!important;
 box-shadow:none!important;color:var(--cc-text)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] .swiper-slide button :is(p,div,span){
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] .swiper-slide button em{
 color:#96999D!important;-webkit-text-fill-color:#96999D!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] > div > div:last-child{
 background:#fff!important;border-color:var(--cc-stroke)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] [data-remain-count] span{
 color:var(--cc-muted)!important;-webkit-text-fill-color:var(--cc-muted)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] [data-remain-count] span.font-medium{
 color:var(--cc-text)!important;-webkit-text-fill-color:var(--cc-text)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] button[aria-label="See other suggestions"]{
 background:var(--cc-accent-soft)!important;color:var(--cc-accent-strong)!important;
}
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] button[aria-label="See other suggestions"] svg,
body.cc-frame-chat-root [data-testid="bottom-panel-slot"] button[aria-label="Free usage info"] svg{
 color:var(--cc-accent-strong)!important;
}
/* Old time spans are removed by enhanceDates; don't show one during hydration. */
body.cc-frame-chat-root .cc-meta > .cc-meta-time{display:none!important;}
`;
if(OUTER_ROOM)style.textContent+=`
/* Parent fallback controls remain visible until the real scene confirms
   that its own floating buttons exist. The old :has selector otherwise
   hides the parent settings and edit buttons unconditionally. */
html:not(.cc-inner-controls-ready) body #cc-toggle,
html:not(.cc-inner-controls-ready) body #cc-edit-shortcut,
html:not(.cc-inner-controls-ready) body #cc-line-shortcut{display:flex!important;visibility:visible!important;}
/* Never hide the genuine inner-frame buttons. Only hide parent duplicates,
   and ONLY after those frame buttons have confirmed they are present. */
html.cc-inner-controls-ready #cc-toggle,
html.cc-inner-controls-ready #cc-edit-shortcut,
html.cc-inner-controls-ready #cc-line-shortcut,
html.cc-inner-controls-ready #cc-panel,
html.cc-inner-controls-ready #cc-settings-backdrop{display:none!important;}
`;
(document.head||document.documentElement).appendChild(style);
if(FRAME_CHAT)style.textContent+=`
/* Hide ONLY the supplied native bottom bar. All nodes and click handlers stay available. */
/* This targets the exact gray bar, not the floating Clean Cozy shortcuts. */
body.cc-frame-chat-root div.flex.flex-row.items-center.gap-1\.5.px-2.py-1:has(>div.ml-auto button[aria-label="Report message"]):has(button[aria-label="Edit message"]):has(button[aria-label="Regenerate answers"]){display:none!important;}
body.cc-frame-chat-root .cc-native-toolbar-group{display:none!important;}

/* The sidebar floating controls are explicitly preserved. */
body.cc-frame-chat-root #cc-toggle,
body.cc-frame-chat-root #cc-edit-shortcut,
body.cc-frame-chat-root #cc-line-shortcut{display:flex!important;visibility:visible!important;}
/* Iframe native action strip: preserve DOM and handlers but hide its UI. */
body.cc-frame-chat-root .cc-native-toolbar-button,
body.cc-frame-chat-root .cc-native-toolbar-group{display:none!important;}
/* Always keep our settings control and the open menu above the scene overlay. */
body.cc-frame-chat-root #cc-panel:not([hidden]){
 display:block!important;visibility:visible!important;opacity:1!important;
 pointer-events:auto!important;z-index:2147483646!important;
 background:#fff!important;color:#292B2D!important;
}
body.cc-frame-chat-root #cc-toggle{z-index:2147483645!important;pointer-events:auto!important;}
/* New scene: hide only Suggested replies. Keep native Insert asterisk + Send. */
body.cc-frame-chat-root [data-sentry-component="ChatComposer"] button:is([aria-label="Suggested replies"],[aria-label="Get suggestions"],[aria-label="추천 답변"]),
body.cc-frame-chat-root [data-testid="composer-input-box"] button:is([aria-label="Suggested replies"],[aria-label="Get suggestions"],[aria-label="추천 답변"]) {display:none!important;}
body.cc-frame-chat-root [data-testid="composer-input-box"] button[aria-label="Insert asterisk"]{
 display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;
}
/* The native toolbar is mounted outside the chat log and has anonymous icon buttons. */
body.cc-frame-chat-root .cc-native-toolbar-button,
body.cc-frame-chat-root .cc-native-toolbar-group,
body.cc-frame-chat-root .cc-native-snapshot-button {display:none!important;}
`;
if(FRAME_CHAT)style.textContent+=`
/* V46: new iframe chat-profile chooser — exact live portal DOM, light theme only. */
body.cc-frame-chat-root #portal-container > div:has(section[role="dialog"][aria-label="대화 프로필"]) > div.relative[class*="bg-gray-sub1"]{
 background:#FFFFFF!important;background-image:none!important;color:var(--cc-text)!important;
 border-color:transparent!important;box-shadow:none!important;
}
body.cc-frame-chat-root #portal-container > div:has(section[role="dialog"][aria-label="대화 프로필"]) > div.relative[class*="bg-gray-sub1"] > div:first-child svg{
 color:#B8BCC2!important;-webkit-text-fill-color:#B8BCC2!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"]{
 background:#FFFFFF!important;color:var(--cc-text)!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] h3{
 color:#737981!important;-webkit-text-fill-color:#737981!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] [class~="bg-white/5"]{
 background:#FAFAFB!important;background-image:none!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] [class~="bg-white/[8%]"]{
 background:var(--cc-accent-soft)!important;background-image:none!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] [role="group"][aria-label="My chat profiles"] > div.relative{
 background:#FAFAFB!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] [role="group"][aria-label="My chat profiles"] > div[class~="bg-white/5"]{
 background:transparent!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] [role="group"][aria-label="My chat profiles"] > div[class~="bg-white/5"] > .h-px{
 background:var(--cc-stroke)!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] :is(.body1,.body14,.text-gray-200),
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] button :is(.body1,.body14,.text-gray-200){
 color:#30343A!important;-webkit-text-fill-color:#30343A!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] :is(.caption1,[class~="text-white/50"]){
 color:#7A7F86!important;-webkit-text-fill-color:#7A7F86!important;opacity:1!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] button[aria-label^="edit-"] svg{
 color:#737981!important;-webkit-text-fill-color:#737981!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] button:active{
 background:var(--cc-accent-soft)!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] .bg-primary-400{
 background:var(--cc-accent-strong)!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] .bg-primary-400 svg{
 color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] button > div.flex.size-12[class*="bg-white/"]{
 background:var(--cc-accent-soft)!important;
}
body.cc-frame-chat-root section[role="dialog"][aria-label="대화 프로필"] button > div.flex.size-12[class*="bg-white/"] svg{
 color:var(--cc-accent-strong)!important;-webkit-text-fill-color:var(--cc-accent-strong)!important;
}
`;
let panel=null,toggle=null,editShortcut=null,settingsBackdrop=null,observer=null,scheduled=false;
const sendOriginals=new Map();
function makeSendArrow(){
 const svg=document.querySelector('[data-testid="chat-send-button"] svg');
 if(!svg)return;
 if(!sendOriginals.has(svg))sendOriginals.set(svg,{html:svg.innerHTML,viewBox:svg.getAttribute('viewBox'),fill:svg.getAttribute('fill')});
 if(svg.dataset.ccArrow==='1')return;
 svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('fill','none');
 while(svg.firstChild)svg.removeChild(svg.firstChild);
 const line=document.createElementNS('http://www.w3.org/2000/svg','path');
 line.setAttribute('d','M12 19V5M5 12l7-7 7 7');
 line.setAttribute('stroke','currentColor');
 line.setAttribute('stroke-width','2.3');
 line.setAttribute('stroke-linecap','round');
 line.setAttribute('stroke-linejoin','round');
 svg.appendChild(line);svg.dataset.ccArrow='1';
}
const actionButtons=new Map();
const marked=new Set();
function save(){
 persistSettingsLocal();
 if(OUTER_ROOM)sendToCozyScene('settings',ccSettingsSnapshot);
 else if(FRAME_CHAT)sendToCozyOuter('settings-sync',ccSettingsSnapshot);
}
/* Reliable inline dialogue highlighting for desktop and mobile.
   Keep the inline spans mounted when toggled off. CSS alone controls visibility.
   This avoids a remove/re-wrap race when Zeta re-renders its messages. */
const dialogueInlineClass='cc-dialogue-inline';
let dialogueUpdating=false;
function clearInlineDialogue(){
 const spans=document.querySelectorAll('span.'+dialogueInlineClass);
 for(const span of spans){
  if(!span.isConnected)continue;
  span.replaceWith(...Array.from(span.childNodes));
 }
}
function updateDialogueHighlight(){
 if(!settings.dialogueHighlight || dialogueUpdating)return;
 const room=document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)');
 if(!room)return;
 dialogueUpdating=true;
 try{
  const chats=room.querySelectorAll(
   '[data-sentry-component="LeftTextContent"] [data-sentry-component="ChatBubbleContainer"] .chat,'+
   '[data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"] .chat'
  );
  for(const chat of chats){
   // Loading indicators in a *different* Swiper slide must not block
   // completed dialogue in this slide. Zeta keeps the next-slide spinner
   // mounted even after the visible candidate has finished rendering.
   const slide=chat.closest('.swiper-slide');
   if(slide?.querySelector('[data-testid="message-loading"]'))continue;
   // Outside a carousel, skip a chat only when its own BodyView is loading.
   if(!slide && chat.closest('[data-sentry-component="BodyView"]')?.querySelector('[data-testid="message-loading"]'))continue;
   const walker=document.createTreeWalker(chat,NodeFilter.SHOW_TEXT);
   const nodes=[];
   let node;
   while((node=walker.nextNode())){
    if(!node.nodeValue?.trim())continue;
    const parent=node.parentElement;
    if(!parent || parent.closest('em,i,blockquote,.cc-letter,.cc-letter-meta,[contenteditable],.'+dialogueInlineClass))continue;
    // Exclude labels or metadata added by the theme.
    if(parent.closest('.cc-meta,.cc-meta-date,.cc-letter-time'))continue;
    nodes.push(node);
   }
   for(const textNode of nodes){
    if(!textNode.isConnected || textNode.parentElement?.closest('.'+dialogueInlineClass))continue;
    const span=document.createElement('span');
    span.className=dialogueInlineClass;
    textNode.parentNode.insertBefore(span,textNode);
    span.appendChild(textNode);
   }
  }
 }catch(error){console.warn('[Clean Cozy] 형광펜 적용 중 오류',error);}
 finally{dialogueUpdating=false;}
}

function applyOpts(){
 const root=document.documentElement;
 root.classList.toggle('cc-avatar-hidden',settings.avatarMode==='none');
 root.classList.toggle('cc-avatar-user-hidden',settings.avatarMode==='userHidden'||settings.avatarMode==='userHiddenHeart');
 root.classList.toggle('cc-avatar-heart',settings.avatarMode==='userHiddenHeart');
 root.classList.toggle('cc-dialogue-highlight',settings.dialogueHighlight===true);
 updateDialogueHighlight();
 if(panel)for(const input of panel.querySelectorAll('input[name="cc-avatar-mode"]'))input.checked=input.value===settings.avatarMode;
 const highlightInput=panel?.querySelector('#cc-dialogue-highlight-toggle');
 if(highlightInput)highlightInput.checked=settings.dialogueHighlight===true;
 const narrationInput=panel?.querySelector('#cc-remove-narration-toggle');
 if(narrationInput)narrationInput.checked=settings.removeNarration===true;
 if(panel)for(const input of panel.querySelectorAll('input[name="cc-line-break-mode"]'))input.checked=input.value===settings.lineBreakMode;
}
const frameCapturedTimes=new WeakMap();
function getTime(body){
 const node=body.querySelector('time[datetime], [data-timestamp], [datetime]');
 if(!node){const observed=frameCapturedTimes.get(body);return observed?new Date(observed).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'}):'';}
 const dt=node.getAttribute('datetime')||node.getAttribute('data-timestamp');
 if(!dt)return '';
 let date=new Date(dt);
 if(!Number.isFinite(date.getTime())&&/^\d{10,13}$/.test(dt))date=new Date(Number(dt)*(dt.length===10?1000:1));
 if(!Number.isFinite(date.getTime()))return '';
 return date.toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});
}

/* Record only the local clock time of future sends; no Zeta API access. */
const LETTER_STORE='zeta-clean-cozy-letter-send-times-v1';
let letterTimes={};
try{const saved=JSON.parse(localStorage.getItem(LETTER_STORE)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))letterTimes=saved;}catch(e){}
let pendingSend=null;
/* Separate, bounded history for character letters. No message content is stored. */
const CHARACTER_LETTER_STORE='zeta-clean-cozy-character-letter-first-seen-v1';
let characterLetterTimes={};
try{
 const saved=JSON.parse(localStorage.getItem(CHARACTER_LETTER_STORE)||'{}');
 if(saved&&typeof saved==='object'&&!Array.isArray(saved))characterLetterTimes=saved;
}catch(e){}
const characterTransientTimes=new WeakMap();
function characterLetterTime(body){
 const real=getTime(body);
 if(real)return real;
 const raw=messageKey(body);
 const scoped=raw?location.pathname+'::'+raw:'';
 // A current or previously stored turn is the source of truth when available.
 let iso=turnStampForBody(body);
 if(!iso)iso=(scoped&&characterLetterTimes[scoped])||characterTransientTimes.get(body);
 if(!iso||!Number.isFinite(new Date(iso).getTime())){
  // Existing behavior: unknown old letters show first-observed time.
  // Such a timestamp never turns an old message into "today".
  iso=new Date().toISOString();
  characterTransientTimes.set(body,iso);
 }
 return new Date(iso).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});
}
// A new scene row no longer exposes message IDs. Fingerprint its rendered message
// locally (never store the message text) so timestamps survive a page reload.
function frameMessageKey(body){
 const bubble=body.querySelector('[data-sentry-component="ChatBubbleContainer"]');
 if(!bubble)return '';
 const chat=bubble.querySelector('.chat');
 // Ignore labels/cards injected by this theme, so the key stays identical
 // before and after rendering or when the theme is toggled.
 const copy=(chat||bubble).cloneNode(true);
 copy.querySelectorAll('.cc-meta,.cc-letter-meta,.cc-meta-date,.cc-meta-time').forEach(x=>x.remove());
 let content=(copy.textContent||'').replace(/\s+/g,' ').trim();
 if(!content)return '';
 let hash=2166136261;
 for(let i=0;i<content.length;i++){
  hash^=content.charCodeAt(i);
  hash=Math.imul(hash,16777619);
 }
 return 'scene-'+(body.matches('[data-sentry-component="RightTextContent"]')?'u':'c')+'-'+content.length+'-'+(hash>>>0).toString(36);
}
function messageKey(body){
 // Prefer stable Zeta identifiers where they exist; otherwise use the rendered
 // text's local fingerprint in the new iframe. No Zeta API or hidden state.
 const view=body.closest('[data-sentry-component="BodyView"]');
 if(view?.id?.startsWith('message-'))return view.id;
 const outer=body.closest('[data-key], [id^="message-"]');
 const raw=outer?.getAttribute('data-key')||outer?.id||'';
 if(raw.startsWith('message-'))return raw;
 return FRAME_CHAT?frameMessageKey(body):'';
}
function storeLetterTime(key,iso){
 if(!key||!iso)return;
 letterTimes[key]=iso;
 const entries=Object.entries(letterTimes);
 if(entries.length>400)letterTimes=Object.fromEntries(entries.slice(-400));
 try{localStorage.setItem(LETTER_STORE,JSON.stringify(letterTimes));}catch(e){}
}
function readLetterTime(body){
 const real=getTime(body);
 if(real)return real;
 const saved=turnStampForBody(body)||letterTimes[messageKey(body)];
 if(!saved)return '';
 const date=new Date(saved);
 return Number.isFinite(date.getTime())?date.toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'}):'';
}
function captureSend(){
 if(!document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)'))return;
 const input=document.querySelector('[data-testid="composer-input-box"] textarea');
 if(!input||!input.value.trim())return;
 const known=new Set([...document.querySelectorAll('[data-sentry-component="RightTextContent"]')].map(messageKey).filter(Boolean));
 pendingSend={time:new Date().toISOString(),known,created:Date.now(),frameKnown:FRAME_CHAT?new WeakSet([...document.querySelectorAll('[role="log"] [data-sentry-component="LeftTextContent"],[role="log"] [data-sentry-component="RightTextContent"]')]):null};
 beginTurnCapture(pendingSend.time);
}
function onSendClick(event){
 const btn=event.target.closest?.('button');
 if(!btn)return;
 const composer=document.querySelector('[data-testid="composer-input-box"]');
 const dock=composer?.parentElement?.parentElement;
 const label=(btn.getAttribute('aria-label')||'').toLowerCase();
 const isSend=btn.matches('[data-testid="chat-send-button"],button[type="submit"]') ||
   /^(send|send message|메시지 전송|전송하기|보내기)$/.test(label) ||
   (FRAME_CHAT&&dock?.contains(btn)&&!btn.disabled&&
      !btn.matches('[aria-label="Insert asterisk"],[aria-label="Save edit"],[aria-label="Cancel editing"]')&&
      btn.querySelector('svg path[d^="M"]')&&
      btn.getBoundingClientRect().right>composer.getBoundingClientRect().right-64 &&
      btn.getBoundingClientRect().bottom>=composer.getBoundingClientRect().top);
 if(isSend)captureSend();
}
function onSendKey(event){
 if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.target.matches?.('[data-testid="composer-input-box"] textarea'))captureSend();
}
/* V40: Present the actual character name in the room header, without editing the plot title. */
let previousHeaderElement=null;
let previousHeaderText='';
let appliedHeaderText='';
function enhanceHeader(){
 const header=document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-testid="chat-header-profile"] span');
 if(!header)return;
 const characterBody=document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="LeftTextContent"]');
 if(!characterBody)return;
 const avatarName=characterBody.querySelector('button img[alt]')?.getAttribute('alt')?.trim()||'';
 const displayedName=characterBody.querySelector('.cc-meta-name')?.textContent?.trim()||
  characterBody.querySelector('.caption1')?.textContent?.trim()||(FRAME_CHAT?frameName(characterBody):'')||'';
 const validName=name=>Boolean(name&&!/^#[0-9a-f]{3,8}$/i.test(name)&&name!=='­');
 const name=[avatarName,displayedName].find(validName);
 if(!name)return;
 if(header!==previousHeaderElement){
  previousHeaderElement=header;
  previousHeaderText=header.textContent||'';
  appliedHeaderText='';
 }
 if(header.textContent!==name){
  // Save React's newest header title when it changes outside our code.
  if(header.textContent!==appliedHeaderText)previousHeaderText=header.textContent||'';
  header.textContent=name;
 }
 appliedHeaderText=name;
}
function restoreHeader(){
 if(previousHeaderElement?.isConnected&&previousHeaderElement.textContent===appliedHeaderText){
  previousHeaderElement.textContent=previousHeaderText;
 }
 previousHeaderElement=null;
}
function enhanceLetters(){
 const bodies=document.querySelectorAll('[data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]');
 for(const body of bodies){
  const bubble=body.querySelector('[data-sentry-component="ChatBubbleContainer"]');
  if(!bubble)continue;
  const quotes=bubble.querySelectorAll('blockquote');
  if(!quotes.length)continue;
  const isUser=body.matches('[data-sentry-component="RightTextContent"]');
  const key=messageKey(body);
  const ownName=body.querySelector('.cc-meta-name')?.textContent?.trim()||body.querySelector('.caption1')?.textContent?.trim()||(FRAME_CHAT?frameName(body):'');
  // Prefer the character's actual chat identity, NOT the plot/room title.
  // Avatar alt is the most reliable identity across rooms with blank or hex-color plot names.
  const characterBody=document.querySelector('[data-sentry-component="LeftTextContent"]');
  const avatarName=characterBody?.querySelector(':scope button img[alt]')?.getAttribute('alt')?.trim()||'';
  const displayedCharacter=characterBody?.querySelector('.cc-meta-name')?.textContent?.trim()||
   characterBody?.querySelector('.caption1')?.textContent?.trim()||'';
  const plotTitle=document.querySelector('[data-testid="chat-header-profile"] span')?.textContent?.trim()||'';
  const validName=name=>Boolean(name&&!/^#[0-9a-f]{3,8}$/i.test(name)&&name!=='­');
  const roomCharacter=[avatarName,displayedCharacter,plotTitle].find(validName)||'캐릭터';
  const roomUser=document.querySelector('[data-sentry-component="RightTextContent"] .cc-meta-name')?.textContent?.trim()||'나';
  const sender=isUser?(ownName||roomUser):(ownName||roomCharacter);
  const recipient=isUser?roomCharacter:roomUser;
  const time=isUser?readLetterTime(body):characterLetterTime(body);
  for(const quote of quotes){
   quote.classList.add('cc-letter');
   let header=quote.querySelector(':scope > .cc-letter-meta');
   if(!header){header=document.createElement('div');header.className='cc-letter-meta';quote.prepend(header);}
   const signature=sender+'|'+recipient+'|'+time;
   if(header.dataset.signature!==signature){
    header.replaceChildren();
    const stamp=document.createElement('span');stamp.className='cc-letter-stamp';stamp.textContent='✉';
    const who=document.createElement('span');who.textContent=sender+' → '+recipient;
    header.append(stamp,who);
    if(time){const timestamp=document.createElement('span');timestamp.className='cc-letter-time';timestamp.textContent='· '+time;header.append(timestamp);}
    header.dataset.signature=signature;
   }
  }
 }
 if(pendingSend&&Date.now()-pendingSend.created>60000)pendingSend=null;
}

/* V27: one timestamp per user+character TURN, max 300 turns.
   No internal APIs. No automated actions. Only DOM read + user-initiated Send event.
   A BodyView can contain multiple LeftTextContent bubbles; all share its turn.
   Existing V15–V26 stores are left untouched (read-only fallbacks for letters). */
const TURN_STORE='zeta-clean-cozy-turn-dates-v1';
const TURN_LIMIT=300;
let turns=[];
try{
 // On zeta-ai.io this is the authoritative persistent store.
 // In the iframe this is read only once as a migration source for v1.7.2.
 const loaded=JSON.parse(localStorage.getItem(TURN_STORE)||'[]');
 if(Array.isArray(loaded))turns=loaded.filter(x=>x&&typeof x==='object'&&typeof x.room==='string'&&typeof x.time==='string'&&typeof x.user==='string').slice(-TURN_LIMIT);
}catch(e){}

function normalizeTurnScopedKey(value,room){
 if(typeof value!=='string')return value;
 const split=value.indexOf('::');
 return split>=0?room+'::'+value.slice(split+2):value;
}
function cleanTurnRows(list,room){
 if(!Array.isArray(list))return [];
 const clean=[];
 for(const row of list){
  if(!row||row.room!==room||typeof row.time!=='string'||typeof row.user!=='string')continue;
  const copy={room,user:normalizeTurnScopedKey(row.user,room),time:row.time};
  if(Number.isFinite(Number(row.userIndex)))copy.userIndex=Number(row.userIndex);
  if(typeof row.character==='string')copy.character=normalizeTurnScopedKey(row.character,room);
  if(Array.isArray(row.characters)){
   copy.characters=[...new Set(row.characters
    .filter(v=>typeof v==='string')
    .map(v=>normalizeTurnScopedKey(v,room)))];
  }
  clean.push(copy);
 }
 return clean.slice(-TURN_LIMIT);
}
function mergeTurnRows(base,incoming){
 const merged=base.map(row=>({...row,characters:Array.isArray(row.characters)?[...row.characters]:row.characters}));
 for(const row of incoming){
  // A user turn is identified only by its stable rendered message key.
  // data-index is a virtual-list position and may be reused by a later message.
  const found=merged.find(x=>x.room===row.room&&x.user===row.user);
  if(!found){merged.push(row);continue;}
  if(!found.time&&row.time)found.time=row.time;
  if(Number.isFinite(row.userIndex))found.userIndex=row.userIndex;
  if(!found.character&&row.character)found.character=row.character;
  const chars=new Set([
   ...(Array.isArray(found.characters)?found.characters:[]),
   ...(found.character?[found.character]:[]),
   ...(Array.isArray(row.characters)?row.characters:[]),
   ...(row.character?[row.character]:[])
  ]);
  if(chars.size)found.characters=[...chars];
 }
 return merged.slice(-TURN_LIMIT);
}
function roomTurnRows(room){
 return turns.filter(row=>row.room===room);
}
function syncTurnStoreToOuter(){
 if(!FRAME_CHAT||!/^\/rooms\/[^/?#]+$/.test(turnRoomKey()))return false;
 return sendToCozyOuter('turn-sync',{room:turnRoomKey(),turns:roomTurnRows(turnRoomKey())});
}
function mergeOuterTurnStore(payload){
 if(FRAME_CHAT||!OUTER_ROOM||!payload||typeof payload!=='object')return;
 const room=typeof payload.room==='string'?payload.room.trim():'';
 if(!/^\/rooms\/[^/?#]+$/.test(room)||room!==outerStableRoomKey())return;
 const incoming=cleanTurnRows(payload.turns,room);
 turns=mergeTurnRows(turns,incoming);
 saveTurns();
 sendToCozyScene('turn-store',{room,turns:roomTurnRows(room)});
}
function receiveOuterTurnStore(payload){
 if(!FRAME_CHAT||!payload||typeof payload!=='object')return;
 const room=typeof payload.room==='string'?payload.room.trim():'';
 if(!room||room!==ccStableRoomKey)return;
 const incoming=cleanTurnRows(payload.turns,room);
 const current=cleanTurnRows(roomTurnRows(room),room);
 if(JSON.stringify(current)===JSON.stringify(incoming))return;
 turns=[...turns.filter(row=>row.room!==room),...incoming].slice(-TURN_LIMIT);
 resetTurnRoom();
 enhanceDates();
}
let turnPending=null;
let dateRefreshTimer=null;
let turnRoomPath='';
let knownViewKeys=new Set();
let knownViewElements=new WeakSet();
const liveTurnTimes=new WeakMap();
function currentRoomMessageBodies(){
 return document.querySelectorAll(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) :is([data-sentry-component="LeftTextContent"],[data-sentry-component="RightTextContent"])');
}
// Use the stable outer /rooms/<id> route whenever available.
// The iframe #run value is only a temporary fallback during initial hydration.
function turnRoomKey(){
 if(!FRAME_CHAT)return OUTER_ROOM?outerStableRoomKey():location.pathname;
 if(ccStableRoomKey)return ccStableRoomKey;
 const run=location.hash.match(/(?:^#|[&?])run=([^&]+)/)?.[1]||'';
 return location.origin+location.pathname+'#run='+run;
}

function migrateTurnScopedKey(value,oldKey,newKey){
 if(typeof value!=='string')return value;
 return value.startsWith(oldKey+'::')?newKey+value.slice(oldKey.length):value;
}
function migrateTurnRoomKey(oldKey,newKey){
 let changed=false;
 for(const row of turns){
  if(row.room!==oldKey)continue;
  row.room=newKey;
  row.user=migrateTurnScopedKey(row.user,oldKey,newKey);
  if(typeof row.character==='string')row.character=migrateTurnScopedKey(row.character,oldKey,newKey);
  if(Array.isArray(row.characters))row.characters=row.characters.map(v=>migrateTurnScopedKey(v,oldKey,newKey));
  changed=true;
 }
 if(changed)saveTurns();
}
function viewOf(body){return body.closest('[data-sentry-component="BodyView"]')||(FRAME_CHAT?body:null);}
function rowOf(body){return viewOf(body)?.closest('[data-index]');}
function rowIndex(body){
 const value=rowOf(body)?.getAttribute('data-index');
 return value===null||value===undefined?NaN:Number(value);
}
function scopedKey(body){
 const id=messageKey(body);
 return id?turnRoomKey()+'::'+id:'';
}
function resetTurnRoom(){
 turnRoomPath=turnRoomKey();
 knownViewKeys=new Set();
 knownViewElements=new WeakSet();
 for(const body of currentRoomMessageBodies()){
  const view=viewOf(body);
  if(view)knownViewElements.add(view);
  const key=scopedKey(body);
  if(key)knownViewKeys.add(key);
 }
 turnPending=null;
}
function beginTurnCapture(iso){
 if(turnRoomPath!==turnRoomKey())resetTurnRoom();
 const known=new Set(knownViewKeys);
 const knownElements=new WeakSet();
 for(const body of currentRoomMessageBodies()){
  const view=viewOf(body);
  if(view)knownElements.add(view);
  const key=scopedKey(body);
  if(key)known.add(key);
 }
 turnPending={room:turnRoomKey(),time:iso,started:Date.now(),known,knownElements,user:null,userView:null,userIndex:NaN,characterFound:false};
}
function saveTurns(){
 if(turns.length>TURN_LIMIT)turns=turns.slice(-TURN_LIMIT);
 if(FRAME_CHAT){
  // The iframe keeps only the in-memory working copy.
  // Persistent writes live on zeta-ai.io so Safari refreshes do not lose them.
  syncTurnStoreToOuter();
  return;
 }
 try{localStorage.setItem(TURN_STORE,JSON.stringify(turns));}catch(e){}
}
function recordUserTurn(body,time){
 const user=scopedKey(body);
 if(!user)return null;
 const index=rowIndex(body);
 // The rendered message key is the identity. data-index is NOT identity.
 const existing=turns.find(x=>x.room===turnRoomKey()&&x.user===user);
 if(existing){
  if(Number.isFinite(index)&&existing.userIndex!==index){
   existing.userIndex=index;
   saveTurns();
  }
  return existing;
 }
 const record={room:turnRoomKey(),user,time};
 if(Number.isFinite(index))record.userIndex=index;
 turns.push(record);
 saveTurns();
 return record;
}
function turnForBody(body){
 const key=scopedKey(body);
 const isUser=body.matches('[data-sentry-component="RightTextContent"]');
 if(isUser){
  // User messages must never inherit a timestamp from a reused virtual row index.
  return key?turns.find(x=>x.room===turnRoomKey()&&x.user===key)||null:null;
 }
 // Character messages must prefer their exact rendered key.
 // Never let a recycled virtual-list data-index steal an older turn's date.
 if(!key)return null;
 return turns.find(x=>x.room===turnRoomKey()&&
  (x.character===key||x.characters?.includes(key)))||null;
}
function recoverUserTurnFromFollowingCharacter(body,bodies){
 if(!FRAME_CHAT||!body.matches('[data-sentry-component="RightTextContent"]'))return null;
 const userKey=scopedKey(body);
 if(!userKey)return null;
 const start=bodies.indexOf(body);
 if(start<0)return null;
 // After a reload the user's local fingerprint can be rebuilt later than the
 // persisted turn store. Recover it only from the immediately following visible
 // character reply whose exact character key is already stored for that turn.
 for(let i=start+1;i<bodies.length;i++){
  const candidate=bodies[i];
  if(candidate.matches('[data-sentry-component="RightTextContent"]'))break;
  if(!candidate.matches('[data-sentry-component="LeftTextContent"]'))continue;
  const characterKey=scopedKey(candidate);
  if(!characterKey)continue;
  const row=turns.find(x=>x.room===turnRoomKey()&&
   (x.character===characterKey||x.characters?.includes(characterKey)));
  if(!row)continue;
  let changed=false;
  if(row.user!==userKey){row.user=userKey;changed=true;}
  const index=rowIndex(body);
  if(Number.isFinite(index)&&row.userIndex!==index){row.userIndex=index;changed=true;}
  if(changed)saveTurns();
  return row;
 }
 return null;
}
function turnStampForBody(body){
 const view=viewOf(body);
 const found=turnForBody(body);
 return found?.time||(view?liveTurnTimes.get(view):'')||'';
}
function relativeDate(iso){
 const stamp=new Date(iso);
 if(!Number.isFinite(stamp.getTime()))return '';
 const now=new Date();
 const days=Math.round((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(stamp.getFullYear(),stamp.getMonth(),stamp.getDate()))/86400000);
 return days<0?'':days===0?'today':days===1?'1 day ago':days+' days ago';
}
function nearestUserTurn(body){
 const index=rowIndex(body);
 if(!Number.isFinite(index))return null;
 // In Zeta's supplied HTML the next character BodyView is index user+1.
 // Compare rendered rows, never treat merely newly virtualized history as a reply.
 const users=[...currentRoomMessageBodies()].filter(x=>x.matches('[data-sentry-component="RightTextContent"]'));
 let best=null,bestIndex=-Infinity;
 for(const userBody of users){
  const userIndex=rowIndex(userBody);
  if(userIndex>=index||userIndex<=bestIndex)continue;
  const row=turnForBody(userBody);
  if(!row)continue;
  best=row;bestIndex=userIndex;
 }
 return best&&index-bestIndex<=2?best:null;
}
function enhanceDates(){
 if(!document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)'))return;
 if(turnRoomPath!==turnRoomKey())resetTurnRoom();
 if(turnPending&&(turnPending.room!==turnRoomKey()||Date.now()-turnPending.started>180000))turnPending=null;
 const bodies=[...currentRoomMessageBodies()];
 // Resolve newly rendered user view first, independently of DOM query order.
 if(turnPending&&!turnPending.user){
  for(const body of bodies){
   if(!body.matches('[data-sentry-component="RightTextContent"]'))continue;
   const view=viewOf(body),key=scopedKey(body);
   if(!view||!key||turnPending.known.has(key)||turnPending.knownElements.has(view))continue;
   const record=recordUserTurn(body,turnPending.time);
   if(!record)continue;
   turnPending.user=record;
   turnPending.userView=view;
   turnPending.userIndex=rowIndex(body);
   liveTurnTimes.set(view,record.time);
   break;
  }
 }
 // One character BodyView can hold 1, 2, or more bubbles.
 // Attach at most once to the user turn immediately preceding it.
 for(const body of bodies){
  if(!body.matches('[data-sentry-component="LeftTextContent"]'))continue;
  const view=viewOf(body);
  if(!view)continue;
  const key=scopedKey(body);
  // During iframe streaming the rendered text fingerprint changes every few tokens.
  // A partial fingerprint can temporarily equal an older saved reply, so DOM element
  // identity is the safer signal that this is the newly generated reply.
  const isFresh=!!(turnPending&&turnPending.user&&(
   FRAME_CHAT?!turnPending.knownElements.has(view):(key?!turnPending.known.has(key):!turnPending.knownElements.has(view))
  ));
  const idx=rowIndex(body);
  const adjacent=FRAME_CHAT?isFresh:(isFresh&&Number.isFinite(idx)&&Number.isFinite(turnPending.userIndex)&&idx>turnPending.userIndex&&idx-turnPending.userIndex<=2);
  if(adjacent){
   const record=turnPending.user;
   liveTurnTimes.set(view,record.time);
   if(key){
    if(!record.character)record.character=key;
    if(!Array.isArray(record.characters))record.characters=[];
    if(!record.characters.includes(key)){record.characters.push(key);saveTurns();}
   }
   turnPending.characterFound=true;
  }else if(!turnForBody(body)){
   // Recover stable local-reply ids, when user and character share the same visible turn.
   const match=nearestUserTurn(body);
   if(match){
    liveTurnTimes.set(view,match.time);
    if(key){
     let changed=false;
     if(!match.character){match.character=key;changed=true;}
     if(!Array.isArray(match.characters))match.characters=[];
     if(!match.characters.includes(key)){match.characters.push(key);changed=true;}
     if(changed)saveTurns();
    }
   }
  }
 }
 for(const body of bodies){
  const view=viewOf(body),key=scopedKey(body);
  if(body.matches('[data-sentry-component="RightTextContent"]')){
   // Exact user key is preferred. If a reload rebuilt that key differently,
   // repair it from the exact stored key of the immediately following reply.
   const matched=turnForBody(body)||recoverUserTurnFromFollowingCharacter(body,bodies);
   const idx=rowIndex(body);
   if(matched&&Number.isFinite(idx)&&matched.userIndex!==idx){
    matched.userIndex=idx;
    if(key)matched.user=key;
    saveTurns();
   }
  }
  if(view)knownViewElements.add(view);
  if(key)knownViewKeys.add(key);
  const bubble=body.querySelector('[data-sentry-component="ChatBubbleContainer"]');
  if(!bubble)continue;
  let meta=bubble.querySelector(':scope > .cc-meta');
  if(!meta&&FRAME_CHAT){
   const name=frameName(body);
   if(name){
    meta=document.createElement('div');meta.className='cc-meta';
    const nameNode=document.createElement('span');nameNode.className='cc-meta-name';nameNode.textContent=name;
    meta.appendChild(nameNode);bubble.prepend(meta);
    const nativeName=frameNameLabel(body);
    if(nativeName){nativeName.classList.add('cc-name-hidden');marked.add(nativeName);}
   }
  }
  if(!meta)continue;
  let stamp='';
  // A character reply that belongs to the currently pending send must display
  // that send's time while it is streaming. Its partial text fingerprint may
  // temporarily collide with an older saved reply, so do not let persisted
  // history override the live pending turn.
  if(FRAME_CHAT&&turnPending&&turnPending.user&&
     body.matches('[data-sentry-component="LeftTextContent"]')&&
     view&&!turnPending.knownElements.has(view)&&
     Date.now()-turnPending.started<180000){
   stamp=turnPending.time;
   liveTurnTimes.set(view,stamp);
  }
  if(!stamp)stamp=turnStampForBody(body)||(FRAME_CHAT?frameCapturedTimes.get(body):null);
  // In the iframe, React can replace an outgoing user's DOM row before the
  // room's stable local fingerprint is ready. Capture only genuinely NEW rows.
  if(!stamp&&FRAME_CHAT&&turnPending&&Date.now()-turnPending.started<60000){
   const isNew=key?!turnPending.known.has(key):!turnPending.knownElements.has(view);
   if(isNew&&body.matches('[data-sentry-component="RightTextContent"]')){
    stamp=turnPending.time;
    if(view)liveTurnTimes.set(view,stamp);
    if(key&&!turnPending.user){turnPending.user=recordUserTurn(body,stamp);turnPending.userView=view;}
   }
  }
  const label=stamp?relativeDate(stamp):'';
  // The chat name shows only relative day; absolute clock belongs to letter cards.
  const obsoleteClock=meta.querySelector(':scope > .cc-meta-time');
  if(obsoleteClock)obsoleteClock.remove();
  let tag=meta.querySelector(':scope > .cc-meta-date');
  if(label){
   if(!tag){tag=document.createElement('span');tag.className='cc-meta-date';meta.appendChild(tag);}
   if(tag.textContent!=='· '+label)tag.textContent='· '+label;
  }else if(tag)tag.remove();
 }
 if(turnPending?.characterFound&&!FRAME_CHAT)turnPending=null;
 if(pendingSend&&Date.now()-pendingSend.created>60000)pendingSend=null;
}

function enhance(){
 const bodies=document.querySelectorAll('[data-sentry-component="LeftTextContent"],[data-sentry-component="RightTextContent"]');
 for(const body of bodies){
  const bubble=body.querySelector('[data-sentry-component="ChatBubbleContainer"]');
  if(!bubble||bubble.querySelector(':scope>.cc-meta'))continue;
  // Only attach a local clock to new rows rendered immediately after an actual send.
  // Do not invent timestamps for already-existing messages.
  if(FRAME_CHAT&&pendingSend?.frameKnown&&Date.now()-pendingSend.created<30000&&!pendingSend.frameKnown.has(body)){
   frameCapturedTimes.set(body,pendingSend.time);pendingSend.frameKnown.add(body);
  }
  const label=body.querySelector('.caption1')||(FRAME_CHAT?frameNameLabel(body):null);
  const name=label?.textContent?.trim()||(FRAME_CHAT?frameName(body):'');
  if(!name)continue;
  const meta=document.createElement('div');meta.className='cc-meta';meta.setAttribute('aria-label','메시지 작성자');
  const nameSpan=document.createElement('span');nameSpan.className='cc-meta-name';nameSpan.textContent=name;meta.appendChild(nameSpan);
  const time=getTime(body);
  if(time){const timeSpan=document.createElement('span');timeSpan.className='cc-meta-time';timeSpan.textContent='· '+time;meta.appendChild(timeSpan);}
  bubble.insertBefore(meta,bubble.firstChild);
  if(label){label.classList.add('cc-name-hidden');marked.add(label);}
 }
}

/* V32: Line tool is a user-clicked, local presentation formatter.
   No network calls, no automated native button clicks, no Zeta data changes.
   If the native editing textarea is open, format its draft; user manually saves. */
let lineShortcut=null;
function compactMarkdownPlain(raw){
 let t=raw.replace(/\r\n?/g,'\n').trim();
 if(!t)return t;
 // Compact ordinary text while preserving the original quote-card separation.
 t=t.replace(/[ \t]*\n[ \t]*/g,' ').replace(/[ \t]{2,}/g,' ');
 t=t.replace(/(^|\s)>[ \t]*(?=\S)/g,'\n> ');
 t=t.replace(/(>[^\n]*?)\s+(?=\*[^*\n]+\*)/g,'$1\n');
 const lines=t.split('\n').map(x=>x.trim()).filter(Boolean);
 const result=[];
 for(const line of lines){
  if(/^>/.test(line))result.push(line);
  else if(result.length&&/^>/.test(result[result.length-1]))result.push(line);
  else if(result.length)result[result.length-1]+=' '+line;
  else result.push(line);
 }
 return result.map((line,i)=>{
  if(i===0)return line;
  const previous=result[i-1];
  return (line.startsWith('>')&&previous.startsWith('>')?'\n':'\n\n')+line;
 }).join('');
}
function spaciousMarkdownPlain(raw){
 const compact=compactMarkdownPlain(raw);
 if(!compact)return compact;
 // Keep quote blocks exactly on the existing compact rules. Only ordinary
 // roleplay text gets extra breathing room between *action* and dialogue.
 const chunks=compact.split(/\n\n+/);
 const formatRoleplayChunk=(source)=>{
  source=source.trim();
  if(!source||source.startsWith('>'))return source;
  const tokens=[];
  let buffer='';
  const flush=()=>{
   const value=buffer.trim();
   if(value)tokens.push(value);
   buffer='';
  };
  for(let i=0;i<source.length;){
   const isOpen=source[i]==='*'&&source[i-1]!=='*'&&source[i-1]!=='\\'&&source[i+1]!=='*';
   if(isOpen){
    let end=i+1;
    for(;end<source.length;end++){
     if(source[end]==='*'&&source[end-1]!=='*'&&source[end-1]!=='\\'&&source[end+1]!=='*')break;
    }
    if(end<source.length){
     flush();
     const action=source.slice(i,end+1).trim();
     if(action)tokens.push(action);
     i=end+1;
     continue;
    }
   }
   buffer+=source[i];
   i++;
  }
  flush();
  return tokens.join('\n\n');
 };
 return chunks.map(formatRoleplayChunk).filter(Boolean).join('\n\n');
}
function compactMarkdown(raw){
 // Protect complete ```InfoBox ... ``` code fences byte-for-byte, including
 // internal blank lines, spaces, item order, and line breaks.
 const text=raw.replace(/\r\n?/g,'\n');
 const blockRe=/^```[ \t]*InfoBox[^\n]*\n[\s\S]*?^```[ \t]*(?=\n|$)/gmi;
 const parts=[];
 let last=0, match;
 while((match=blockRe.exec(text))!==null){
  parts.push({type:'ordinary',value:text.slice(last,match.index)});
  parts.push({type:'infobox',value:match[0]});
  last=blockRe.lastIndex;
 }
 parts.push({type:'ordinary',value:text.slice(last)});
 // Don't compact an unfinished InfoBox while its editor content is incomplete.
 const tail=parts[parts.length-1];
 const open=tail.value.match(/^```[ \t]*InfoBox[^\n]*(?:\n|$)/gmi);
 if(open && open.length%2===1){
  const pos=tail.value.lastIndexOf(open[open.length-1]);
  const before=tail.value.slice(0,pos);
  const protectedTail=tail.value.slice(pos);
  tail.value=before;
  parts.push({type:'infobox',value:protectedTail});
 }
 let output='';
 for(const part of parts){
  if(part.type==='infobox'){
   // Exactly three empty lines above each InfoBox (four newline characters).
   output=output.replace(/\n+$/,'')+'\n\n\n\n'+part.value;
  }else{
   const compact=settings.lineBreakMode==='long'?spaciousMarkdownPlain(part.value):compactMarkdownPlain(part.value);
   if(!compact)continue;
   output+=(output && !output.endsWith('\n')?'\n\n':'')+compact;
  }
 }
 return output;
}
/* Optional narration removal used ONLY by the manual line-format button.
   A narrator section starts with @: at the beginning of a line and ends at
   the next @speaker: marker. Every fenced code block, including InfoBox, is
   kept exactly as supplied. Never touch the text automatically on message load. */
function removeNarrationSections(raw){
 const lines=String(raw).split(/(?<=\n)/);
 let inNarration=false;
 let fence=null;
 let output='';
 for(const line of lines){
  const body=line.replace(/\r?\n$/,'');
  const fenceMatch=body.match(/^[ \t]*(`{3,})/);
  if(fence){
   output+=line;
   if(fenceMatch && fenceMatch[1].length>=fence.length &&
      new RegExp('^[ \\t]*`{'+fence.length+',}[ \\t]*$').test(body))fence=null;
   continue;
  }
  if(fenceMatch){
   fence=fenceMatch[1];
   output+=line;
   continue;
  }
  if(/^[ \t]*@[ \t]*:[ \t]*/.test(body)){
   inNarration=true;
   continue;
  }
  if(/^[ \t]*@[^:\r\n]+:[ \t]*/.test(body))inNarration=false;
  if(!inNarration)output+=line;
 }
 return output;
}
let lineEditPending=false;
let lineEditExpiresAt=0;
let lineEditOpenTimer=null;
function formatEditTextarea(textarea){
 if(!textarea)return false;
 const raw=settings.removeNarration?removeNarrationSections(textarea.value):textarea.value;
 const formatted=compactMarkdown(raw);
 if(formatted!==textarea.value){
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
  if(setter)setter.call(textarea,formatted);
  else textarea.value=formatted;
  textarea.dispatchEvent(new Event('input',{bubbles:true}));
 }
 textarea.focus();
 return true;
}
function finishPendingLineEdit(){
 if(!lineEditPending)return;
 if(Date.now()>lineEditExpiresAt){lineEditPending=false;return;}
 const field=document.querySelector('[data-sentry-component="EditModeInputPanelContent"] textarea[name="message"],body.cc-frame-chat-root section textarea[name="message"]');
 if(!field)return;
 // Do not change anything else after formatting; native Save/Cancel stays with the user.
 lineEditPending=false;
 if(lineEditOpenTimer){clearTimeout(lineEditOpenTimer);lineEditOpenTimer=null;}
 formatEditTextarea(field);
}
function pressLineTool(){
 if(OUTER_ROOM){sendToCozyScene('line');return;}
 const field=document.querySelector('[data-sentry-component="EditModeInputPanelContent"] textarea[name="message"],body.cc-frame-chat-root section textarea[name="message"]');
 if(field){formatEditTextarea(field);return;}
 const edit=nativeEditButton();
 if(!edit||edit.disabled){
  const old=document.getElementById('cc-line-tool-hint');old?.remove();
  const hint=document.createElement('div');hint.id='cc-line-tool-hint';
  hint.textContent='제타의 수정 버튼을 찾지 못했어요. 순정 ✎ 버튼으로 수정창을 열고 다시 눌러주세요.';
  hint.style.cssText='position:fixed;z-index:2147483647;left:14px;right:14px;bottom:180px;padding:12px 16px;border:1px solid #ddd;border-radius:12px;background:white;color:#333;font:13px/1.5 sans-serif;box-shadow:0 4px 18px #0002;text-align:center;pointer-events:none';
  document.body.appendChild(hint);setTimeout(()=>hint.remove(),3500);return;
 }
 lineEditPending=true;
 lineEditExpiresAt=Date.now()+5000;
 // One native Edit click in direct response to the user's click; never auto-save.
 edit.click();
 // React may mount the textarea in a later render.
 finishPendingLineEdit();
 if(lineEditOpenTimer)clearTimeout(lineEditOpenTimer);
 lineEditOpenTimer=setTimeout(()=>{finishPendingLineEdit();lineEditPending=false;lineEditOpenTimer=null;},750);
}

/* V65 capture mode — mask only the activation view and up to 5 newly reached turns
   in each scroll direction. Local DOM text only; no Zeta API and no message persistence. */
let captureMode=false;
let captureButton=null;
let captureIdentity={charNames:[],userNames:[]};
const captureOriginals=new WeakMap();
const captureNodes=new Set();
const captureAllowedTurns=new Set();
const captureSeenTurns={up:new Set(),down:new Set()};
let captureScrollRoot=null;
let captureLastScrollTop=0;
let captureScrollDirection=null;
let captureScrollRAF=0;
const CAPTURE_TURN_LIMIT=5;
const CAPTURE_SCROLL_THRESHOLD=8;

function captureValidName(value){
 const name=String(value||'').trim();
 return !!(
  name &&
  name!=='유저' &&
  name!=='캐릭터' &&
  name!=='{{user}}' &&
  name!=='{{char}}' &&
  !/^#[0-9a-f]{3,8}$/i.test(name)
 );
}
function captureCharacterIdentity(){
 const left=document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="LeftTextContent"]');
 const header=document.querySelector('[data-testid="chat-header-profile"] span')?.textContent?.trim()||'';
 const candidates=[
  left?.querySelector(':scope > button img[alt]')?.getAttribute('alt')?.trim(),
  left?.querySelector('.cc-meta-name')?.textContent?.trim(),
  left?.querySelector('.caption1')?.textContent?.trim(),
  FRAME_CHAT&&left?frameName(left):'',
  header
 ].filter(captureValidName);
 const full=candidates[0]||'';
 const aliases=new Set(candidates);
 if(/^[가-힣]{3,}$/.test(full))aliases.add(full.slice(-2));
 return [...aliases].filter(captureValidName).sort((a,b)=>b.length-a.length);
}
function captureUserIdentity(){
 const right=document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root) [data-sentry-component="RightTextContent"]');
 const candidates=[
  right?.querySelector(':scope > button img[alt]')?.getAttribute('alt')?.trim(),
  right?.querySelector('.cc-meta-name')?.textContent?.trim(),
  right?.querySelector('.caption1')?.textContent?.trim(),
  FRAME_CHAT&&right?frameName(right):''
 ].filter(captureValidName);
 return [...new Set(candidates)].sort((a,b)=>b.length-a.length);
}
function escapeCaptureRegExp(value){
 return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}
function replaceCaptureNames(value){
 let output=String(value||'');
 const replacements=[
  ...captureIdentity.charNames.map(name=>[name,'{{char}}']),
  ...captureIdentity.userNames.map(name=>[name,'{{user}}'])
 ].sort((a,b)=>b[0].length-a[0].length);
 for(const [name,replacement] of replacements){
  if(!name||name===replacement)continue;
  output=output.replace(new RegExp(escapeCaptureRegExp(name),'g'),replacement);
 }
 return output;
}
function captureNodeAllowed(node){
 const parent=node?.parentElement;
 if(!parent)return false;
 if(parent.closest('#cc-panel,#cc-settings-backdrop,#cc-toggle,#cc-edit-shortcut,#cc-line-shortcut'))return false;
 if(parent.closest('textarea,input,[contenteditable="true"],script,style'))return false;
 return true;
}
function captureLog(){
 return document.querySelector('[role="log"][aria-label="Chat messages"]');
}
function captureTurnKey(turn,index){
 const user=turn.rows.find(row=>row.matches('[data-sentry-component="RightTextContent"]'));
 const first=turn.rows[0];
 const key=(user&&scopedKey(user))||(first&&scopedKey(first));
 return key||('capture-dom-'+index);
}
function captureTurns(){
 const log=captureLog();
 if(!log)return [];
 const rows=[...log.querySelectorAll(':scope [data-sentry-component="RightTextContent"],:scope [data-sentry-component="LeftTextContent"]')];
 const turns=[];
 let current=null;
 for(const row of rows){
  const isUser=row.matches('[data-sentry-component="RightTextContent"]');
  if(isUser||!current){
   current={rows:[]};
   turns.push(current);
  }
  current.rows.push(row);
 }
 turns.forEach((turn,index)=>turn.key=captureTurnKey(turn,index));
 return turns;
}
function captureViewportRect(){
 const log=captureLog();
 if(!log)return {top:0,bottom:innerHeight};
 const rect=log.getBoundingClientRect();
 return {
  top:Math.max(0,rect.top),
  bottom:Math.min(innerHeight,rect.bottom)
 };
}
function captureVisibleTurns(turns){
 const viewport=captureViewportRect();
 return turns.filter(turn=>turn.rows.some(row=>{
  const rect=row.getBoundingClientRect();
  return rect.bottom>viewport.top+2 && rect.top<viewport.bottom-2;
 }));
}
function maskCaptureRow(row){
 const walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  if(!captureNodeAllowed(node))continue;
  const current=node.nodeValue||'';
  let record=captureOriginals.get(node);
  if(record){
   if(current===record.masked)continue;
   const masked=replaceCaptureNames(current);
   record={original:current,masked};
   captureOriginals.set(node,record);
   if(masked!==current)node.nodeValue=masked;
   continue;
  }
  const masked=replaceCaptureNames(current);
  if(masked===current)continue;
  captureOriginals.set(node,{original:current,masked});
  captureNodes.add(node);
  node.nodeValue=masked;
 }
}
function restoreCaptureNode(node){
 const record=captureOriginals.get(node);
 if(record&&node.isConnected&&node.nodeValue===record.masked)node.nodeValue=record.original;
 captureNodes.delete(node);
}
function restoreCaptureOutsideAllowed(){
 for(const node of [...captureNodes]){
  if(!node.isConnected){captureNodes.delete(node);continue;}
  const row=node.parentElement?.closest?.('[data-sentry-component="RightTextContent"],[data-sentry-component="LeftTextContent"]');
  if(!row){restoreCaptureNode(node);continue;}
  const turn=captureTurns().find(t=>t.rows.includes(row));
  if(!turn||!captureAllowedTurns.has(turn.key))restoreCaptureNode(node);
 }
}
function applyCaptureAllowed(){
 if(!captureMode)return;
 const turns=captureTurns();
 for(const turn of turns){
  if(!captureAllowedTurns.has(turn.key))continue;
  for(const row of turn.rows)maskCaptureRow(row);
 }
 restoreCaptureOutsideAllowed();
 // Header is intentionally masked while capture mode is on.
 const header=document.querySelector('[data-testid="chat-header-profile"]');
 if(header){
  const walker=document.createTreeWalker(header,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(!captureNodeAllowed(node))continue;
   const current=node.nodeValue||'';
   let record=captureOriginals.get(node);
   if(record){
    if(current===record.masked)continue;
    const masked=replaceCaptureNames(current);
    captureOriginals.set(node,{original:current,masked});
    if(masked!==current)node.nodeValue=masked;
   }else{
    const masked=replaceCaptureNames(current);
    if(masked!==current){
     captureOriginals.set(node,{original:current,masked});
     captureNodes.add(node);
     node.nodeValue=masked;
    }
   }
  }
 }
}
function captureAddVisibleInDirection(direction){
 if(!captureMode)return;
 const turns=captureTurns();
 const visible=captureVisibleTurns(turns);
 if(!visible.length)return;

 for(const turn of visible){
  if(captureAllowedTurns.has(turn.key))continue;
  const seen=captureSeenTurns[direction];
  if(seen.size>=CAPTURE_TURN_LIMIT)continue;
  seen.add(turn.key);
  captureAllowedTurns.add(turn.key);
 }
 applyCaptureAllowed();
 updateCaptureButton();
}
function captureOnScroll(){
 if(!captureMode||!captureScrollRoot)return;
 const next=captureScrollRoot.scrollTop||0;
 const delta=next-captureLastScrollTop;
 if(Math.abs(delta)>=CAPTURE_SCROLL_THRESHOLD){
  captureScrollDirection=delta>0?'down':'up';
  captureLastScrollTop=next;
 }
 if(captureScrollRAF)return;
 captureScrollRAF=requestAnimationFrame(()=>{
  captureScrollRAF=0;
  if(captureScrollDirection)captureAddVisibleInDirection(captureScrollDirection);
 });
}
function bindCaptureScroll(){
 const log=captureLog();
 const root=log?.closest('[class*="overflow-y-auto"]')||log;
 if(captureScrollRoot===root)return;
 if(captureScrollRoot)captureScrollRoot.removeEventListener('scroll',captureOnScroll);
 captureScrollRoot=root||null;
 if(captureScrollRoot){
  captureLastScrollTop=captureScrollRoot.scrollTop||0;
  captureScrollRoot.addEventListener('scroll',captureOnScroll,{passive:true});
 }
}
function unbindCaptureScroll(){
 if(captureScrollRoot)captureScrollRoot.removeEventListener('scroll',captureOnScroll);
 captureScrollRoot=null;
 if(captureScrollRAF)cancelAnimationFrame(captureScrollRAF);
 captureScrollRAF=0;
 captureScrollDirection=null;
}
function restoreCaptureMode(){
 for(const node of [...captureNodes])restoreCaptureNode(node);
}
function updateCaptureButton(){
 if(!captureButton)return;
 captureButton.classList.toggle('cc-capture-active',captureMode);
 captureButton.setAttribute('aria-pressed',String(captureMode));
 captureButton.textContent=captureMode?'캡쳐 해제':'캡쳐모드';
 const up=captureSeenTurns.up.size;
 const down=captureSeenTurns.down.size;
 captureButton.title=captureMode
  ? `현재 화면 기준 · 위 ${up}/${CAPTURE_TURN_LIMIT}턴 · 아래 ${down}/${CAPTURE_TURN_LIMIT}턴`
  : '캡쳐할 대화 근처에서 켜세요 · 이름을 {{char}} / {{user}}로 가립니다';
}
function setCaptureMode(enabled){
 const next=enabled===true;
 if(next===captureMode){if(next){bindCaptureScroll();applyCaptureAllowed();}return;}
 if(next){
  captureIdentity={
   charNames:captureCharacterIdentity(),
   userNames:captureUserIdentity()
  };
  captureAllowedTurns.clear();
  captureSeenTurns.up.clear();
  captureSeenTurns.down.clear();
  captureMode=true;

  // Activation screen is the fixed anchor. Mask every turn visible right now.
  const initial=captureVisibleTurns(captureTurns());
  for(const turn of initial)captureAllowedTurns.add(turn.key);

  bindCaptureScroll();
  applyCaptureAllowed();
 }else{
  captureMode=false;
  unbindCaptureScroll();
  restoreCaptureMode();
  captureAllowedTurns.clear();
  captureSeenTurns.up.clear();
  captureSeenTurns.down.clear();
  captureIdentity={charNames:[],userNames:[]};
  schedule();
 }
 updateCaptureButton();
}

/* Called by the shared mutation batcher. It never expands the 5-turn boundary by itself. */
function applyCaptureMode(){
 if(!captureMode)return;
 bindCaptureScroll();
 applyCaptureAllowed();
}

/* V63 safe optimization stage 1:
   Batch repeated DOM mutations into one animation-frame pass.
   No dirty-row cache, no extra timer, no change to date/turn logic. */
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{
  scheduled=false;
  markFrameChatRoot();
  announceFrameControls();
  finishPendingLineEdit();
  enhance();
  enhanceHeader();
  enhanceDates();
  enhanceLetters();
  updateDialogueHighlight();
  makeSendArrow();
  updateActionAvailability();
  applyCaptureMode();
 });
}
const actions=[
 ['suggest','추천답변','[data-sentry-component="QuickReplyButton"] button[aria-label="Suggested replies"]'],
 ['snapshot','스냅샷','[data-sentry-component="LastMessageControlBar"] [data-sentry-component="SnapshotButton"] button'],
 ['report','신고','[data-sentry-component="LastMessageControlBar"] button[aria-label="Report message"]'],
 ['edit','수정','[data-sentry-component="LastMessageControlBar"] button[aria-label="Edit message"]'],
 ['request','마법봉','[data-sentry-component="LastMessageControlBar"] button[aria-label="Regenerate with a request"]'],
 ['regen','새 답변','[data-sentry-component="LastMessageControlBar"] button[aria-label="Regenerate answers"]']
];

// Floating controls use fixed CSS positions only.

// Resolve real on-screen Zeta buttons from rendered DOM only. Hidden native
// buttons remain in the DOM so their normal click handlers still work.
/* Exact native action strip supplied by the user. Find and mark only the
   toolbar containing Report/Edit/Request/Regenerate + Snapshot. No guessed
   positions, no Zeta APIs and no removal of Zeta nodes or click handlers. */
function nativeToolbar(){
 if(!FRAME_CHAT)return null;
 // The exact action bar supplied by the user has a report button, an edit
 // button, a request button and a regenerate button. Snapshot may be missing
 // or temporarily disabled, so never use it as a prerequisite.
 for(const report of document.querySelectorAll('button[aria-label="Report message"]')){
  if(report.closest('#cc-panel,[role="dialog"],[data-testid="bottom-panel-slot"]'))continue;
  const group=report.parentElement;
  const strip=group?.parentElement;
  if(!strip||!group?.classList.contains('ml-auto'))continue;
  if(strip.querySelector('button[aria-label="Edit message"]') &&
     strip.querySelector('button[aria-label="Regenerate with a request"]') &&
     strip.querySelector('button[aria-label="Regenerate answers"]'))return strip;
 }
 return null;
}
function markFrameNativeTools(){
 if(!FRAME_CHAT)return;
 const strip=nativeToolbar();
 if(!strip)return;
 strip.classList.add('cc-native-toolbar-group');
 for(const btn of strip.querySelectorAll('button'))btn.classList.add('cc-native-toolbar-button');
 const edit=strip.querySelector('button[aria-label="Edit message"]');
 if(edit && !edit.disabled)frameNativeEditButton=edit;
}
function availableNativeAction(key){
 // Each action is discovered independently. An unavailable Snapshot must not
 // make Report, Request or Regenerate unavailable.
 if(!FRAME_CHAT)return null;
 const strip=nativeToolbar();
 const findEnabled=sel=>[...(strip||document).querySelectorAll(sel)].find(btn=>
  !btn.disabled && !btn.closest('#cc-panel') &&
  btn.id!=='cc-edit-shortcut' && btn.id!=='cc-line-shortcut');
 if(key==='edit')return nativeEditButton();
 if(key==='report')return findEnabled('button[aria-label="Report message"]');
 if(key==='request')return findEnabled('button[aria-label="Regenerate with a request"]');
 if(key==='regen')return findEnabled('button[aria-label="Regenerate answers"]');
 if(key==='snapshot'){
  // The snapshot pill has no aria-label: match its visible text, first in
  // the exact toolbar and otherwise only in small real buttons elsewhere.
  const roots=strip?[strip,document]:[document];
  for(const root of roots){
   const found=[...root.querySelectorAll('button')].find(btn=>
    !btn.disabled && !btn.closest('#cc-panel,[data-testid="bottom-panel-slot"]') &&
    /(?:스냅샷|snapshot)/i.test((btn.textContent||'')+' '+(btn.getAttribute('aria-label')||'')) &&
    btn.id!=='cc-toggle');
   if(found)return found;
  }
  return null;
 }
 if(key==='suggest')return [...document.querySelectorAll('button[aria-label="Suggested replies"],button[aria-label="Get suggestions"],button[aria-label="추천 답변"],[data-sentry-component="QuickReplyButton"] button')].find(btn=>!btn.disabled&&!btn.closest('#cc-panel')&&btn.id!=='cc-toggle'&&btn.id!=='cc-edit-shortcut'&&btn.id!=='cc-line-shortcut')||null;
 return null;
}

function updateActionAvailability(){
 if(OUTER_ROOM){
  if(editShortcut){editShortcut.disabled=false;editShortcut.title='채팅 프레임에 수정창 열기 요청';}
  if(lineShortcut){lineShortcut.disabled=false;lineShortcut.title='채팅 프레임에 줄 정리 요청';}
  for(const btn of actionButtons.values()){btn.disabled=false;btn.title='채팅 프레임의 순정 도구 실행';}
  return;
 }
 removeDuplicateCozyControls();
 markFrameNativeTools();
 const isChat=!!document.querySelector(':is([data-sentry-component="ChatRoomReadyView"],.cc-frame-chat-root)');
 document.documentElement.classList.toggle('cc-tools-ready',isChat&&!!panel);
 if(editShortcut){const original=nativeEditButton();editShortcut.disabled=!isChat||!original||original.disabled;editShortcut.title=original?'메시지 수정':'새 화면의 수정 버튼을 아직 찾지 못했어요';}
 if(lineShortcut){lineShortcut.disabled=!isChat;lineShortcut.title='수정창을 열고 줄 정리 (저장은 직접)';}
 for(const [key,,selector] of actions){
  const btn=actionButtons.get(key);
  if(btn){const original=availableNativeAction(key);btn.disabled=!isChat||!original;btn.title=original?'제타의 원래 버튼 실행':'이 채팅 화면에서 해당 버튼을 찾지 못했어요';}
 }
}
function runOriginalAction(key){
 if(OUTER_ROOM){const sent=sendToCozyScene(key==='edit'?'edit':'action',key==='edit'?null:key);if(sent){panel.hidden=true;panel.style.removeProperty('display');if(settingsBackdrop)settingsBackdrop.hidden=true;}else console.warn('[Clean Cozy] 채팅 iframe을 찾지 못해 작업을 실행하지 않았어요.');return;}
 const def=actions.find(a=>a[0]===key);
 if(!def)return;
 const original=key==='edit'?nativeEditButton():availableNativeAction(key);
 if(!original||original.disabled)return;
 panel.hidden=true;panel.style.removeProperty('display');if(settingsBackdrop)settingsBackdrop.hidden=true;toggle?.setAttribute('aria-expanded','false');
 original.click();
}
function onSettingsOutsidePointer(event){
 if(!panel||panel.hidden)return;
 const target=event.target;
 // 사용방법 팝업은 설정창 위에 별도 레이어로 떠 있다.
 // 팝업/X/팝업 배경을 누른 것은 '설정창 바깥 클릭'으로 취급하지 않는다.
 if(target instanceof Element&&target.closest('#cc-help-dialog,#cc-help-backdrop'))return;
 if(target instanceof Node&&(panel.contains(target)||toggle?.contains(target)))return;
 panel.hidden=true;panel.style.removeProperty('display');if(settingsBackdrop)settingsBackdrop.hidden=true;toggle?.setAttribute('aria-expanded','false');
}
function removeDuplicateCozyControls(){
 // Multiple injection worlds can leave previous copies mounted. Preserve the
 // elements owned by this active instance, remove only the extra copies.
 for(const [id,owned] of [['cc-line-shortcut',lineShortcut],['cc-edit-shortcut',editShortcut],['cc-toggle',toggle],['cc-panel',panel],['cc-settings-backdrop',settingsBackdrop]]){
  for(const element of document.querySelectorAll('[id="'+id+'"]')){
   if(owned&&element===owned)continue;
   element.remove();
  }
 }
}
function makeControls(){
 // Keep the existing floating controls. The parent copies disappear only
 // after the iframe confirms that its own buttons actually exist.
 removeDuplicateCozyControls();
 lineShortcut=document.createElement('button');lineShortcut.id='cc-line-shortcut';lineShortcut.type='button';
 lineShortcut.title='수정창에서 줄 정리 (저장은 직접)';
 lineShortcut.setAttribute('aria-label','수정창 열고 줄 정리');
 lineShortcut.innerHTML='<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 11h11M4 16h16M4 21h9"/></svg>';
 lineShortcut.addEventListener('click',pressLineTool);
 if(FRAME_CHAT)lineShortcut.title='새 편집 버튼 구조 확인 전까지 비활성화';
 editShortcut=document.createElement('button');editShortcut.id='cc-edit-shortcut';editShortcut.type='button';
 editShortcut.title='메시지 수정';editShortcut.setAttribute('aria-label','Edit message');editShortcut.textContent='✎';
 editShortcut.addEventListener('click',()=>runOriginalAction('edit'));
 if(FRAME_CHAT)editShortcut.title='새 편집 버튼 구조 확인 전까지 비활성화';
 toggle=document.createElement('button');toggle.id='cc-toggle';toggle.type='button';toggle.title='클린 코지 설정 및 채팅 도구';toggle.setAttribute('aria-label','클린 코지 설정 및 채팅 도구');toggle.textContent='⚙';
 settingsBackdrop=document.createElement('div');settingsBackdrop.id='cc-settings-backdrop';settingsBackdrop.hidden=true;settingsBackdrop.setAttribute('aria-hidden','true');
 panel=document.createElement('div');panel.id='cc-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','클린 코지 설정');
 const avatarTitle=document.createElement('div');avatarTitle.className='cc-section-title';avatarTitle.textContent='프로필 사진';panel.appendChild(avatarTitle);
 const avatarGroup=document.createElement('div');avatarGroup.className='cc-avatar-options';avatarGroup.setAttribute('role','radiogroup');avatarGroup.setAttribute('aria-label','프로필 사진 표시 방식');
 for(const [value,title] of [
  ['both','모두 표시'],
  ['none','모두 숨기기'],
  ['userHidden','유저만 숨기기'],
  ['userHiddenHeart','유저 숨김 + 캐릭터 ♥']
 ]){
  const label=document.createElement('label');label.className='cc-avatar-option';
  const input=document.createElement('input');input.type='radio';input.name='cc-avatar-mode';input.value=value;input.checked=settings.avatarMode===value;
  input.addEventListener('change',()=>{if(!input.checked)return;settings.avatarMode=value;save();applyOpts();});
  const text=document.createElement('span');text.textContent=title;
  label.append(input,text);avatarGroup.appendChild(label);
 }
 panel.appendChild(avatarGroup);
 const highlightTitle=document.createElement('div');highlightTitle.className='cc-section-title';highlightTitle.textContent='대사 꾸미기';panel.appendChild(highlightTitle);
 const highlightLabel=document.createElement('label');highlightLabel.className='cc-avatar-option';highlightLabel.setAttribute('for','cc-dialogue-highlight-toggle');
 const highlightCheckbox=document.createElement('input');highlightCheckbox.id='cc-dialogue-highlight-toggle';highlightCheckbox.type='checkbox';highlightCheckbox.checked=settings.dialogueHighlight===true;
 highlightCheckbox.addEventListener('change',()=>{settings.dialogueHighlight=highlightCheckbox.checked;save();applyOpts();});
 const highlightText=document.createElement('span');highlightText.textContent='대사 형광펜';
 highlightLabel.append(highlightCheckbox,highlightText);panel.appendChild(highlightLabel);
 const narrationTitle=document.createElement('div');narrationTitle.className='cc-section-title';narrationTitle.textContent='줄바꿈 정리';panel.appendChild(narrationTitle);
 const outputGroup=document.createElement('div');outputGroup.className='cc-output-options';outputGroup.setAttribute('role','radiogroup');outputGroup.setAttribute('aria-label','줄바꿈 출력 방식');
 for(const [value,title] of [['short','짧은 출력'],['long','긴 출력']]){
  const label=document.createElement('label');label.className='cc-avatar-option cc-output-option';
  const input=document.createElement('input');input.type='radio';input.name='cc-line-break-mode';input.value=value;input.checked=settings.lineBreakMode===value;
  input.addEventListener('change',()=>{if(!input.checked)return;settings.lineBreakMode=value;save();applyOpts();});
  const text=document.createElement('span');text.textContent=title;
  label.append(input,text);outputGroup.appendChild(label);
 }
 panel.appendChild(outputGroup);
 const narrationLabel=document.createElement('label');narrationLabel.className='cc-avatar-option';narrationLabel.setAttribute('for','cc-remove-narration-toggle');
 const narrationCheckbox=document.createElement('input');narrationCheckbox.id='cc-remove-narration-toggle';narrationCheckbox.type='checkbox';narrationCheckbox.checked=settings.removeNarration===true;
 narrationCheckbox.addEventListener('change',()=>{settings.removeNarration=narrationCheckbox.checked;save();});
 const narrationText=document.createElement('span');narrationText.textContent='나레이션 삭제 (@:)';
 narrationLabel.append(narrationCheckbox,narrationText);panel.appendChild(narrationLabel);
 const section=document.createElement('div');section.className='cc-section-title';section.textContent='채팅 도구 · 제타 버튼 연동';panel.appendChild(section);
 const list=document.createElement('div');list.className='cc-action-list';
 for(const [key,title] of actions){
  if(key==='edit')continue;
  const btn=document.createElement('button');btn.className='cc-action';btn.type='button';btn.textContent=title;
  btn.addEventListener('click',()=>runOriginalAction(key));
  actionButtons.set(key,btn);list.appendChild(btn);
 }
 captureButton=document.createElement('button');
 captureButton.className='cc-action';
 captureButton.type='button';
 captureButton.addEventListener('click',()=>setCaptureMode(!captureMode));
 list.appendChild(captureButton);
 updateCaptureButton();
 const helpButton=document.createElement('button');
 helpButton.className='cc-action cc-help-open';
 helpButton.type='button';
 helpButton.innerHTML='<span class="cc-help-open-icon" aria-hidden="true">ⓘ</span><span>사용방법</span>';
 list.appendChild(helpButton);
 panel.appendChild(list);

 const helpBackdrop=document.createElement('div');
 helpBackdrop.id='cc-help-backdrop';
 helpBackdrop.hidden=true;
 helpBackdrop.setAttribute('aria-hidden','true');

 const helpDialog=document.createElement('div');
 helpDialog.id='cc-help-dialog';
 helpDialog.hidden=true;
 helpDialog.setAttribute('role','dialog');
 helpDialog.setAttribute('aria-modal','true');
 helpDialog.setAttribute('aria-label','클린 코지 사용방법');
 helpDialog.innerHTML=`
  <div class="cc-help-head">
   <div class="cc-help-title">사용방법</div>
   <button class="cc-help-close" type="button" aria-label="사용방법 닫기">×</button>
  </div>
  <div class="cc-help-body">
   <section class="cc-help-card">
    <div class="cc-help-card-title"><span class="cc-help-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h6a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z"/><path d="M3.5 10h17"/></svg></span><span>도구모음</span></div>
    <div class="cc-help-lines">
     <div class="cc-help-line"><span class="cc-help-dot">•</span><span>플로팅 버튼을 드래그하면 도구모음에 넣을 수 있어요.</span></div>
     <div class="cc-help-line"><span class="cc-help-dot">•</span><span>호환 확인된 기능: 제타킷 · inPocket · 캡쳐</span></div>
    </div>
   </section>
   <section class="cc-help-card">
    <div class="cc-help-card-title"><span class="cc-help-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 7.5h3l1.5-2h6l1.5 2h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z"/><circle cx="12" cy="13" r="3.5"/></svg></span><span>캡쳐모드</span></div>
    <div class="cc-help-lines">
     <div class="cc-help-line"><span class="cc-help-dot">•</span><span>캡쳐하고 싶은 곳에서 캡쳐모드를 실행해 주세요.</span></div>
     <div class="cc-help-line"><span class="cc-help-dot">•</span><span>실행한 곳부터 스크롤 방향으로 약 5턴까지 사용할 수 있어요.</span></div>
    </div>
   </section>
   <section class="cc-help-card">
    <div class="cc-help-card-title"><span class="cc-help-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h11M4 16h16M4 21h9"/></svg></span><span>줄바꿈 정리</span></div>
    <div class="cc-help-lines">
     <div class="cc-help-line"><span class="cc-help-key">짧은 출력</span><span>줄바꿈을 짧게 정리해요.</span></div>
     <div class="cc-help-line"><span class="cc-help-key">긴 출력</span><span>줄바꿈을 길게 정리해요.</span></div>
     <div class="cc-help-line"><span class="cc-help-key">나레이션</span><span>나레이션 삭제를 켜면 나레이션을 제외하고 정리해요.</span></div>
    </div>
   </section>
  </div>`;

 const setHelpOpen=(open)=>{
  if(!helpBackdrop.isConnected)document.body.appendChild(helpBackdrop);
  if(!helpDialog.isConnected)document.body.appendChild(helpDialog);
  helpBackdrop.hidden=!open;
  helpDialog.hidden=!open;
  helpBackdrop.setAttribute('aria-hidden',String(!open));
  helpDialog.setAttribute('aria-hidden',String(!open));
  if(open)helpDialog.querySelector('.cc-help-close')?.focus({preventScroll:true});
 };
 helpButton.addEventListener('click',()=>setHelpOpen(true));
 helpBackdrop.addEventListener('click',()=>setHelpOpen(false));
 helpDialog.querySelector('.cc-help-close').addEventListener('click',()=>setHelpOpen(false));
 // The scene's floating layers can override CSS visibility. Keep the settings
 // panel open/closed state explicit, and move it into view before rendering.
 const setSettingsOpen=(open)=>{
  if(!settingsBackdrop.isConnected)document.body.appendChild(settingsBackdrop);
  if(!panel.isConnected)document.body.appendChild(panel);
  panel.hidden=!open;
  settingsBackdrop.hidden=!open;
  panel.setAttribute('aria-hidden',String(!open));
  settingsBackdrop.setAttribute('aria-hidden',String(!open));
  toggle.setAttribute('aria-expanded',String(open));
  if(open){
    // Bottom sheet is viewport-fixed and independent of the floating buttons.
   for(const prop of ['left','right','top','bottom','transform'])panel.style.removeProperty(prop);
   panel.style.setProperty('display','block','important');
   panel.style.setProperty('visibility','visible','important');
   panel.style.setProperty('opacity','1','important');
   panel.style.setProperty('pointer-events','auto','important');
   panel.style.setProperty('z-index','2147483646','important');
  }else{
   panel.style.removeProperty('display');
   panel.style.removeProperty('visibility');
   panel.style.removeProperty('opacity');
   panel.style.removeProperty('pointer-events');
   setHelpOpen(false);
  }
 };
 toggle.setAttribute('aria-haspopup','dialog');
 toggle.setAttribute('aria-expanded','false');
 toggle.addEventListener('click',(event)=>{
  event.stopPropagation();
  const opening=panel.hidden;
  setSettingsOpen(opening);
  if(opening)updateActionAvailability();
 });
 // Close when the user clicks outside the settings panel and gear button.
 document.addEventListener('pointerdown',onSettingsOutsidePointer,true);
 document.body.append(toggle,editShortcut,lineShortcut,settingsBackdrop,panel);applyOpts();updateActionAvailability();
}
function stop(){if(captureMode){captureMode=false;unbindCaptureScroll();restoreCaptureMode();captureAllowedTurns.clear();captureSeenTurns.up.clear();captureSeenTurns.down.clear();captureIdentity={charNames:[],userNames:[]};}document.querySelector('.cc-frame-chat-root')?.classList.remove('cc-frame-chat-root');clearInlineDialogue();restoreHeader();lineEditPending=false;if(lineEditOpenTimer)clearTimeout(lineEditOpenTimer);if(dateRefreshTimer)clearInterval(dateRefreshTimer);document.removeEventListener('click',onSendClick,true);document.removeEventListener('keydown',onSendKey,true);document.removeEventListener('pointerdown',onSettingsOutsidePointer,true);if(OUTER_ROOM)window.removeEventListener('message',onCozyFrameReady);if(FRAME_CHAT)window.removeEventListener('message',receiveCozyUIMessage);document.documentElement.classList.remove('cc-inner-controls-ready');observer?.disconnect();toggle?.remove();editShortcut?.remove();lineShortcut?.remove();settingsBackdrop?.remove();panel?.remove();helpBackdrop?.remove();helpDialog?.remove();actionButtons.clear();document.documentElement.classList.remove('cc-tools-ready');for(const [svg,old] of sendOriginals){
  if(!svg.isConnected)continue;
  svg.innerHTML=old.html;
  if(old.viewBox===null)svg.removeAttribute('viewBox');else svg.setAttribute('viewBox',old.viewBox);
  if(old.fill===null)svg.removeAttribute('fill');else svg.setAttribute('fill',old.fill);
  delete svg.dataset.ccArrow;
 }sendOriginals.clear();
 document.querySelectorAll('.cc-meta-date').forEach(el=>el.remove());document.querySelectorAll('.cc-letter-meta').forEach(el=>el.remove());document.querySelectorAll('blockquote.cc-letter').forEach(el=>el.classList.remove('cc-letter'));document.querySelectorAll('.cc-meta').forEach(el=>el.remove());for(const el of marked)el.classList.remove('cc-name-hidden');marked.clear();document.documentElement.classList.remove('cc-avatar-hidden','cc-avatar-user-hidden','cc-avatar-heart','cc-dialogue-highlight');style.remove();if(window[KEY]?.stop===stop)delete window[KEY];}
document.addEventListener('click',onSendClick,true);document.addEventListener('keydown',onSendKey,true);dateRefreshTimer=setInterval(()=>{markFrameChatRoot();if(document.querySelector('.cc-meta-date'))schedule();},60000);markFrameChatRoot();applyOpts();makeControls();announceFrameControls(true);resetTurnRoom();enhance();enhanceHeader();enhanceDates();enhanceLetters();makeSendArrow();applyCaptureMode();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});if(FRAME_CHAT){[400,900,1600,2800,4500].forEach(ms=>setTimeout(()=>announceFrameControls(true),ms));}window[KEY]={stop,version:VERSION,palette:chosenKey};if(FRAME_CHAT)setTimeout(()=>{markFrameChatRoot();if(!document.querySelector('.cc-frame-chat-root'))console.warn('[Clean Cozy] iframe에서 기존 채팅 선택자를 찾지 못했어요. 새 프레임 내부 HTML 확인이 필요합니다.');},3500);
})();



/* ============================================================
   Integrated compatibility bridge
   - Keep Zeta's native bottom action strip rendered in DOM.
   - Clean Cozy's custom shortcuts still remain the visible controls.
   - No native click handlers are removed or replaced.
   ============================================================ */
(() => {
  'use strict';
  if (location.hostname !== 'frame.pingpong.ai') return;
  const id = 'cc-integrated-zk-native-toolbar-compat';
  document.getElementById(id)?.remove();
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
html body.cc-frame-chat-root .cc-native-toolbar-group,
html body.cc-frame-chat-root div.flex.flex-row.items-center.gap-1\\.5.px-2.py-1:has(>div.ml-auto button[aria-label="Report message"]):has(button[aria-label="Edit message"]):has(button[aria-label="Regenerate answers"]){
  display:flex!important;
  position:fixed!important;
  left:8px!important;
  top:8px!important;
  right:auto!important;
  bottom:auto!important;
  opacity:0!important;
  visibility:visible!important;
  pointer-events:none!important;
  user-select:none!important;
  z-index:-1!important;
  transform:none!important;
}
html body.cc-frame-chat-root .cc-native-toolbar-group .cc-native-toolbar-button,
html body.cc-frame-chat-root .cc-native-toolbar-button{
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:none!important;
}
`;
  (document.head || document.documentElement).appendChild(s);
})();


/* ===== Integrated: Floating Tool Folder ===== */
(() => {
  'use strict';

  /*
   * Zeta Universal Floating Folder v1.2.2-compat
   *
   * 원칙
   * - 제타 내부 API / 네트워크 / 프레임워크 내부 상태에 접근하지 않습니다.
   * - 현재 문서에 렌더된 DOM만 읽습니다.
   * - 등록한 도구 실행은 사용자가 폴더에서 직접 눌렀을 때만 연결합니다. 일반 도구는 HTMLElement.click(), 드래그형 탭 런처는 pointerdown → pointerup을 사용합니다.
   * - cross-origin 문서끼리 DOM을 직접 만지지 않습니다.
   * - outer에는 폴더 UI 하나만 표시하고, frame.pingpong.ai는 감지/실행 작업자로 동작합니다.
   * - outer ↔ iframe 통신은 이 스크립트 인스턴스끼리의 window.postMessage()만 사용합니다.
   */

  const w = window;
  const d = document;

  const INSTANCE = '__ZETA_UNIVERSAL_FLOATING_FOLDER_V1__';
  const HOST_ID = 'zeta-universal-floating-folder-v1';
  const STORE_KEY = 'zeta-universal-floating-folder-items-v1';
  const POS_KEY = 'zeta-universal-floating-folder-position-v1';
  const HIDDEN_ATTR = 'data-zff-managed-v1';
  const VERSION = '1.4.5-help-layer-legacy-cleanup';
  const CHANNEL = 'zeta-floating-folder-v11';
  const IS_OUTER = /(^|\.)zeta-ai\.io$/i.test(location.hostname) && w.top === w;
  const IS_FRAME_WORKER = location.hostname === 'frame.pingpong.ai';
  const remoteActions = new Map();
  let remoteGeometry = null;
  let remoteDragHover = false;
  let geometryInterval = 0;

  try { w[INSTANCE]?.destroy?.(); } catch (_) {}

  // 구형 별도 도구주머니 스크립트가 아직 켜져 있거나 같은 페이지에 남아 있으면
  // 예전 보라/그라데이션 폴더가 통합 폴더와 함께 보일 수 있다.
  // 통합본 시작 시 구형 인스턴스/호스트만 정리한다.
  try { w.__ZETA_FULLSCREEN_TOOL_POCKET__?.destroy?.(); } catch (_) {}
  try { w.__ZETA_TOOL_POCKET_ONLY__?.destroy?.(); } catch (_) {}
  try { d.getElementById('zeta-tool-pocket')?.remove(); } catch (_) {}
  // 이전 Universal 계열의 남은 호스트도 현재 통합 UI를 만들기 전에 제거한다.
  try { d.getElementById(HOST_ID)?.remove(); } catch (_) {}

  const disposers = [];
  const hiddenStyles = new Map();
  const actions = new Map();
  const savedEntries = new Map();
  const watchedRoots = new WeakSet();

  let host = null;
  let shadow = null;
  let launcher = null;
  let panel = null;
  let content = null;
  let manageButton = null;
  let toastNode = null;
  let observer = null;
  let scanTimer = 0;
  let restoreInterval = 0;
  let open = false;
  let managing = false;
  let launcherDrag = null;
  let candidateDrag = null;
  let suppressLauncherClick = false;
  let toastTimer = 0;

  const INTERACTIVE = 'button,[role="button"],a,[tabindex]:not([tabindex="-1"]),input[type="button"],input[type="submit"]';

  function on(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => {
      try { target.removeEventListener(type, handler, options); } catch (_) {}
    });
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), Math.max(min, max));
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function shortText(value, max = 60) {
    const text = cleanText(value);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function isOwnNode(node) {
    return node instanceof Node && (node === host || host?.contains?.(node) || node?.getRootNode?.() === shadow);
  }

  // Clean Cozy의 기존 우측 하단 3개 버튼과 설정 패널은 폴더에 넣는 대상이 아니다.
  // 기능/디자인을 건드리지 않고 드래그 후보에서만 제외한다.
  function isProtectedCozyNode(node) {
    if (!(node instanceof Element)) return false;
    return !!node.closest?.('#cc-toggle,#cc-edit-shortcut,#cc-line-shortcut,#cc-panel,#cc-settings-backdrop');
  }

  function isUsableElement(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || isOwnNode(element)) return false;
    if (element === d.body || element === d.documentElement) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isVisiblyPresent(element) {
    if (!isUsableElement(element)) return false;
    if (element.hasAttribute(HIDDEN_ATTR)) return false;
    const style = getComputedStyle(element);
    return Number(style.opacity || 1) > 0.01;
  }

  function accessibleName(element, fallback = '도구') {
    if (!(element instanceof Element)) return fallback;
    return shortText(
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.getAttribute('data-label') ||
      element.getAttribute('data-name') ||
      element.textContent ||
      fallback,
      40
    ) || fallback;
  }

  function iconFor(label, fallback = '✦') {
    const text = cleanText(label).toLowerCase();
    if (/캡처|capture|스크린샷|screenshot|사진/.test(text)) return '📸';
    if (/대화.?저장|채팅.?저장|save.?chat/.test(text)) return '💬';
    if (/저장함|보관함|archive|library/.test(text)) return '🗂️';
    if (/저장|save/.test(text)) return '💾';
    if (/동기화|sync/.test(text)) return '🔄';
    if (/기억|memory/.test(text)) return '🧠';
    if (/메모|memo|note/.test(text)) return '📝';
    if (/검색|search|찾기/.test(text)) return '🔎';
    if (/설정|setting|option/.test(text)) return '⚙️';
    if (/수정|편집|edit/.test(text)) return '✏️';
    if (/새.?답변|재생성|regenerate|retry/.test(text)) return '🔁';
    if (/스냅샷|snapshot/.test(text)) return '🖼️';
    if (/복사|copy/.test(text)) return '📋';
    if (/내보내기|export/.test(text)) return '📤';
    if (/가져오기|import/.test(text)) return '📥';
    if (/삭제|delete|remove/.test(text)) return '🗑️';
    if (/추가|add|new/.test(text)) return '➕';
    if (/이력|history/.test(text)) return '🕘';
    if (/게임|game|zetendo|젯텐도/.test(text)) return '🎮';
    if (/페르소나|persona|프로필|profile/.test(text)) return '👤';
    if (/요약|summary/.test(text)) return '🧾';
    if (/캡처 도구|capture tool/.test(text)) return '📸';
    return fallback;
  }

  function iconVisual(label, className = 'semantic-icon') {
    const text = cleanText(label).toLowerCase();
    let name = 'sparkles';
    if (/캡처|capture|스크린샷|screenshot|사진/.test(text)) name = 'camera';
    else if (/대화.?저장|채팅.?저장|save.?chat/.test(text)) name = 'message';
    else if (/저장함|보관함|archive|library/.test(text)) name = 'archive';
    else if (/저장|save/.test(text)) name = 'save';
    else if (/동기화|sync/.test(text)) name = 'refresh';
    else if (/기억|memory/.test(text)) name = 'brain';
    else if (/메모|memo|note/.test(text)) name = 'note';
    else if (/검색|search|찾기/.test(text)) name = 'search';
    else if (/설정|setting|option/.test(text)) name = 'settings';
    else if (/수정|편집|edit/.test(text)) name = 'edit';
    else if (/새.?답변|재생성|regenerate|retry/.test(text)) name = 'rotate';
    else if (/스냅샷|snapshot/.test(text)) name = 'image';
    else if (/복사|copy/.test(text)) name = 'copy';
    else if (/내보내기|export/.test(text)) name = 'upload';
    else if (/가져오기|import/.test(text)) name = 'download';
    else if (/삭제|delete|remove/.test(text)) name = 'trash';
    else if (/추가|add|new/.test(text)) name = 'plus';
    else if (/이력|history/.test(text)) name = 'clock';
    else if (/게임|game|zetendo|젯텐도/.test(text)) name = 'game';
    else if (/페르소나|persona|프로필|profile/.test(text)) name = 'user';
    else if (/요약|summary/.test(text)) name = 'file';

    const paths = {
      camera:'<path d="M14.5 5 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-2h5Z"/><circle cx="12" cy="13" r="3.2"/>',
      message:'<path d="M20 15a3 3 0 0 1-3 3H8l-4 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z"/><path d="M7 9h10M7 13h7"/>',
      archive:'<path d="M4 7h16v13H4z"/><path d="M3 4h18v4H3zM9 12h6"/>',
      save:'<path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
      refresh:'<path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/>',
      brain:'<path d="M9.5 4.5A3 3 0 0 0 5 7a3 3 0 0 0 .6 1.8A3.5 3.5 0 0 0 7 15.5V18a2 2 0 0 0 4 0V6.5a2 2 0 0 0-1.5-2Z"/><path d="M14.5 4.5A3 3 0 0 1 19 7a3 3 0 0 1-.6 1.8A3.5 3.5 0 0 1 17 15.5V18a2 2 0 0 1-4 0V6.5a2 2 0 0 1 1.5-2ZM7 11h2M15 9h2M15 14h2"/>',
      note:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>',
      search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6.2L14.7 4h-5.4L9 6.2a8 8 0 0 0-1.5.9l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.5.9l.3 2.2h5.4l.3-2.2a8 8 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5c0-.3.1-.7.1-1Z"/>',
      edit:'<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/>',
      rotate:'<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/>',
      image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
      copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
      upload:'<path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 15v5h16v-5"/>',
      download:'<path d="M12 4v12M8 12l4 4 4-4"/><path d="M4 19h16"/>',
      trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
      game:'<path d="M7 9h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5 2l-2-2h-4l-2 2a3 3 0 0 1-5-2v-3a4 4 0 0 1 4-4Z"/><path d="M7 13h4M9 11v4M16 12h.01M18 14h.01"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
      sparkles:'<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/>'
    };
    const node = d.createElement('div');
    node.className = className;
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
    return node;
  }

  function safeEscape(value) {
    try { return CSS.escape(String(value)); }
    catch (_) { return String(value).replace(/["\\]/g, '\\$&'); }
  }

  function hashString(value) {
    let hash = 2166136261;
    const input = String(value || '');
    for (let i = 0; i < input.length; i += 1) {
      hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function rootHintFor(element) {
    const root = element?.getRootNode?.();
    if (!(root instanceof ShadowRoot)) return { type: 'document' };
    const h = root.host;
    return {
      type: 'shadow',
      hostId: h?.id || '',
      hostTestId: h?.getAttribute?.('data-testid') || '',
      hostTag: h?.tagName?.toLowerCase?.() || '',
      hostClass: typeof h?.className === 'string'
        ? h.className.split(/\s+/).filter(Boolean).slice(0, 3).join(' ')
        : '',
    };
  }

  function stableClasses(element) {
    if (!(element instanceof HTMLElement) || typeof element.className !== 'string') return [];
    return element.className
      .split(/\s+/)
      .filter(Boolean)
      .filter(name => /^[a-zA-Z_][\w-]{1,35}$/.test(name))
      .filter(name => !/^(active|open|show|hidden|hover|focus|dragging|selected)$/i.test(name))
      .slice(0, 4);
  }

  function describeElement(element) {
    return {
      tag: element?.tagName?.toLowerCase?.() || 'div',
      id: element?.id || '',
      testid: element?.getAttribute?.('data-testid') || '',
      aria: element?.getAttribute?.('aria-label') || '',
      title: element?.getAttribute?.('title') || '',
      name: element?.getAttribute?.('name') || '',
      text: shortText(element?.textContent || '', 80),
      classes: stableClasses(element),
      root: rootHintFor(element),
    };
  }

  function descriptorKey(desc) {
    return JSON.stringify(desc || {});
  }

  function allOpenRoots() {
    const roots = [d];
    const seen = new Set(roots);
    for (let i = 0; i < roots.length; i += 1) {
      const root = roots[i];
      root.querySelectorAll?.('*').forEach(element => {
        if (element === host) return;
        if (element.shadowRoot && !seen.has(element.shadowRoot)) {
          seen.add(element.shadowRoot);
          roots.push(element.shadowRoot);
        }
      });
    }
    return roots;
  }

  function matchingRoots(desc) {
    const roots = allOpenRoots();
    if (desc?.root?.type !== 'shadow') return roots.filter(root => root instanceof Document);
    return roots.filter(root => {
      if (!(root instanceof ShadowRoot)) return false;
      const h = root.host;
      if (desc.root.hostId && h.id === desc.root.hostId) return true;
      if (desc.root.hostTestId && h.getAttribute('data-testid') === desc.root.hostTestId) return true;
      if (desc.root.hostTag && h.tagName?.toLowerCase() !== desc.root.hostTag) return false;
      if (desc.root.hostClass) {
        const classes = new Set(typeof h.className === 'string' ? h.className.split(/\s+/) : []);
        return desc.root.hostClass.split(/\s+/).every(c => classes.has(c));
      }
      return true;
    });
  }

  function elementMatchesDescriptor(element, desc) {
    if (!(element instanceof HTMLElement)) return false;
    if (desc.tag && element.tagName.toLowerCase() !== desc.tag) return false;
    if (desc.id && element.id !== desc.id) return false;
    if (desc.testid && element.getAttribute('data-testid') !== desc.testid) return false;
    if (desc.aria && element.getAttribute('aria-label') !== desc.aria) return false;
    if (desc.title && element.getAttribute('title') !== desc.title) return false;
    if (desc.name && element.getAttribute('name') !== desc.name) return false;
    if (desc.classes?.length) {
      const classes = new Set(typeof element.className === 'string' ? element.className.split(/\s+/) : []);
      if (!desc.classes.every(c => classes.has(c))) return false;
    }
    if (!desc.id && !desc.testid && !desc.aria && !desc.title && !desc.name && desc.text) {
      if (shortText(element.textContent || '', 80) !== desc.text) return false;
    }
    return true;
  }

  function resolveDescriptor(desc) {
    if (!desc) return null;
    const roots = matchingRoots(desc);

    for (const root of roots) {
      let candidates = [];
      try {
        if (desc.id) {
          const found = root.querySelector?.(`#${safeEscape(desc.id)}`);
          if (found) candidates = [found];
        } else if (desc.testid) {
          candidates = [...(root.querySelectorAll?.(`[data-testid="${safeEscape(desc.testid)}"]`) || [])];
        } else if (desc.aria) {
          candidates = [...(root.querySelectorAll?.(`[aria-label="${safeEscape(desc.aria)}"]`) || [])];
        } else if (desc.title) {
          candidates = [...(root.querySelectorAll?.(`[title="${safeEscape(desc.title)}"]`) || [])];
        } else if (desc.name) {
          candidates = [...(root.querySelectorAll?.(`[name="${safeEscape(desc.name)}"]`) || [])];
        } else {
          candidates = [...(root.querySelectorAll?.(desc.tag || '*') || [])];
        }
      } catch (_) {}

      const found = candidates.find(element => elementMatchesDescriptor(element, desc) && !isOwnNode(element));
      if (found instanceof HTMLElement) return found;
    }
    return null;
  }

  function interactiveElements(container) {
    if (!(container instanceof Element)) return [];
    const seen = new Set();
    return [...container.querySelectorAll(INTERACTIVE)].filter(element => {
      if (!(element instanceof HTMLElement) || seen.has(element) || isOwnNode(element) || isProtectedCozyNode(element)) return false;
      seen.add(element);
      if (!isVisiblyPresent(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width >= 10 && rect.height >= 10 && rect.width <= 180 && rect.height <= 120;
    });
  }

  function compactToolbar(container, buttons) {
    if (!(container instanceof HTMLElement) || buttons.length < 2 || buttons.length > 16) return false;
    const rect = container.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    if (rect.width > Math.min(620, w.innerWidth * 0.98)) return false;
    if (rect.height > Math.min(420, w.innerHeight * 0.75)) return false;
    if (rect.width * rect.height > 180000) return false;
    return true;
  }

  function groupFromPath(path) {
    const elements = path.filter(node => node instanceof HTMLElement && !isOwnNode(node) && !isProtectedCozyNode(node));
    for (const element of elements) {
      if (!isUsableElement(element)) continue;
      const buttons = interactiveElements(element);
      if (compactToolbar(element, buttons)) return { container: element, buttons };
    }
    return null;
  }

  function groupLabel(container, buttons) {
    const explicit = shortText(
      container?.getAttribute?.('aria-label') ||
      container?.getAttribute?.('title') ||
      container?.getAttribute?.('data-tool-name') ||
      container?.getAttribute?.('data-name') || '',
      30
    );
    if (explicit) return explicit;
    const labels = buttons.map(btn => accessibleName(btn, '')).filter(Boolean);
    return labels[0] || '도구 모음';
  }

  const VISUAL_PROPS = [
    'display', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'padding', 'margin', 'gap', 'align-items', 'justify-content', 'flex-direction', 'flex-wrap',
    'grid-template-columns', 'grid-template-rows',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align',
    'color', 'background', 'background-color', 'background-image', 'background-size', 'background-position',
    'border', 'border-width', 'border-style', 'border-color', 'border-radius', 'outline',
    'box-shadow', 'filter', 'opacity', 'overflow', 'object-fit', 'object-position'
  ];

  function sanitizeCloneTree(clone) {
    if (!(clone instanceof Element)) return;
    [clone, ...clone.querySelectorAll('*')].forEach(node => {
      node.removeAttribute?.('id');
      node.removeAttribute?.(HIDDEN_ATTR);
      [...(node.attributes || [])].forEach(attr => {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      });
      if (node instanceof HTMLElement) {
        node.style.setProperty('pointer-events', 'none', 'important');
        node.tabIndex = -1;
      }
    });
  }

  function visualTemplateFrom(element) {
    if (!(element instanceof HTMLElement)) return null;
    const clone = element.cloneNode(true);
    const sources = [element, ...element.querySelectorAll('*')];
    const targets = [clone, ...clone.querySelectorAll('*')];

    for (let i = 0; i < Math.min(sources.length, targets.length); i += 1) {
      const src = sources[i];
      const dst = targets[i];
      if (!(dst instanceof HTMLElement)) continue;
      let style;
      try { style = getComputedStyle(src); } catch (_) { continue; }
      VISUAL_PROPS.forEach(prop => {
        const value = style.getPropertyValue(prop);
        if (value) dst.style.setProperty(prop, value, 'important');
      });
    }

    sanitizeCloneTree(clone);
    if (clone instanceof HTMLElement) {
      clone.style.setProperty('position', 'static', 'important');
      clone.style.setProperty('inset', 'auto', 'important');
      clone.style.setProperty('left', 'auto', 'important');
      clone.style.setProperty('right', 'auto', 'important');
      clone.style.setProperty('top', 'auto', 'important');
      clone.style.setProperty('bottom', 'auto', 'important');
      clone.style.setProperty('transform', 'none', 'important');
      clone.style.setProperty('margin', '0', 'important');
      clone.style.setProperty('opacity', '1', 'important');
      clone.style.setProperty('visibility', 'visible', 'important');
      clone.style.setProperty('pointer-events', 'none', 'important');
    }
    return clone;
  }

  function hideElement(element) {
    if (!(element instanceof HTMLElement) || hiddenStyles.has(element)) return;
    hiddenStyles.set(element, {
      filter: element.style.getPropertyValue('filter'),
      filterPriority: element.style.getPropertyPriority('filter'),
      pointerEvents: element.style.getPropertyValue('pointer-events'),
      pointerPriority: element.style.getPropertyPriority('pointer-events'),
      userSelect: element.style.getPropertyValue('user-select'),
      userSelectPriority: element.style.getPropertyPriority('user-select'),
    });
    element.setAttribute(HIDDEN_ATTR, '1');
    // Do not use opacity here. Some launchers (e.g. ZETAKIT K) rewrite their own
    // opacity while running, which made a stored launcher faintly reappear.
    // filter:opacity(0) remains independent from that inline opacity animation.
    element.style.setProperty('filter', 'opacity(0)', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    element.style.setProperty('user-select', 'none', 'important');
  }

  function restoreElement(element) {
    const saved = hiddenStyles.get(element);
    if (!saved) return;
    try {
      element.removeAttribute(HIDDEN_ATTR);
      if (saved.filter) element.style.setProperty('filter', saved.filter, saved.filterPriority);
      else element.style.removeProperty('filter');
      if (saved.pointerEvents) element.style.setProperty('pointer-events', saved.pointerEvents, saved.pointerPriority);
      else element.style.removeProperty('pointer-events');
      if (saved.userSelect) element.style.setProperty('user-select', saved.userSelect, saved.userSelectPriority);
      else element.style.removeProperty('user-select');
    } catch (_) {}
    hiddenStyles.delete(element);
  }

  function restoreAllHidden() {
    [...hiddenStyles.keys()].forEach(restoreElement);
  }

  function serializeActions() {
    return [...actions.values()].map(action => ({
      id: action.id,
      kind: action.kind,
      label: action.label,
      icon: iconFor(action.label),
      children: action.kind === 'group' ? (action.children || []).map((child, index) => ({
        index,
        label: child.label,
        icon: iconFor(child.label),
      })) : [],
    }));
  }

  function postToOuter(message) {
    if (!IS_FRAME_WORKER || w.top === w) return;
    try { w.top.postMessage({ channel: CHANNEL, ...message }, '*'); } catch (_) {}
  }

  function notifyOuter() {
    if (IS_FRAME_WORKER) postToOuter({ type: 'SYNC', items: serializeActions() });
  }

  function persist() {
    const payload = [...savedEntries.values()];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); } catch (_) {}
    notifyOuter();
  }

  function loadSaved() {
    let rows = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      if (Array.isArray(parsed)) rows = parsed;
    } catch (_) {}
    rows.forEach(row => {
      if (row?.id && (row.kind === 'single' || row.kind === 'group')) savedEntries.set(String(row.id), row);
    });
  }

  function actionIdForSingle(desc) {
    return `single:${hashString(descriptorKey(desc))}`;
  }

  function actionIdForGroup(children) {
    return `group:${hashString(children.map(item => descriptorKey(item.desc)).join('|'))}`;
  }

  function isMemoryPatchLauncher(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.id === 'zk-memory-fab') return true;
    const marker = [
      element.id,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-tool'),
      element.getAttribute('data-action'),
      element.textContent,
    ].filter(Boolean).join(' ');
    return /(?:기억\s*패치|memory[-_ ]?patch)/i.test(marker);
  }

  function isPointerTapLauncher(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.id === 'zetakit-floating-launcher' || isMemoryPatchLauncher(element)) return true;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const compact = rect.width > 0 && rect.height > 0 && rect.width <= 96 && rect.height <= 96;
    const draggableStyle = style.touchAction === 'none' && /grab|grabbing/i.test(style.cursor || '');
    const positioned = ['fixed', 'absolute', 'sticky'].includes(style.position);
    return compact && draggableStyle && positioned;
  }

  function pointerTap(element) {
    if (!(element instanceof HTMLElement)) throw new Error('원본 도구를 찾지 못했습니다.');
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const pointerId = 9191;
    const base = {
      bubbles: true, cancelable: true, composed: true,
      pointerId, pointerType: 'mouse', isPrimary: true,
      button: 0, clientX: x, clientY: y,
    };
    const down = typeof PointerEvent === 'function'
      ? new PointerEvent('pointerdown', { ...base, buttons: 1 })
      : new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w, button: 0, buttons: 1, clientX: x, clientY: y });
    const up = typeof PointerEvent === 'function'
      ? new PointerEvent('pointerup', { ...base, buttons: 0 })
      : new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: w, button: 0, buttons: 0, clientX: x, clientY: y });
    element.dispatchEvent(down);
    element.dispatchEvent(up);
  }

  function activateOriginalElement(element) {
    if (!(element instanceof HTMLElement)) throw new Error('원본 도구를 찾지 못했습니다.');
    if (isPointerTapLauncher(element)) pointerTap(element);
    else element.click();
  }

  function isInPocketLauncher(element) {
    if (!(element instanceof HTMLElement)) return false;
    const owner = element.closest?.(
      '[id*="inpocket" i],[class*="inpocket" i],[data-inpocket],[data-tool*="inpocket" i],[data-action*="inpocket" i]'
    );
    const marker = [
      element.id,
      typeof element.className === 'string' ? element.className : '',
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-inpocket'),
      element.getAttribute('data-tool'),
      element.getAttribute('data-action'),
      owner?.id,
      typeof owner?.className === 'string' ? owner.className : '',
      element.textContent,
    ].filter(Boolean).join(' ');
    return !!owner || /in\s*pocket|inpocket/i.test(marker);
  }

  function runInPocketFromFolder(current) {
    // The loader supplied by the user opens inPocket through this public
    // controller, so use the same entry point when reopening from our folder.
    try {
      const api = w.__INPOCKET__;
      if (api && typeof api.open === 'function') {
        api.open();
        return;
      }
    } catch (_) {}

    // Fallback only if the controller is unavailable.
    activateOriginalElement(current);
  }

  function memoryPatchOpenSignal(element, baseline) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    const expanded = element.getAttribute('aria-expanded');
    if (expanded === 'true') return true;

    const rect = element.getBoundingClientRect();
    if (baseline && (
      rect.width > baseline.width + 18 ||
      rect.height > baseline.height + 18
    )) return true;

    // Some ZETAKIT tools expand by mounting a small panel under/around the FAB.
    for (const node of element.querySelectorAll('*')) {
      if (!(node instanceof HTMLElement)) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 40 || r.height < 28) continue;
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (s.position === 'fixed' || s.position === 'absolute' || node.getAttribute('role') === 'dialog') return true;
    }

    // Portal/sibling fallback: only inspect visible nodes whose own id/class/aria
    // explicitly identifies them as a memory-patch UI. This stays DOM-only.
    const root = element.getRootNode?.() || d;
    const scope = root instanceof Document || root instanceof ShadowRoot ? root : d;
    const nodes = scope.querySelectorAll?.(
      '[id*="memory" i],[class*="memory" i],[aria-label*="기억" i],[title*="기억" i]'
    ) || [];
    for (const node of nodes) {
      if (!(node instanceof HTMLElement) || node === element || element.contains(node)) continue;
      const marker = [
        node.id,
        typeof node.className === 'string' ? node.className : '',
        node.getAttribute('aria-label'),
        node.getAttribute('title'),
        node.textContent
      ].filter(Boolean).join(' ');
      if (!/(?:기억|memory)/i.test(marker)) continue;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      if (r.width >= 40 && r.height >= 28 && s.display !== 'none' && s.visibility !== 'hidden') return true;
    }
    return false;
  }

  function runMemoryPatchFromFolder(current, shell) {
    // Important: the normal ZETAKIT -> Memory Patch click path is untouched.
    // This bridge runs ONLY after the user has already enrolled the FAB into our folder.
    if (!(current instanceof HTMLElement)) throw new Error('기억 패치 원본을 찾지 못했습니다.');

    if (shell instanceof HTMLElement) restoreElement(shell);
    if (current !== shell) restoreElement(current);

    const baselineRect = current.getBoundingClientRect();
    const baseline = { width: baselineRect.width, height: baselineRect.height };
    let sawOpen = false;
    let fallbackTried = false;
    let finished = false;

    const rehide = () => {
      if (finished) return;
      finished = true;
      if (shell instanceof HTMLElement && shell.isConnected) hideElement(shell);
      else if (current.isConnected) hideElement(current);
    };

    // First use the browser's normal HTMLElement.click(). This is the closest
    // match to the original FAB click while it is restored and visible.
    try { current.click(); }
    catch (_) {
      current.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, composed: true, view: w
      }));
    }

    let checks = 0;
    const timer = w.setInterval(() => {
      checks += 1;
      if (!current.isConnected) {
        w.clearInterval(timer);
        finished = true;
        return;
      }

      const openNow = memoryPatchOpenSignal(current, baseline);
      if (openNow) sawOpen = true;

      // If click did nothing, try the drag-style pointer tap once while the
      // original FAB is still restored. Never send both immediately, avoiding
      // an accidental open->close double toggle.
      if (!sawOpen && !fallbackTried && checks === 4) {
        fallbackTried = true;
        try { pointerTap(current); } catch (_) {}
      }

      // Once we have observed an opened state, wait for it to close before
      // hiding the original FAB again. This prevents a descendant popup from
      // inheriting filter:opacity(0).
      if (sawOpen && !openNow && checks > 5) {
        w.clearInterval(timer);
        rehide();
        return;
      }

      // Failed to open: restore the enrolled hidden state, but do not touch
      // ZETAKIT's creation/launcher flow.
      if (!sawOpen && checks >= 14) {
        w.clearInterval(timer);
        rehide();
      }
    }, 120);
  }

  function buildSingleAction(entry, element, suppliedShell = null) {
    const visual = visualTemplateFrom(element);
    // 기억 패치는 FAB 주변 래퍼 안에 메뉴/패널을 함께 마운트할 수 있다.
    // 래퍼 전체를 숨기면 열린 메뉴까지 같이 투명해질 수 있으므로 FAB 자체만 관리한다.
    const memoryPatch = isMemoryPatchLauncher(element);
    const shell = memoryPatch
      ? element
      : (suppliedShell instanceof HTMLElement
          ? suppliedShell
          : (entry.hideDesc ? resolveDescriptor(entry.hideDesc) : null) || element);
    const action = {
      id: entry.id,
      kind: 'single',
      label: entry.label || accessibleName(element),
      desc: entry.desc,
      element,
      visual,
      hiddenNodes: [shell],
      run() {
        const current = element?.isConnected ? element : resolveDescriptor(entry.desc);
        if (!(current instanceof HTMLElement)) throw new Error('원본 도구를 찾지 못했습니다.');
        if (isMemoryPatchLauncher(current)) runMemoryPatchFromFolder(current, shell);
        else if (isInPocketLauncher(current)) runInPocketFromFolder(current);
        else activateOriginalElement(current);
      }
    };
    hideElement(shell);
    return action;
  }

  function buildGroupAction(entry, elements, suppliedContainer = null) {
    const children = entry.children.map((saved, index) => {
      const element = elements[index];
      return {
        label: saved.label || accessibleName(element, `기능 ${index + 1}`),
        desc: saved.desc,
        element,
        visual: visualTemplateFrom(element),
        run() {
          const current = element?.isConnected ? element : resolveDescriptor(saved.desc);
          if (!(current instanceof HTMLElement)) throw new Error('원본 하위 버튼을 찾지 못했습니다.');
          if (isInPocketLauncher(current)) runInPocketFromFolder(current);
          else activateOriginalElement(current);
        }
      };
    });
    const container = suppliedContainer instanceof HTMLElement
      ? suppliedContainer
      : (entry.containerDesc ? resolveDescriptor(entry.containerDesc) : null);
    const hiddenNodes = container ? [container] : elements;
    hiddenNodes.forEach(hideElement);
    return {
      id: entry.id,
      kind: 'group',
      label: entry.label || children[0]?.label || '도구 모음',
      children,
      visual: children[0]?.visual?.cloneNode(true) || null,
      hiddenNodes,
    };
  }

  function activateSavedEntry(entry) {
    if (!entry || actions.has(entry.id)) return false;

    if (entry.kind === 'single') {
      const element = resolveDescriptor(entry.desc);
      if (!(element instanceof HTMLElement)) return false;
      const shell = entry.hideDesc ? resolveDescriptor(entry.hideDesc) : null;
      actions.set(entry.id, buildSingleAction(entry, element, shell));
      return true;
    }

    if (entry.kind === 'group') {
      const elements = (entry.children || []).map(child => resolveDescriptor(child.desc));
      if (elements.length < 2 || elements.some(el => !(el instanceof HTMLElement))) return false;
      const container = entry.containerDesc ? resolveDescriptor(entry.containerDesc) : null;
      actions.set(entry.id, buildGroupAction(entry, elements, container));
      return true;
    }
    return false;
  }

  function restoreSavedEntries() {
    let changed = false;
    for (const entry of savedEntries.values()) {
      if (actions.has(entry.id)) {
        const action = actions.get(entry.id);
        const live = action.kind === 'group'
          ? action.children.every(child => child.element?.isConnected)
          : action.element?.isConnected;
        if (live) continue;
        action.hiddenNodes?.forEach(restoreElement);
        actions.delete(entry.id);
      }
      if (activateSavedEntry(entry)) changed = true;
    }
    if (changed) { render(); notifyOuter(); }
  }

  function registerSingle(element, shell = null) {
    if (!(element instanceof HTMLElement) || isOwnNode(element) || isProtectedCozyNode(element)) return;
    if (!(shell instanceof HTMLElement) || isOwnNode(shell) || isProtectedCozyNode(shell)) shell = element;
    const desc = describeElement(element);
    const hideDesc = shell === element ? null : describeElement(shell);
    const id = actionIdForSingle(desc);
    if (savedEntries.has(id)) {
      activateSavedEntry(savedEntries.get(id));
      render();
      toast('이미 폴더에 들어 있는 도구예요');
      notifyOuter();
      return;
    }
    const entry = {
      id,
      kind: 'single',
      label: accessibleName(element),
      desc,
      hideDesc,
    };
    savedEntries.set(id, entry);
    persist();
    actions.set(id, buildSingleAction(entry, element, shell));
    render();
    toast(`${entry.label}를 폴더에 넣었어요`);
    notifyOuter();
  }

  function registerGroup(container, buttons) {
    if (isProtectedCozyNode(container)) return;
    buttons = buttons.filter(el => el instanceof HTMLElement && !el.hasAttribute(HIDDEN_ATTR) && !isProtectedCozyNode(el));
    if (buttons.length < 2) {
      registerSingle(buttons[0] || container);
      return;
    }
    const children = buttons.map(element => ({
      label: accessibleName(element),
      desc: describeElement(element),
    }));
    const id = actionIdForGroup(children);
    if (savedEntries.has(id)) {
      activateSavedEntry(savedEntries.get(id));
      render();
      toast('이미 폴더에 들어 있는 도구 모음이에요');
      notifyOuter();
      return;
    }
    const entry = {
      id,
      kind: 'group',
      label: groupLabel(container, buttons),
      containerDesc: describeElement(container),
      children,
    };
    savedEntries.set(id, entry);
    persist();
    actions.set(id, buildGroupAction(entry, buttons, container));
    render();
    toast(`${entry.label}를 폴더에 넣었어요`);
    notifyOuter();
  }

  function removeAction(id) {
    const action = actions.get(id);
    action?.hiddenNodes?.forEach(restoreElement);
    actions.delete(id);
    savedEntries.delete(id);
    persist();
    render();
    toast(`${action?.label || '도구'}를 밖으로 꺼냈어요`);
    notifyOuter();
  }

  function visualShellFor(trigger, pathElements, movedRecords = []) {
    if (!(trigger instanceof HTMLElement)) return trigger;
    const triggerRect = trigger.getBoundingClientRect();
    const movedSet = new Set(movedRecords.map(item => item.element));
    const chain = [];
    for (let current = trigger; current instanceof HTMLElement && chain.length < 6; current = current.parentElement) {
      if (isOwnNode(current)) break;
      const rect = current.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12) continue;
      if (rect.width > 180 || rect.height > 180) break;
      if (rect.width > triggerRect.width * 5 || rect.height > triggerRect.height * 5) break;
      chain.push(current);
    }
    // 실제 드래그와 함께 움직인 가장 바깥의 작은 래퍼를 최우선으로 선택.
    const movedShells = chain.filter(el => movedSet.has(el));
    if (movedShells.length) return movedShells[movedShells.length - 1];

    // 배경/보더/그림자를 가진 시각적 외곽 래퍼를 선택.
    const visualShells = chain.filter(el => {
      const st = getComputedStyle(el);
      const bg = st.backgroundColor;
      const hasBg = bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
      const hasBorder = parseFloat(st.borderTopWidth || '0') > 0 || parseFloat(st.borderLeftWidth || '0') > 0;
      const hasShadow = st.boxShadow && st.boxShadow !== 'none';
      const radius = parseFloat(st.borderRadius || '0') || 0;
      return hasBg || hasBorder || hasShadow || radius >= 8;
    });
    if (visualShells.length) return visualShells[visualShells.length - 1];

    const pathShell = pathElements.find(el => el !== trigger && chain.includes(el));
    return pathShell || trigger;
  }

  function chooseCandidateFromDrag(drag) {
    const pathElements = drag.path.filter(node => node instanceof HTMLElement && !isOwnNode(node));

    // 1) 먼저 실제로 여러 버튼이 한 컨테이너에 묶여 있으면 그룹으로 취급.
    const grouped = groupFromPath(pathElements);
    if (grouped) return { type: 'group', ...grouped };

    // 2) fixed/absolute 여부를 보지 않고, 드래그 전후 좌표가 실제로 달라진 요소를 찾음.
    const moved = [];
    for (const rec of drag.rects) {
      const element = rec.element;
      if (!(element instanceof HTMLElement) || !element.isConnected || isOwnNode(element)) continue;
      const now = element.getBoundingClientRect();
      const delta = Math.hypot(now.left - rec.left, now.top - rec.top);
      if (delta >= 3) moved.push({ element, delta, area: now.width * now.height });
    }

    // 이동한 요소 중 툴바가 발견되면 그 그룹을 우선.
    for (const item of moved) {
      const buttons = interactiveElements(item.element);
      if (compactToolbar(item.element, buttons)) {
        return { type: 'group', container: item.element, buttons };
      }
    }

    // 3) 실제 클릭 가능한 요소를 실행 타깃으로 잡되, 숨김은 외곽 시각적 래퍼 전체에 적용.
    const interactive = pathElements.find(element => element.matches?.(INTERACTIVE));
    if (interactive) {
      const shell = visualShellFor(interactive, pathElements, moved);
      return { type: 'single', element: interactive, shell };
    }

    // 4) 클릭 요소가 명확하지 않으면 실제로 움직인 가장 작은 요소를 실행 타깃으로 선택하고 외곽 래퍼를 찾음.
    moved.sort((a, b) => a.area - b.area || b.delta - a.delta);
    if (moved[0]?.element) {
      const element = moved[0].element;
      const shell = visualShellFor(element, pathElements, moved);
      return { type: 'single', element, shell };
    }

    // 5) 마지막 fallback도 동일하게 외곽 래퍼를 함께 잡음.
    const fallback = pathElements.find(element => isUsableElement(element));
    return fallback ? { type: 'single', element: fallback, shell: visualShellFor(fallback, pathElements, moved) } : null;
  }

  function candidatePath(event) {
    const path = event.composedPath?.() || [];
    return path.filter(node => node instanceof HTMLElement && !isOwnNode(node));
  }

  function beginCandidateDrag(event) {
    if (event.pointerType !== 'touch' && event.button !== 0) return;
    const rawPath = event.composedPath?.() || [];
    if (rawPath.some(node => isOwnNode(node))) return;
    if (rawPath.some(node => isProtectedCozyNode(node))) return;
    const path = rawPath.filter(node => node instanceof HTMLElement && !isOwnNode(node) && !isProtectedCozyNode(node));
    if (!path.length) return;

    const rects = [];
    path.slice(0, 10).forEach(element => {
      if (!isUsableElement(element)) return;
      const rect = element.getBoundingClientRect();
      if (rect.width > w.innerWidth * 0.98 && rect.height > w.innerHeight * 0.8) return;
      rects.push({ element, left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    });

    candidateDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      path,
      rects,
      moved: false,
      hovering: false,
    };
    host?.classList.add('drop-ready');
    if (IS_FRAME_WORKER) postToOuter({ type: 'DRAG_STATE', active: true, hovering: false });
  }

  function pointOverLauncher(clientX, clientY) {
    let x = clientX;
    let y = clientY;
    let rect = launcher?.getBoundingClientRect?.() || null;
    if (!rect && IS_FRAME_WORKER && remoteGeometry?.launcher && remoteGeometry?.frame) {
      x = remoteGeometry.frame.left + clientX;
      y = remoteGeometry.frame.top + clientY;
      rect = remoteGeometry.launcher;
    }
    if (!rect) return false;
    const pad = 14;
    return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  }

  function moveCandidateDrag(event) {
    if (!candidateDrag || candidateDrag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - candidateDrag.startX, event.clientY - candidateDrag.startY) > 5) {
      candidateDrag.moved = true;
    }
    candidateDrag.hovering = candidateDrag.moved && pointOverLauncher(event.clientX, event.clientY);
    host?.classList.toggle('drop-hover', candidateDrag.hovering);
    if (IS_FRAME_WORKER && remoteDragHover !== candidateDrag.hovering) {
      remoteDragHover = candidateDrag.hovering;
      postToOuter({ type: 'DRAG_STATE', active: true, hovering: remoteDragHover });
    }
    // 중요: 다른 유저스크립트의 원래 드래그를 깨지 않도록 preventDefault/stopPropagation 하지 않음.
  }

  function endCandidateDrag(event) {
    if (!candidateDrag || candidateDrag.pointerId !== event.pointerId) return;
    const drag = candidateDrag;
    candidateDrag = null;
    host?.classList.remove('drop-ready', 'drop-hover');
    if (IS_FRAME_WORKER) {
      remoteDragHover = false;
      postToOuter({ type: 'DRAG_STATE', active: false, hovering: false });
    }

    if (!drag.moved || !drag.hovering) return;
    const candidate = chooseCandidateFromDrag(drag);
    if (!candidate) {
      toast('이 도구의 메뉴 구조를 잡지 못했어요');
      return;
    }
    if (candidate.type === 'group') registerGroup(candidate.container, candidate.buttons);
    else registerSingle(candidate.element, candidate.shell);
  }

  function watchRoot(root) {
    if (!root?.addEventListener || watchedRoots.has(root)) return;
    watchedRoots.add(root);
    on(root, 'pointerdown', beginCandidateDrag, true);
    on(root, 'pointermove', moveCandidateDrag, true);
    on(root, 'pointerup', endCandidateDrag, true);
    on(root, 'pointercancel', endCandidateDrag, true);
  }

  function refreshRoots() {
    allOpenRoots().forEach(watchRoot);
  }

  function makeVisualNode(template) {
    if (!(template instanceof Element)) {
      const fallback = d.createElement('div');
      fallback.className = 'fallback-icon';
      fallback.textContent = '✦';
      return fallback;
    }
    const clone = template.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.style.setProperty('pointer-events', 'none', 'important');
      clone.style.setProperty('opacity', '1', 'important');
    }
    return clone;
  }

  function execute(run, label) {
    closePanel();
    try {
      run();
    } catch (error) {
      console.error('[Zeta Floating Folder]', label, error);
      toast(`${label} 실행 실패 · 원본 버튼을 다시 찾지 못했어요`);
    }
  }

  function render() {
    if (!content) return;
    content.replaceChildren();
    manageButton.textContent = managing ? '완료' : '정리';
    host.classList.toggle('managing', managing);
    const allActions = [...actions.values(), ...remoteActions.values()];
    host.classList.toggle('has-items', allActions.length > 0);

    if (!allActions.length) {
      const empty = d.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '<strong>비어 있어요</strong><span>넣고 싶은 플로팅 메뉴를<br>폴더 위로 드래그해 놓아주세요.</span>';
      content.appendChild(empty);
      return;
    }

    const grid = d.createElement('div');
    grid.className = 'grid';

    allActions.forEach(action => {
      const item = d.createElement('div');
      item.className = 'item';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', action.label);

      const visual = d.createElement('div');
      visual.className = 'visual';
      visual.appendChild(iconVisual(action.label));

      const label = d.createElement('div');
      label.className = 'label';
      label.textContent = action.label;

      item.append(visual, label);

      const activate = () => {
        if (managing) return;
        if (action.kind === 'group' && action.children?.length) renderChildren(action);
        else if (action.remote) sendRemoteExecute(action, null);
        else execute(action.run, action.label);
      };
      item.addEventListener('click', activate);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });

      const remove = d.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '−';
      remove.setAttribute('aria-label', `${action.label} 폴더에서 빼기`);
      remove.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (action.remote) sendRemoteRemove(action);
        else removeAction(action.id);
      });
      item.appendChild(remove);
      grid.appendChild(item);
    });

    content.appendChild(grid);
  }

  function renderChildren(action) {
    managing = false;
    host.classList.remove('managing');
    manageButton.hidden = true;
    content.replaceChildren();

    const back = d.createElement('button');
    back.type = 'button';
    back.className = 'back';
    back.innerHTML = `<span>‹</span><strong>${escapeHTML(action.label)}</strong>`;
    back.addEventListener('click', () => {
      manageButton.hidden = false;
      render();
    });

    const grid = d.createElement('div');
    grid.className = 'grid';

    action.children.forEach(child => {
      const item = d.createElement('div');
      item.className = 'item child';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', child.label);

      const visual = d.createElement('div');
      visual.className = 'visual';
      visual.appendChild(iconVisual(child.label));
      const label = d.createElement('div');
      label.className = 'label';
      label.textContent = child.label;
      item.append(visual, label);

      const activate = () => action.remote
        ? sendRemoteExecute(action, child.index)
        : execute(child.run, `${action.label} · ${child.label}`);
      item.addEventListener('click', activate);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      grid.appendChild(item);
    });

    content.append(back, grid);
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function sendRemoteExecute(action, childIndex) {
    closePanel();
    try {
      action.source?.postMessage?.({ channel: CHANNEL, type: 'EXEC', id: action.remoteId, childIndex }, '*');
    } catch (_) { toast(`${action.label} 실행 연결에 실패했어요`); }
  }

  function sendRemoteRemove(action) {
    try { action.source?.postMessage?.({ channel: CHANNEL, type: 'REMOVE', id: action.remoteId }, '*'); }
    catch (_) { toast('도구를 꺼내지 못했어요'); }
  }

  function syncRemoteActions(items, source) {
    for (const [key, value] of [...remoteActions]) {
      if (value.source === source) remoteActions.delete(key);
    }
    (Array.isArray(items) ? items : []).forEach(item => {
      if (!item?.id) return;
      const key = `remote:${item.id}`;
      remoteActions.set(key, {
        id: key,
        remoteId: item.id,
        remote: true,
        source,
        kind: item.kind === 'group' ? 'group' : 'single',
        label: item.label || '도구',
        visual: null,
        children: (item.children || []).map((child, index) => ({
          index: Number.isInteger(child?.index) ? child.index : index,
          label: child?.label || `기능 ${index + 1}`,
          visual: null,
        })),
      });
    });
    render();
  }

  function sendGeometryToFrameWorkers() {
    if (!IS_OUTER || !launcher) return;
    const lr = launcher.getBoundingClientRect();
    const launcherRect = { left: lr.left, top: lr.top, right: lr.right, bottom: lr.bottom, width: lr.width, height: lr.height };
    [...d.querySelectorAll('iframe')].forEach(frame => {
      let src = '';
      try { src = frame.src || ''; } catch (_) {}
      if (!/https:\/\/frame\.pingpong\.ai\//i.test(src)) return;
      const fr = frame.getBoundingClientRect();
      const frameRect = { left: fr.left, top: fr.top, right: fr.right, bottom: fr.bottom, width: fr.width, height: fr.height };
      try { frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'GEOMETRY', launcher: launcherRect, frame: frameRect }, '*'); } catch (_) {}
    });
  }

  function installMessaging() {
    on(w, 'message', event => {
      const data = event.data;
      if (!data || data.channel !== CHANNEL) return;

      if (IS_OUTER) {
        if (event.origin !== 'https://frame.pingpong.ai') return;
        if (data.type === 'SYNC') syncRemoteActions(data.items, event.source);
        else if (data.type === 'TOAST') toast(data.message || '');
        else if (data.type === 'DRAG_STATE') {
          host?.classList.toggle('remote-drag', !!data.active);
          host?.classList.toggle('drop-ready', !!data.active);
          host?.classList.toggle('drop-hover', !!data.active && !!data.hovering);
        } else if (data.type === 'HELLO') {
          sendGeometryToFrameWorkers();
        }
        return;
      }

      if (IS_FRAME_WORKER) {
        if (!/(^https:\/\/zeta-ai\.io$)|(^https:\/\/[^/]+\.zeta-ai\.io$)/i.test(event.origin)) return;
        if (data.type === 'GEOMETRY') {
          remoteGeometry = { launcher: data.launcher, frame: data.frame };
        } else if (data.type === 'EXEC') {
          const action = actions.get(String(data.id));
          if (!action) { notifyOuter(); return; }
          try {
            if (action.kind === 'group' && Number.isInteger(data.childIndex)) {
              const child = action.children?.[data.childIndex];
              if (!child) throw new Error('하위 기능을 찾지 못했습니다.');
              child.run();
            } else if (action.kind === 'single') action.run();
          } catch (error) {
            console.error('[Zeta Floating Folder worker]', error);
            postToOuter({ type: 'TOAST', message: '원본 버튼을 다시 찾지 못했어요' });
          }
        } else if (data.type === 'REMOVE') {
          removeAction(String(data.id));
        }
      }
    });

    if (IS_FRAME_WORKER) {
      postToOuter({ type: 'HELLO' });
      w.setTimeout(notifyOuter, 120);
    }
  }

  function viewport() {
    const vv = w.visualViewport;
    return {
      left: vv?.offsetLeft || 0,
      top: vv?.offsetTop || 0,
      width: vv?.width || w.innerWidth || d.documentElement.clientWidth,
      height: vv?.height || w.innerHeight || d.documentElement.clientHeight,
    };
  }

  function readPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
        return { x: clamp(saved.x, 0, 1), y: clamp(saved.y, 0, 1) };
      }
    } catch (_) {}
    return { x: 0.92, y: 0.72 };
  }

  let position = readPosition();

  function placeLauncher() {
    if (!launcher) return;
    // Clean Cozy의 세 버튼은 right:8px / 44px 간격으로 배치된다.
    // 최상단 줄정리 버튼(bottom:258px) 위에 같은 간격으로 네 번째 버튼을 둔다.
    launcher.style.setProperty('left', 'auto', 'important');
    launcher.style.setProperty('top', 'auto', 'important');
    launcher.style.setProperty('right', '8px', 'important');
    launcher.style.setProperty('bottom', '302px', 'important');
    if (IS_OUTER) sendGeometryToFrameWorkers();
  }

  function placePanel() {
    if (!open || !panel) return;
    // 바텀시트는 런처 위치와 무관하게 화면 아래에 고정한다.
    panel.style.setProperty('left', '50%', 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('top', 'auto', 'important');
    panel.style.setProperty('bottom', '0', 'important');
  }

  function openPanel() {
    open = true;
    managing = false;
    manageButton.hidden = false;
    panel?.removeAttribute('inert');
    panel?.setAttribute('aria-hidden', 'false');
    host.classList.add('open');
    launcher.setAttribute('aria-expanded', 'true');
    render();
    requestAnimationFrame(placePanel);
  }

  function closePanel() {
    open = false;
    managing = false;
    manageButton.hidden = false;
    host?.classList.remove('open', 'managing');
    launcher?.setAttribute('aria-expanded', 'false');
    panel?.setAttribute('aria-hidden', 'true');
    panel?.setAttribute('inert', '');
  }

  function toast(message) {
    if (IS_FRAME_WORKER && !toastNode) {
      postToOuter({ type: 'TOAST', message: String(message || '') });
      return;
    }
    if (!toastNode) return;
    clearTimeout(toastTimer);
    toastNode.textContent = message;
    toastNode.classList.add('show');
    toastTimer = w.setTimeout(() => toastNode?.classList.remove('show'), 1800);
  }

  function createUI() {
    d.getElementById(HOST_ID)?.remove();
    host = d.createElement('div');
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{
          all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;
          font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
          --cc-tool-accent:#7E6A9C;--cc-tool-soft:#F3EEFA;--cc-tool-text:#292B2D;--cc-tool-muted:#8D9196;
          --cc-tool-line:#E4E5E6;--cc-tool-card:#FAFAFA;--cc-tool-card-hover:#F3F3F4;
        }
        *{box-sizing:border-box}button{font:inherit;-webkit-tap-highlight-color:transparent}
        .launcher{
          position:fixed;width:32px;height:32px;min-width:32px;min-height:32px;padding:0;
          display:flex;align-items:center;justify-content:center;
          border:1px solid #DDDFE0;border-radius:50%;
          background:#FFFFFF;color:#45484C;
          box-shadow:0 2px 8px #00000015;
          pointer-events:auto;touch-action:auto;cursor:pointer;
          transition:transform .14s ease,box-shadow .14s ease,background .14s ease;
        }
        .launcher:hover{background:#F1F2F4}.launcher:active{transform:scale(.93)}
        .folder-svg{width:17px;height:17px;display:block;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        :host(.drop-ready) .launcher{box-shadow:0 0 0 3px rgba(126,106,156,.14),0 2px 8px #00000015}
        :host(.drop-hover) .launcher{transform:scale(1.10);background:#F3EEFA;box-shadow:0 0 0 5px rgba(126,106,156,.18),0 3px 10px #00000018}
        .scrim{position:fixed;inset:0;border:0;background:rgba(24,27,31,.18);opacity:0;pointer-events:none;transition:opacity .16s ease}
        .panel{
          position:fixed;left:50%;right:auto;top:auto;bottom:0;
          width:min(100%,560px);max-width:100%;max-height:min(78dvh,620px);
          overflow:hidden;display:flex;flex-direction:column;
          border:1px solid var(--cc-tool-line);border-bottom:0;border-radius:20px 20px 0 0;
          background:#FFFFFF;color:var(--cc-tool-text);
          box-shadow:0 -10px 32px rgba(25,29,34,.14);
          opacity:0;visibility:hidden;transform:translate(-50%,18px);pointer-events:none;
          transition:opacity .18s ease,transform .18s ease,visibility 0s linear .18s;
          padding-bottom:env(safe-area-inset-bottom);
        }
        .panel::before{content:'';display:block;flex:0 0 auto;width:38px;height:4px;margin:10px auto 2px;border-radius:999px;background:#D7D9DD}
        .head{display:flex;align-items:center;gap:8px;padding:10px 16px 11px;border-bottom:1px solid var(--cc-tool-line)}
        .head-icon{display:none}.titles{min-width:0;flex:1}.title{font-size:14px;font-weight:700;letter-spacing:-.015em;line-height:1.25}
        .sub{margin-top:2px;font-size:10px;font-weight:500;color:var(--cc-tool-muted)}
        .manage,.close,.back{border:1px solid #ECEDEE;cursor:pointer;color:#555A61;background:#FAFAFA}
        .manage{height:29px;padding:0 10px;border-radius:9px;font-size:10px;font-weight:650}
        .close{width:29px;height:29px;border-radius:9px;font-size:17px;color:#70757A}
        .content{min-height:0;overflow:auto;padding:13px 14px 17px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
        .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .item{
          position:relative;min-width:0;min-height:48px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;
          padding:9px 8px;border:1px solid #ECEDEE;border-radius:12px;background:var(--cc-tool-card);cursor:pointer;outline:none;pointer-events:auto;
          transition:transform .12s ease,background .12s ease,border-color .12s ease;
        }
        .item:hover{background:var(--cc-tool-card-hover)}.item:active{transform:scale(.96);background:#F0F0F1}
        .item:focus-visible{box-shadow:0 0 0 3px rgba(126,106,156,.13);border-color:#D9D1E5}
        .visual{width:20px;height:20px;flex:0 0 20px;display:flex;align-items:center;justify-content:center;overflow:visible;pointer-events:none}
        .visual>*{max-width:20px!important;max-height:20px!important;flex:none!important}
        .semantic-icon,.fallback-icon{
          width:20px;height:20px;display:grid;place-items:center;border-radius:0;
          background:transparent;border:0;box-shadow:none;color:var(--cc-tool-accent);
        }
        .semantic-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        .fallback-icon{font-size:15px}
        .label{min-width:0;width:auto;min-height:0;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:10.5px;font-weight:650;line-height:1.2;color:#4F5358;letter-spacing:-.015em}
        .remove{position:absolute;right:3px;top:3px;width:20px;height:20px;padding:0;display:none;place-items:center;border:2px solid #FAFAFA;border-radius:999px;background:#E66B73;color:#fff;font-size:13px;font-weight:900;line-height:1;box-shadow:0 2px 6px rgba(40,40,40,.12);pointer-events:auto;cursor:pointer}
        :host(.managing) .item{opacity:.62;pointer-events:none}:host(.managing) .remove{display:grid;pointer-events:auto}
        .back{width:100%;height:36px;margin:0 0 10px;padding:0 11px;border-radius:10px;display:flex;align-items:center;gap:7px;text-align:left;font-size:11px;color:#5A5F65}
        .back span{font-size:20px;line-height:1;color:var(--cc-tool-accent)}.back strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .empty{padding:31px 14px 28px;text-align:center;color:#8D9196;font-size:11px;line-height:1.55}.empty strong{display:block;margin-bottom:5px;color:#555A61;font-size:12px}
        .toast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));max-width:calc(100vw - 24px);padding:9px 13px;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(45,39,57,.9);color:#fff;font-size:10px;font-weight:700;opacity:0;transform:translate(-50%,7px);transition:.16s ease;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)}
        .toast.show{opacity:1;transform:translate(-50%,0)}
        :host(:not(.open)) .panel,
        :host(:not(.open)) .panel *{pointer-events:none!important}
        :host(.open) .scrim{opacity:1;pointer-events:auto}
        :host(.open) .panel{opacity:1;visibility:visible;transform:translate(-50%,0);pointer-events:auto;transition-delay:0s}
        :host(.open) .launcher{opacity:1;pointer-events:none}
        :host(.remote-drag) .launcher{pointer-events:none!important}
        @media(max-width:360px){.panel{width:100%}.grid{gap:7px 5px}.item{min-height:46px;padding:8px 6px}.label{font-size:10px}}
        @media(prefers-reduced-motion:reduce){*{transition:none!important}}
      </style>

      <button class="scrim" type="button" aria-label="폴더 닫기"></button>
      <section class="panel" role="dialog" aria-label="플로팅 도구 폴더" aria-hidden="true" inert>
        <header class="head">
          <div class="head-icon">📁</div>
          <div class="titles"><div class="title">도구</div><div class="sub">드래그해서 정리</div></div>
          <button class="manage" type="button">정리</button>
          <button class="close" type="button" aria-label="닫기">×</button>
        </header>
        <div class="content"></div>
      </section>
      <button class="launcher" type="button" aria-label="도구 폴더 열기" aria-expanded="false">
        <svg class="folder-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 7.5a2 2 0 0 1 2-2h5l2 2h6a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z"/>
          <path d="M3.5 10h17"/>
        </svg>
      </button>
      <div class="toast" role="status" aria-live="polite"></div>
    `;

    (d.documentElement || d.body).appendChild(host);
    launcher = shadow.querySelector('.launcher');
    panel = shadow.querySelector('.panel');
    content = shadow.querySelector('.content');
    manageButton = shadow.querySelector('.manage');
    toastNode = shadow.querySelector('.toast');

    shadow.querySelector('.scrim').addEventListener('click', closePanel);
    shadow.querySelector('.close').addEventListener('click', closePanel);
    manageButton.addEventListener('click', () => {
      managing = !managing;
      render();
    });

    // 폴더 버튼 자체는 Clean Cozy의 기존 세 버튼처럼 고정한다.
    // 다른 플로팅 도구를 이 버튼 위에 드롭하는 기능만 유지한다.
    launcher.addEventListener('click', event => {
      if (suppressLauncherClick) {
        suppressLauncherClick = false;
        event.preventDefault();
        return;
      }
      open ? closePanel() : openPanel();
    });

    placeLauncher();
    render();
  }

  function startObserver() {
    observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = w.setTimeout(() => {
        refreshRoots();
        restoreSavedEntries();
      }, 100);
    });
    observer.observe(d.documentElement, { childList: true, subtree: true });
    restoreInterval = w.setInterval(restoreSavedEntries, 2500);
  }

  function destroy() {
    clearTimeout(scanTimer);
    clearTimeout(toastTimer);
    clearInterval(restoreInterval);
    clearInterval(geometryInterval);
    observer?.disconnect();
    disposers.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
    restoreAllHidden();
    host?.remove();
    host = shadow = launcher = panel = content = manageButton = toastNode = null;
    actions.clear();
    try { delete w[INSTANCE]; } catch (_) { w[INSTANCE] = undefined; }
  }

  function start() {
    loadSaved();
    installMessaging();

    if (IS_OUTER) {
      createUI();
      geometryInterval = w.setInterval(sendGeometryToFrameWorkers, 700);
      on(w, 'resize', () => { placeLauncher(); requestAnimationFrame(placePanel); sendGeometryToFrameWorkers(); }, { passive: true });
      on(w.visualViewport, 'resize', () => { placeLauncher(); requestAnimationFrame(placePanel); sendGeometryToFrameWorkers(); }, { passive: true });
      on(w.visualViewport, 'scroll', () => { placeLauncher(); requestAnimationFrame(placePanel); sendGeometryToFrameWorkers(); }, { passive: true });
    }

    // outer 자체 플로팅 도구와 iframe 내부 플로팅 도구 모두 감지한다.
    refreshRoots();
    restoreSavedEntries();
    startObserver();
    notifyOuter();
  }

  w[INSTANCE] = {
    destroy,
    rescan: restoreSavedEntries,
    get items() { return [...savedEntries.values()]; },
  };

  if (d.documentElement) start();
  else d.addEventListener('readystatechange', () => {
    if (d.documentElement && !host) start();
  }, { once: true });
})();

/* ===== Integrated: Review Quickbar Floating Adapter ===== */
(() => {
  'use strict';

  const w = window;
  const d = document;

  const IS_FRAME = location.hostname === 'frame.pingpong.ai';
  const TOP_RE = /^https:\/\/([a-z0-9-]+\.)*zeta-ai\.io$/i;
  const FRAME_RE = /^https:\/\/([a-z0-9-]+\.)*pingpong\.ai$/i;

  const INSTANCE_KEY = '__ZETA_REVIEW_QUICKBAR_FLOAT_V2__';
  const MARK_ATTR = 'data-zeta-review-tabbar-drag';
  const KEY_POS = 'zeta_review_quickbar_float_pos_v2';
  const STORE_CHANNEL = 'zeta-review-quickbar-store-v2';
  const ACCENT_CHANNEL = 'zeta-review-quickbar-accent-v2';

  const LABELS = ['검토', '새답변', '추천', '무응답', '퀵', '이력', '로어', '설정', '×', 'X', 'x'];
  const CORE_LABELS = ['검토', '새답변', '추천', '무응답'];

  try { w[INSTANCE_KEY]?.stop?.(); } catch (_) {}

  let stopped = false;
  let barEl = null;
  let observer = null;
  let refreshTimer = 0;
  let accentTimer = 0;
  let frameAccent = null;
  let pos = null;
  let userMoved = false;
  let drag = null;
  let suppressNextClick = false;

  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

  function visible(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  // ------------------------------
  // outer <-> iframe position store
  // ------------------------------
  function parentOrigin() {
    if (w.top === w) return location.origin;
    try {
      const ao = location.ancestorOrigins?.[0];
      if (ao && TOP_RE.test(ao)) return ao;
    } catch (_) {}
    try {
      const ref = new URL(d.referrer).origin;
      if (TOP_RE.test(ref)) return ref;
    } catch (_) {}
    return '';
  }

  const pendingStore = new Map();
  let storeSeq = 0;

  function installStoreBridge() {
    if (w.top === w) {
      w.addEventListener('message', event => {
        if (!FRAME_RE.test(event.origin)) return;
        const data = event.data;
        if (!data || data.channel !== STORE_CHANNEL || !event.source) return;
        if (data.key !== KEY_POS) return;

        let value = null;
        try {
          if (data.op === 'get') value = localStorage.getItem(KEY_POS);
          if (data.op === 'set') {
            localStorage.setItem(KEY_POS, String(data.value ?? ''));
            value = String(data.value ?? '');
          }
        } catch (_) {}

        try {
          event.source.postMessage({
            channel: STORE_CHANNEL,
            type: 'reply',
            id: data.id,
            value
          }, event.origin);
        } catch (_) {}
      });
      return;
    }

    w.addEventListener('message', event => {
      if (!TOP_RE.test(event.origin)) return;
      const data = event.data;
      if (!data || data.channel !== STORE_CHANNEL || data.type !== 'reply') return;
      const done = pendingStore.get(data.id);
      if (!done) return;
      pendingStore.delete(data.id);
      done(data.value);
    });
  }

  function storeAsk(op, value) {
    if (w.top === w) {
      try {
        if (op === 'get') return Promise.resolve(localStorage.getItem(KEY_POS));
        localStorage.setItem(KEY_POS, String(value ?? ''));
        return Promise.resolve(String(value ?? ''));
      } catch (_) {
        return Promise.resolve(null);
      }
    }

    const origin = parentOrigin();
    if (!origin) return Promise.resolve(undefined);

    return new Promise(resolve => {
      const id = `zrq_${++storeSeq}_${Date.now()}`;
      const timer = setTimeout(() => {
        pendingStore.delete(id);
        resolve(undefined);
      }, 1500);

      pendingStore.set(id, result => {
        clearTimeout(timer);
        resolve(result);
      });

      try {
        w.parent.postMessage({
          channel: STORE_CHANNEL,
          id,
          op,
          key: KEY_POS,
          value
        }, origin);
      } catch (_) {
        clearTimeout(timer);
        pendingStore.delete(id);
        resolve(undefined);
      }
    });
  }

  function parsePos(raw) {
    try {
      const v = JSON.parse(raw || 'null');
      if (Number.isFinite(v?.x) && Number.isFinite(v?.y)) return { x: v.x, y: v.y };
    } catch (_) {}
    return null;
  }

  async function loadPos() {
    let local = null;
    try { local = parsePos(localStorage.getItem(KEY_POS)); } catch (_) {}
    if (local) {
      pos = local;
      return;
    }

    const fromTop = parsePos(await storeAsk('get'));
    if (fromTop && !userMoved) pos = fromTop;
  }

  function savePos() {
    if (!pos) return;
    const raw = JSON.stringify({
      x: Math.round(pos.x),
      y: Math.round(pos.y)
    });
    try { localStorage.setItem(KEY_POS, raw); } catch (_) {}
    storeAsk('set', raw);
  }

  // ------------------------------
  // user bubble accent
  // ------------------------------
  function currentUserBubble() {
    const compat =
      d.querySelector('[data-sentry-component="RightTextContent"] [data-sentry-component="ChatBubbleContainer"]') ||
      d.querySelector('[data-sentry-component="RightTextContent"]');

    if (compat) return compat;

    const log = d.querySelector('[role="log"][aria-label="Chat messages"]');
    if (!log) return null;

    const rows = [...log.querySelectorAll('div')].filter(el =>
      el.classList?.contains('ml-auto') &&
      el.classList?.contains('flex') &&
      el.classList?.contains('flex-row')
    );

    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const bubbles = [...row.querySelectorAll('div')].filter(el =>
        el.classList?.contains('w-fit') &&
        el.classList?.contains('flex-col')
      );
      if (bubbles[0]) return bubbles[0];
    }

    return null;
  }

  function bubbleAccentPayload() {
    const bubble = currentUserBubble();
    if (!bubble) return null;
    const cs = getComputedStyle(bubble);
    const bw = parseFloat(cs.borderTopWidth || '0');
    return {
      border: bw >= 1 ? cs.borderTopColor : null,
      bg: cs.backgroundColor || null
    };
  }

  function sendFrameAccent() {
    if (!IS_FRAME || w.top === w) return;
    const payload = bubbleAccentPayload();
    if (!payload) return;

    const origin = parentOrigin();
    if (!origin) return;

    try {
      w.parent.postMessage({
        channel: ACCENT_CHANNEL,
        ...payload
      }, origin);
    } catch (_) {}
  }

  function installAccentBridge() {
    if (IS_FRAME) {
      sendFrameAccent();
      accentTimer = w.setInterval(sendFrameAccent, 1200);
      return;
    }

    w.addEventListener('message', event => {
      if (!FRAME_RE.test(event.origin)) return;
      const data = event.data;
      if (!data || data.channel !== ACCENT_CHANNEL) return;

      const value = parseColor(data.border) || parseColor(data.bg);
      if (value && value !== frameAccent) {
        frameAccent = value;
        if (barEl?.isConnected) applyStyle(barEl, true);
      }
    });
  }

  function parseColor(raw) {
    if (!raw) return null;
    const value = String(raw).trim();

    if (/^#[0-9a-f]{3,8}$/i.test(value)) {
      if (value.length === 4) {
        return '#' + [...value.slice(1)].map(c => c + c).join('');
      }
      return value.slice(0, 7);
    }

    const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return null;

    const r = +m[1], g = +m[2], b = +m[3];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 10) return null;

    return '#' + [r, g, b]
      .map(v => clamp(v, 0, 255).toString(16).padStart(2, '0'))
      .join('');
  }

  function accentFromCurrentDocument() {
    const bubble = bubbleAccentPayload();
    return parseColor(bubble?.border)
      || parseColor(bubble?.bg)
      || parseColor(getComputedStyle(d.documentElement).getPropertyValue('--dialogue-hl'))
      || parseColor(d.querySelector('[data-testid="chat-send-button"]')
        ? getComputedStyle(d.querySelector('[data-testid="chat-send-button"]')).backgroundColor
        : null)
      || null;
  }

  function getAccent() {
    return frameAccent || accentFromCurrentDocument() || '#9B87D3';
  }

  // ------------------------------
  // quickbar discovery
  // ------------------------------
  function barButtons(container) {
    return [...container.querySelectorAll('button,[role="button"],div,span')]
      .filter(el => {
        const text = cleanText(el.textContent);
        return LABELS.includes(text) && el.children.length === 0;
      });
  }

  function findBar() {
    const byId = d.getElementById('zk_review_quickbar');
    if (byId && visible(byId)) return byId;

    const all = [...d.querySelectorAll('button,[role="button"],div,span')];
    const core = CORE_LABELS
      .map(label => all.find(el => visible(el) && cleanText(el.textContent) === label))
      .filter(Boolean);

    if (core.length < 3) return null;

    let container = core[0].parentElement;
    for (let hops = 0; container && hops < 6; hops++, container = container.parentElement) {
      if (container === d.body || container === d.documentElement) break;
      if (!core.every(el => container.contains(el))) continue;

      const r = container.getBoundingClientRect();
      if (r.width <= Math.min(1100, w.innerWidth) && r.height <= 420) return container;
    }

    return null;
  }

  // ------------------------------
  // placement / styling
  // ------------------------------
  function orientation() {
    const y = pos?.y ?? 0;
    const h = w.innerHeight || d.documentElement.clientHeight || 1;
    return y < h * 0.22 || y > h * 0.78 ? 'horizontal' : 'vertical';
  }

  function ensurePos(el) {
    if (pos) return;
    const r = el.getBoundingClientRect();
    pos = {
      x: Number.isFinite(r.left) ? r.left : Math.max(12, w.innerWidth - 90),
      y: Number.isFinite(r.top) ? r.top : Math.max(12, w.innerHeight - 320)
    };
  }

  function clampPos(el) {
    ensurePos(el);
    const r = el.getBoundingClientRect();
    const maxX = Math.max(4, w.innerWidth - Math.min(Math.max(r.width, 48), w.innerWidth) - 4);
    const maxY = Math.max(4, w.innerHeight - Math.min(Math.max(r.height, 40), w.innerHeight) - 4);
    pos.x = clamp(pos.x, 4, maxX);
    pos.y = clamp(pos.y, 4, maxY);
  }

  function placeBar(el) {
    ensurePos(el);
    clampPos(el);

    const horizontal = orientation() === 'horizontal';
    const set = (k, v) => el.style.setProperty(k, v, 'important');

    set('position', 'fixed');
    set('left', `${Math.round(pos.x)}px`);
    set('top', `${Math.round(pos.y)}px`);
    set('right', 'auto');
    set('bottom', 'auto');
    set('transform', 'none');
    set('display', 'flex');
    set('flex-direction', horizontal ? 'row' : 'column');
    set('flex-wrap', 'nowrap');
    set('gap', '3px');
    set('width', 'auto');
    set('max-width', 'calc(100vw - 8px)');
    set('z-index', '9999');
    set('transition', 'none');
  }

  function paintBar(el) {
    const accent = getAccent();
    const horizontal = orientation() === 'horizontal';

    el.style.setProperty('background', 'rgba(255,255,255,.96)', 'important');
    el.style.setProperty('border', `1px solid ${accent}40`, 'important');
    el.style.setProperty('border-radius', '14px', 'important');
    el.style.setProperty('padding', '6px', 'important');
    el.style.setProperty('box-shadow', '0 4px 16px rgba(0,0,0,.10)', 'important');
    el.style.setProperty('backdrop-filter', 'blur(12px)', 'important');
    el.style.setProperty('-webkit-backdrop-filter', 'blur(12px)', 'important');

    for (const button of barButtons(el)) {
      const text = cleanText(button.textContent);
      const active = CORE_LABELS.includes(text);

      button.style.setProperty('background', active ? `${accent}1F` : '#F2F2F7', 'important');
      button.style.setProperty('color', active ? accent : '#8E8E93', 'important');
      button.style.setProperty('border', `1px solid ${active ? accent + '50' : '#E5E5EA'}`, 'important');
      button.style.setProperty('border-radius', '7px', 'important');
      button.style.setProperty('padding', horizontal ? '2px 0' : '4px 0', 'important');
      button.style.setProperty('font-size', horizontal ? '9px' : '10px', 'important');
      button.style.setProperty('font-weight', '600', 'important');
      button.style.setProperty('box-shadow', 'none', 'important');
      button.style.setProperty('text-align', 'center', 'important');
      button.style.setProperty('white-space', 'nowrap', 'important');
      button.style.setProperty('width', horizontal ? '34px' : '48px', 'important');
      button.style.setProperty('min-width', horizontal ? '34px' : '48px', 'important');
      button.style.setProperty('max-width', horizontal ? '34px' : '48px', 'important');
      button.style.setProperty('box-sizing', 'border-box', 'important');
    }
  }

  // ------------------------------
  // drag
  // ------------------------------
  function installDrag(el) {
    if (el.dataset.zetaReviewFloatDrag === '1') return;
    el.dataset.zetaReviewFloatDrag = '1';

    const onDown = event => {
      if (event.pointerType !== 'touch' && event.button !== 0) return;

      ensurePos(el);
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: pos.x,
        baseY: pos.y,
        moved: false
      };

      try { el.setPointerCapture?.(event.pointerId); } catch (_) {}
    };

    const onMove = event => {
      if (!drag || drag.id !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (!drag.moved) return;

      pos = { x: drag.baseX + dx, y: drag.baseY + dy };
      clampPos(el);
      placeBar(el);

      if (event.cancelable) event.preventDefault();
    };

    const finish = event => {
      if (!drag || drag.id !== event.pointerId) return;

      const moved = drag.moved;
      drag = null;
      try { el.releasePointerCapture?.(event.pointerId); } catch (_) {}

      if (!moved) return;

      userMoved = true;
      suppressNextClick = true;
      clampPos(el);
      placeBar(el);
      paintBar(el);
      savePos();

      if (event.cancelable) event.preventDefault();
    };

    const suppressClick = event => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointermove', onMove, true);
    el.addEventListener('pointerup', finish, true);
    el.addEventListener('pointercancel', finish, true);
    el.addEventListener('click', suppressClick, true);
  }

  function applyStyle(el, force = false) {
    if (!el) return;

    barEl = el;

    // Important for the universal floating-folder script:
    // treat this whole quickbar as one draggable toolbar.
    el.setAttribute(MARK_ATTR, 'true');

    installDrag(el);
    placeBar(el);
    paintBar(el);
  }

  // ------------------------------
  // lifecycle
  // ------------------------------
  function discover() {
    if (stopped) return;

    const found = findBar();
    if (!found) {
      barEl = null;
      return;
    }

    if (barEl !== found) {
      barEl = found;
      applyStyle(found, true);
    } else {
      applyStyle(found, false);
    }
  }

  function queueDiscover() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(discover, 80);
  }

  async function start() {
    installStoreBridge();
    installAccentBridge();
    await loadPos();

    discover();

    observer = new MutationObserver(queueDiscover);
    observer.observe(d.documentElement, { childList: true, subtree: true });

    w.addEventListener('resize', () => {
      if (!barEl?.isConnected) return;
      clampPos(barEl);
      applyStyle(barEl, true);
    }, { passive: true });

    // Theme/bubble color may change without recreating the bar.
    w.setInterval(() => {
      if (barEl?.isConnected && visible(barEl)) paintBar(barEl);
    }, 1200);
  }

  function stop() {
    stopped = true;
    clearTimeout(refreshTimer);
    clearInterval(accentTimer);
    observer?.disconnect();
    pendingStore.clear();

    if (barEl?.isConnected) {
      barEl.removeAttribute(MARK_ATTR);
      delete barEl.dataset.zetaReviewFloatDrag;
    }

    try { delete w[INSTANCE_KEY]; } catch (_) { w[INSTANCE_KEY] = undefined; }
  }

  w[INSTANCE_KEY] = { stop, rescan: discover };

  if (d.documentElement) start();
  else d.addEventListener('DOMContentLoaded', start, { once: true });
})();

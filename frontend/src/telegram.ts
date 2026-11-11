import {useEffect} from 'react';
interface TelegramApp {
 initData:string;colorScheme:'light'|'dark';themeParams:Record<string,string>;ready():void;expand():void;
 BackButton:{show():void;hide():void;onClick(cb:()=>void):void;offClick(cb:()=>void):void};
 onEvent(name:string,cb:()=>void):void;offEvent(name:string,cb:()=>void):void;
 viewportStableHeight:number;safeAreaInset?:{top:number;bottom:number};contentSafeAreaInset?:{top:number;bottom:number};
}
declare global {interface Window {Telegram?:{WebApp:TelegramApp}}}
export const telegram=()=>{
 const app=window.Telegram?.WebApp;
 // В обычном браузере скрипт Telegram существует, но это не Telegram-контекст.
 // Не переопределяем системную тему его фиктивным colorScheme=light.
 return app?.initData?app:undefined;
};
export function useTelegram(back?:()=>void) {
 useEffect(()=>{
  const tg=telegram();if(!tg) return;
  const update=()=>{
   document.documentElement.dataset.theme=tg.colorScheme;
   for(const [key,value] of Object.entries(tg.themeParams)) document.documentElement.style.setProperty('--tg-theme-'+key.replaceAll('_','-'),value);
   document.documentElement.style.setProperty('--telegram-height',`${tg.viewportStableHeight}px`);
   for(const side of ['top','bottom'] as const) document.documentElement.style.setProperty(`--safe-${side}`,`${(tg.safeAreaInset?.[side]??0)+(tg.contentSafeAreaInset?.[side]??0)}px`);
  };
  tg.ready();tg.expand();update();
  for(const event of ['themeChanged','viewportChanged','safeAreaChanged','contentSafeAreaChanged']) tg.onEvent(event,update);
  return ()=>{for(const event of ['themeChanged','viewportChanged','safeAreaChanged','contentSafeAreaChanged']) tg.offEvent(event,update);};
 },[]);
 useEffect(()=>{
  const button=telegram()?.BackButton;if(!button) return;
  if(!back) {button.hide();return;}
  button.show();button.onClick(back);return ()=>{button.offClick(back);button.hide();};
 },[back]);
}

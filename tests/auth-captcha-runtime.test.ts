import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as captchaContract from '../contracts/auth-captcha.ts';

function load(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url),'utf8'), {
    compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, (...args: any[]) => any> = {};
  vm.runInNewContext(compiled, { exports, URL, __DEV__:false, location:{origin:'https://fixture.invalid'}, ...globals,
    require: (name: string) => {
      if (name === 'react/jsx-runtime') return { jsx:(type: unknown, props: unknown) => ({type,props}) };
      if (!(name in mocks)) throw new Error(`Unmocked ${name}`);
      return mocks[name];
    },
  });
  return exports;
}

test('native WebView only accepts correlated messages from the configured page', () => {
  const results: unknown[] = [];
  const exports = load('../components/auth-captcha-frame.tsx', {
    'react-native-webview':{WebView:'WebView'}, '@/contracts/auth-captcha':captchaContract,
  });
  const url = 'https://fixture.invalid/auth/captcha'; const nonce = 'fixture-nonce';
  const {props} = exports.AuthCaptchaFrame({url,nonce,onResult:(r:unknown) => results.push(r)});
  for (const [origin,tokenNonce] of [['https://untrusted.invalid',nonce],[url,'wrong']]) {
    props.onMessage({nativeEvent:{url:origin,data:JSON.stringify({type:'kad-captcha',nonce:tokenNonce,token:'fixture-token'})}});
  }
  assert.equal(results.length,0);
  props.onMessage({nativeEvent:{url,data:JSON.stringify({type:'kad-captcha',nonce,token:'fixture-token'})}});
  assert.deepEqual(results,[{token:'fixture-token'}]);
  assert.equal(props.allowFileAccess,false); assert.equal(props.mixedContentMode,'never');
  assert.equal(props.onShouldStartLoadWithRequest({url,isTopFrame:true}),true);
  assert.equal(props.onShouldStartLoadWithRequest({url:'https://untrusted.invalid',isTopFrame:true}),false);
  assert.equal(props.onShouldStartLoadWithRequest({url:'intent://external',isTopFrame:true}),false);
  assert.equal(props.onShouldStartLoadWithRequest({url:'file:///private',isTopFrame:false}),false);
  assert.equal(props.onShouldStartLoadWithRequest({url:'https://challenges.cloudflare.com/widget',isTopFrame:false}),true);
});

test('late native CAPTCHA callbacks cannot resolve or cancel a newer attempt', async () => {
  const values: any[] = []; let cursor = 0; let nonce = 0;
  const timers = new Set<() => void>();
  const effects: (() => void)[] = [];
  const exports = load('../hooks/use-auth-captcha.tsx', {
    react: {
      useState:(initial:unknown) => { const index=cursor++; if (!(index in values)) values[index]=initial; return [values[index],(value:unknown)=>{values[index]=value;}]; },
      useRef:(initial:unknown) => { const index=cursor++; return values[index] ??= {current:initial}; },
      useCallback:(fn:unknown)=>fn,
      useEffect:(effect:()=>()=>void)=>{ if (!effects.length) effects.push(effect()); },
    },
    'react-native': {Modal:'Modal',Text:'Text',View:'View',StyleSheet:{create:(value:unknown)=>value}},
    'expo-crypto': {randomUUID:()=>`fixture-${++nonce}`},
    '@/components/auth-captcha-frame':{}, '@/components/ui/button':{}, '@/hooks/use-theme':{},
    '@/contracts/auth-captcha':captchaContract,
  }, {
    process:{env:{EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED:'true',EXPO_PUBLIC_AUTH_CAPTCHA_URL:'https://fixture.invalid/auth/captcha'}},
    setTimeout:(callback:()=>void)=>{timers.add(callback);return callback;},
    clearTimeout:(callback:()=>void)=>timers.delete(callback),
  });
  const render=()=>{cursor=0;return exports.useAuthCaptcha();};
  const first=render().requestCaptcha();
  const firstView=render().captchaView;
  const oldTimeout=[...timers][0];
  firstView.props.finish({token:'first-token'});
  assert.equal((await first).token,'first-token');
  let secondSettled=false;
  const second=render().requestCaptcha().then((value:any)=>{secondSettled=true;return value;});
  const secondView=render().captchaView;
  try {
    assert.notEqual(firstView.props.challenge.nonce,secondView.props.challenge.nonce);
    for (const result of [{error:'late-load-error'},{token:'old-token'}]) firstView.props.finish(result);
    oldTimeout();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(secondSettled,false, 'old frame/timer must not finish the new promise');
    assert.equal(timers.size,1,'the new deadline must remain active');
    secondView.props.finish({token:'second-token'});
    assert.equal((await second).token,'second-token');
    assert.equal(timers.size,0);
  } finally { effects.forEach(cleanup=>cleanup()); }
});

for (const challenge of [{token:'fixture-token'}, {}, {error:'expired'}]) {
  test(`native Auth flows ${'error' in challenge ? 'stop before requests' : 'forward token or disabled config'}`, async () => {
    const calls: { method:string; input:any; options:any }[] = [];
    const auth = Object.fromEntries(['signInWithPassword','signUp','resetPasswordForEmail','resend','signOut'].map(method =>
      [method,async (input:unknown,options:unknown) => { calls.push({method,input,options}); return {data:{session:null},error:null}; }]));
    let state = 0;
    const exports = load('../providers/auth-provider.tsx', {
      react:{createContext:()=>({Provider:'Provider'}),useCallback:(fn:unknown)=>fn,useMemo:(fn:()=>unknown)=>fn(),useEffect:()=>{},useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>[state++ === 0 ? {user:{id:'fixture-user'}} : value,()=>{}]},
      '@react-native-async-storage/async-storage':{default:{}},
      '@supabase/supabase-js':{FunctionsHttpError:class extends Error{}},
      'expo-constants':{default:{expoConfig:{scheme:'kad'}}},'expo-linking':{createURL:(s:string)=>`kad://${s}`},
      'react-native':{Platform:{OS:'web'},AppState:{}},
      '@/lib/auth-errors':{authErrorMessage:()=> 'error'}, '@/hooks/use-auth-captcha':{useAuthCaptcha:()=>({requestCaptcha:async()=>challenge,captchaView:null})},
      '@/contracts/abuse-errors':{}, '@/contracts/auth-captcha':captchaContract, '@/lib/auth-security':{createAuthCallbackReplayGuard:()=>({})},
      '@/lib/supabase':{isSupabaseConfigured:true,supabase:{auth:{...auth,getSession:async()=>({data:{session:{user:{id:'fixture-user'},access_token:'fixture-session'}}})},functions:{invoke:async (method:string,input:unknown)=>{calls.push({method,input,options:undefined});return {error:null};}}}},
    });
    const ctx = exports.AuthProvider({children:null}).props.value;
    for (const action of [() => ctx.signIn('fixture@example.invalid','fixture-password'),
      () => ctx.signUp('Fixture','fixture@example.invalid','fixture-password'),
      () => ctx.sendPasswordReset('fixture@example.invalid'), () => ctx.resendEmailConfirmation('fixture@example.invalid'),
      () => ctx.deleteRemoteAccount('fixture-password')]) {
      const result = await action(); assert.equal(result.ok,!('error' in challenge));
    }
    if ('error' in challenge) assert.equal(calls.length,0);
    else {
      assert.equal(calls.length,6);
      for (const call of calls.filter(c=>c.method!=='signOut')) {
        const actual = call.method === 'delete-account' ? call.input.body.captchaToken
          : call.method === 'resetPasswordForEmail' ? call.options.captchaToken : call.input.options.captchaToken;
        assert.equal(actual,challenge.token);
        if (call.method === 'delete-account') assert.equal(call.input.headers.Authorization,'Bearer fixture-session');
      }
    }
  });
}

test('account change or logout during CAPTCHA cannot authorize account deletion', async () => {
  for (const session of [null,{user:{id:'other-user'},access_token:'fixture-session'}]) {
    assert.equal(await captchaContract.captchaSessionAuthorization('fixture-user',async()=>({data:{session}})),null);
  }
  assert.equal(await captchaContract.captchaSessionAuthorization('fixture-user',async()=>{throw Error('offline');}),null);
});

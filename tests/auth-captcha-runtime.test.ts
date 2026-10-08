import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as captchaContract from '../contracts/auth-captcha.ts';

function load(path: string, mocks: Record<string, unknown>) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url),'utf8'), {
    compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, (...args: any[]) => any> = {};
  vm.runInNewContext(compiled, { exports, URL, __DEV__:false, location:{origin:'https://fixture.invalid'},
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

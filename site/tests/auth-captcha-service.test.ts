import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as captcha from '../../contracts/auth-captcha.ts';
import * as recovery from '../src/core/password-recovery.ts';

function fixture(challenge: {token?: string; error?: string}, switchAccount = false) {
  const calls: {method: string; input: any; options: any}[] = [];
  let owner = 'fixture-a';
  const auth = {
    getSession: async () => ({data:{session:{user:{id:owner},access_token:`fixture-session-${owner}`}}}),
    ...Object.fromEntries(['signInWithPassword','signUp','resetPasswordForEmail','resend'].map(method =>
      [method, async (input:unknown, options:unknown) => {
        calls.push({method,input,options}); return {data:{user:{id:owner},session:null},error:null};
      }])),
  };
  const dependencies: Record<string, unknown> = {
    '@supabase/supabase-js':{createClient:()=>({auth,functions:{invoke:async (method:string,input:unknown)=>{
      calls.push({method,input,options:undefined});return {error:null};
    }}})},
    './auth-captcha.ts':{requestAuthCaptcha:async()=>{if(switchAccount)owner='fixture-b';return challenge;}},
    '../../../contracts/auth-captcha.ts':captcha,
    '@/contracts/deployment-environment.ts':{resolvePublicSupabaseConfig:()=>({ok:true,value:{url:'https://fixture.invalid',publishableKey:'public-fixture'}})},
    '../core/password-security.ts':{createPasswordSecurity:()=>({})},
    '../core/password-recovery.ts':recovery,
    '../core/auth-profile.ts':{buildSignupMetadata:(name:string)=>({name})},
    '../core/checkout-return.ts':{confirmationRouteWithCheckout:()=>'/confirmar-email'},
  };
  const source=readFileSync(new URL('../src/services/supabase.ts',import.meta.url),'utf8').replaceAll('import.meta.env','fixtureEnv');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,(...args:any[])=>Promise<any>>={};
  vm.runInNewContext(compiled,{exports,URL,fixtureEnv:{},location:{origin:'https://fixture.invalid'},
    require:(name:string)=>dependencies[name]??{},
  });
  return {calls,actions:exports};
}

for (const challenge of [{token:'fixture-captcha'}, {}, {error:'cancelled'}]) {
  test(`site Auth service forwards token/disabled flag or stops on challenge error: ${JSON.stringify(challenge)}`, async () => {
    const {calls,actions}=fixture(challenge);
    for (const action of [()=>actions.signIn('fixture@example.invalid','fixture-password'),
      ()=>actions.signUp({name:'Fixture',email:'fixture@example.invalid',password:'fixture-password'}),
      ()=>actions.resendEmailConfirmation('fixture@example.invalid'),
      ()=>actions.requestPasswordRecovery('fixture@example.invalid'),
      ()=>actions.deleteRemoteAccount('fixture-password')]) {
      assert.equal((await action()).ok,!('error' in challenge));
    }
    assert.equal(calls.length,'error' in challenge?0:5);
    for(const call of calls) {
      assert.equal(call.method==='delete-account'?call.input.body.captchaToken
        :call.method==='resetPasswordForEmail'?call.options.captchaToken:call.input.options.captchaToken,challenge.token);
      if(call.method==='delete-account')assert.equal(call.input.headers.Authorization,'Bearer fixture-session-fixture-a');
    }
  });
}

test('site deletion stops if account changes during the challenge, before invoking the server', async () => {
  const {calls,actions}=fixture({token:'fixture-captcha'},true);
  const result=await actions.deleteRemoteAccount('fixture-password');
  assert.equal(result.ok,false); assert.match(result.message,/sessão mudou/);
  assert.equal(calls.length,0);
});

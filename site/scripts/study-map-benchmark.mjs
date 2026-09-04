// Measures HTML generation only, not device frame rate or memory.
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';
import ts from 'typescript';
import * as catalog from '../src/data/catalog.ts';
import * as utils from '../src/core/utils.ts';
import * as components from '../src/ui/components.ts';
import * as layout from '../src/ui/layout.ts';
import { createStore } from '../src/core/store.ts';
import { questionSessionView } from '../src/views/questions.ts';
const baseline = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'show', '8c17497:site/src/views/questions.ts'], { encoding: 'utf8' });
const exports = {};
const dependencies = { '../data/catalog.ts': catalog, '../core/utils.ts': utils, '../ui/components.ts': components, '../ui/layout.ts': layout };
vm.runInNewContext(ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, require: name => dependencies[name], Intl });
catalog.resetCatalog();
const sample = catalog.getCatalog().questions[0];
catalog.replacePublishedCatalog({ questions: Array.from({ length: 5000 }, (_, i) => ({ ...sample, id: `fixture-${i}` })) });
const state = createStore(undefined).getState();
for (const [name, view] of [['baseline', exports.questionSessionView], ['updated', questionSessionView]]) {
  const ui = { questionIndex: 2500, visitedQuestionIds: new Set() };
  for (let i = 0; i < 10; i++) view(state, {}, ui);
  const times = [];
  let html;
  for (let i = 0; i < 40; i++) {
    const start = performance.now(); html = view(state, {}, ui).content;
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ name, questions: 5000, warmup: 10, samples: 40, medianMs: Number(times[20].toFixed(3)),
    htmlBytes: Buffer.byteLength(html), mapButtons: (html.match(/data-action="go-question"/g) ?? []).length, node: process.version }));
}

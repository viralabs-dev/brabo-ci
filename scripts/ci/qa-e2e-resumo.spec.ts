import { describe, expect, it } from 'vitest';
import { LIMITE_DO_CHECK, NOME_DO_CHECK_POR_MODO, caber, montarCheck, recomendar, secaoMotivos, type FuncionalidadeDoRelatorio, type LinhaDigest, type RelatorioRegressivo, type ResultadoE2e, type SpecDoRelatorio } from './qa-e2e-resumo.ts';

const linhas: LinhaDigest[] = (['api', 'engine', 'web', 'broker', 'backup'] as const).map((s) => ({
  servico: s,
  esperado: `sha256:${s}`,
  encontrado: `sha256:${s}`,
  assinatura: 'ok',
}));
const base: ResultadoE2e = { causa: null, linhas, specsQueFalharam: [], urlDoRun: 'https://run/1' };

describe('montarCheck', () => {
  it('verde', () => {
    const c = montarCheck(base);
    expect(c.conclusion).toBe('success');
    expect(c.title).toBe('E2E verde');
    expect(c.external_id).toBe('causa:');
    expect(c.summary).toContain('| serviço | digest esperado | digest em execução | assinatura |');
    expect(c.summary.split('\n').filter((l) => /^\| (api|engine|web|broker|backup) /.test(l))).toHaveLength(5);
    expect(c.summary).toContain('https://run/1');
  });
  it('digest divergente marca a linha com ❌', () => {
    const l = [...linhas];
    l[0] = { ...l[0]!, encontrado: 'sha256:outro' };
    const c = montarCheck({ ...base, causa: 'digest', linhas: l });
    expect(c.conclusion).toBe('failure');
    expect(c.title).toContain('digest divergente');
    expect(c.external_id).toBe('causa:digest');
    expect(c.summary).toMatch(/\| api .*❌/);
  });
  it('lista as specs que falharam', () => {
    const c = montarCheck({ ...base, causa: 'spec', specsQueFalharam: ['login.spec.ts', 'pop.spec.ts'] });
    expect(c.summary).toContain('login.spec.ts');
    expect(c.summary).toContain('pop.spec.ts');
  });
  it('aceite vira success com a justificativa', () => {
    const c = montarCheck({
      ...base,
      causa: 'spec',
      aceite: { justificativa: 'flaky conhecido', por: 'dono', em: '2026-11-06', urlDoRunVermelho: 'https://run/0' },
    });
    expect(c.conclusion).toBe('success');
    expect(c.title).toBe('Aceito com justificativa');
    for (const t of ['flaky conhecido', 'dono', '2026-11-06', 'https://run/0']) expect(c.summary).toContain(t);
  });
});

describe('modo dev (AT-769)', () => {
  const cobertura = [
    { funcionalidade: 'autenticacao', specs: 3, resultado: 'verde' as const },
    { funcionalidade: 'backlog', specs: 0, resultado: 'sem cobertura' as const },
    { funcionalidade: 'aprovacoes', specs: 1, resultado: 'vermelho' as const },
  ];
  it('o nome do check muda por modo e o da dev não é o do portão', () => {
    expect(NOME_DO_CHECK_POR_MODO.main).toBe('E2E do brabo-qa');
    expect(NOME_DO_CHECK_POR_MODO.dev).toBe('Regressivo do brabo-qa');
  });
  it('tabela por funcionalidade; "sem cobertura" não reprova e vermelho marca ❌', () => {
    const verde = montarCheck({ ...base, modo: 'dev', cobertura: cobertura.slice(0, 2) });
    expect(verde.conclusion).toBe('success');
    expect(verde.title).toBe('Regressivo verde');
    expect(verde.summary).toContain('| funcionalidade | specs | resultado |');
    expect(verde.summary).toContain('| backlog | 0 | sem cobertura |');
    const verm = montarCheck({ ...base, modo: 'dev', causa: 'spec', cobertura });
    expect(verm.conclusion).toBe('failure');
    expect(verm.title).toBe('Regressivo vermelho: spec falhou');
    expect(verm.summary).toContain('| aprovacoes | 1 | vermelho ❌ |');
  });
  it('sem linhas de digest, a tabela de digest não aparece', () => {
    const c = montarCheck({ ...base, modo: 'dev', linhas: [], cobertura });
    expect(c.summary).not.toContain('digest esperado');
  });
  it('neutro e sem dono', () => {
    const n = montarCheck({ ...base, modo: 'dev', neutro: 'sem funcionalidade tocada' });
    expect(n).toMatchObject({ conclusion: 'neutral', title: 'Regressivo neutro' });
    const s = montarCheck({ ...base, modo: 'dev', cobertura, semDono: ['src/zzz/x.ts'] });
    expect(s.summary).toContain('Sem dono no mapa:\n- src/zzz/x.ts');
  });
  it('o modo main segue igual: título E2E e sem tabela de funcionalidade', () => {
    const c = montarCheck(base);
    expect(c.title).toBe('E2E verde');
    expect(c.summary).not.toContain('funcionalidade');
  });
});

describe('montarCheck com vínculos', () => {
  const v = '## Vínculos\n\n| Papel | Repo |\n|---|---|\n| Origem | x |\n\n```mermaid\nflowchart LR\n  O --> E\n```\n';
  it('a tabela entra no texto; o Mermaid não', () => {
    const c = montarCheck({ ...base, vinculos: v });
    expect(c.summary).toContain('## Vínculos');
    expect(c.summary).toContain('| Origem | x |');
    expect(c.summary).not.toContain('mermaid');
  });
  it('entra também no neutro e no aceito', () => {
    expect(montarCheck({ ...base, neutro: 'só docs', vinculos: v }).summary).toContain('| Origem | x |');
    const aceite = { justificativa: 'j', por: 'p', em: 'e', urlDoRunVermelho: 'u' };
    expect(montarCheck({ ...base, causa: 'spec', aceite, vinculos: v }).summary).toContain('| Origem | x |');
  });
  it('sem vínculos o resumo é o de antes', () => {
    expect(montarCheck(base).summary).not.toContain('Vínculos');
  });
});

// ---------- Relatório de decisão (AT-791) ----------

const spec = (o: Partial<SpecDoRelatorio> = {}): SpecDoRelatorio => ({
  funcionalidades: ['autenticacao'], titulo: 'entra', arquivo: 'e2e/testes/login.spec.ts', linha: 10, status: 'passou', tentativas: 1, duracao_ms: 1200, ...o,
});
const func = (o: Partial<FuncionalidadeDoRelatorio> = {}): FuncionalidadeDoRelatorio => ({
  id: 'autenticacao', motivo: ['api: src/auth/x.ts'], specs: 1, passou: 1, falhou: 0, flaky: 0, pulou: 0, duracao_ms: 1200, resultado: 'verde', ...o,
});
const rel = (o: Partial<RelatorioRegressivo> = {}): RelatorioRegressivo => ({
  versao: 1, origem: { repo: 'viralabs-dev/brabo-api', pr: 7, sha: 'abc1234' }, funcionalidades: [func()], specs: [spec()], ...o,
});
const run = 'https://github.com/viralabs-dev/brabo-qa/actions/runs/99';
const comRel = (r: RelatorioRegressivo, o: Partial<ResultadoE2e> = {}) => montarCheck({ ...base, urlDoRun: run, modo: 'dev', relatorio: r, ...o });

describe('recomendar (RN-1051)', () => {
  const falha = (f: string[]) => [spec({ status: 'falhou', funcionalidades: f })];
  it.each([
    ['verde sem flaky', { causa: null, specs: [spec()] }, 'aprovar'],
    ['verde com flaky', { causa: null, specs: [spec({ status: 'flaky' })] }, 'aprovar'],
    ['digest', { causa: 'digest', specs: [] }, 'bloquear'],
    ['assinatura', { causa: 'assinatura', specs: [] }, 'bloquear'],
    ['spec em funcionalidade tocada', { causa: 'spec', specs: falha(['autenticacao']), tocadas: ['autenticacao'] }, 'bloquear'],
    ['spec fora do que a PR toca', { causa: 'spec', specs: falha(['backlog']), tocadas: ['autenticacao'] }, 'aceitar com justificativa'],
    ['spec sem funcionalidade', { causa: 'spec', specs: falha([]), tocadas: ['autenticacao'] }, 'aceitar com justificativa'],
    ['sem `tocadas`, vale bloquear', { causa: 'spec', specs: falha(['backlog']) }, 'bloquear'],
    ['ambiente', { causa: 'ambiente', specs: [] }, 'rodar de novo'],
    ['sem resposta', { causa: 'sem-resposta', specs: [] }, 'rodar de novo'],
  ] as const)('%s', (_n, entrada, acao) => {
    expect(recomendar({ ...entrada, specs: [...entrada.specs] } as Parameters<typeof recomendar>[0]).acao).toBe(acao);
  });
  it('flaky vira aviso e a dev ganha o prefixo de atestado', () => {
    expect(recomendar({ causa: null, specs: [spec({ status: 'flaky' })] }).rotulo).toContain('flaky');
    expect(recomendar({ causa: null, specs: [], modo: 'dev' }).rotulo).toMatch(/^atestado \(não bloqueia\): aprovar/);
    expect(recomendar({ causa: null, specs: [], modo: 'main' }).rotulo).toMatch(/^aprovar/);
  });
});

describe('montarCheck com relatório', () => {
  const vermelho = rel({
    funcionalidades: [func({ passou: 0, falhou: 1, resultado: 'vermelho' }), func({ id: 'backlog', motivo: [], specs: 0, passou: 0, duracao_ms: 0, resultado: 'sem cobertura' })],
    specs: [
      spec({ status: 'falhou', tentativas: 2, erro: '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m)\nlinha 2', anexos: ['trace.zip'] }),
      spec({ funcionalidades: [], titulo: 'solta', arquivo: 'e2e/testes/solta.spec.ts', status: 'flaky', tentativas: 2 }),
      spec({ funcionalidades: [], titulo: 'entrar', arquivo: 'e2e/entrar.setup.ts' }),
    ],
    tocadas: ['autenticacao'],
  });
  it('cabeçalho, recomendação, tabela, falha sem ANSI, flaky, balde e links', () => {
    const c = comRel(vermelho, { causa: 'spec', semDono: ['src/zzz/x.ts'] });
    expect(c.conclusion).toBe('failure');
    expect(c.title).toBe('Regressivo vermelho: spec falhou');
    expect(c.summary).toMatch(/^## Regressivo do brabo-qa: VERMELHO · causa spec/);
    expect(c.summary).toContain('**Recomendação: atestado (não bloqueia): bloquear: spec em funcionalidade que a PR toca (autenticacao); corrigir antes**');
    expect(c.summary).toContain('3 specs · 1 passou · 1 falhou · 1 flaky');
    expect(c.summary).toContain('| autenticacao | 1 | 0 | 1 | 0 | 1.2 s | vermelho ❌ |');
    expect(c.summary).toContain('| sem funcionalidade | 2 |');
    expect(c.summary.indexOf('| backlog |')).toBeGreaterThan(c.summary.indexOf('| autenticacao |'));
    expect(c.summary).toContain('**[f-autenticacao] entra**');
    expect(c.summary).toContain('expect(received)\nlinha 2');
    expect(c.summary).not.toContain('\u001b');
    expect(c.summary).toContain('### Flaky / retry');
    expect(c.summary).toContain('- **autenticacao**: `api: src/auth/x.ts`');
    expect(c.summary).toContain('- sem dono no mapa: `src/zzz/x.ts`');
    expect(c.summary).toContain(`Run: ${run}`);
    expect(c.summary).toContain('relatorio-regressivo-99');
    expect(c.text).toContain('<details><summary>autenticacao');
    expect(c.text).toContain('<details><summary>sem funcionalidade');
    expect(c.text).toContain('(preparação)');
  });
  it('plural: 2 falharam, 3 passaram; spec pulada conta à parte; preparação sai uma vez', () => {
    const c = comRel(
      rel({
        funcionalidades: [func({})],
        specs: [
          spec({ status: 'falhou' }), spec({ status: 'falhou' }), spec({ status: 'passou' }), spec({ status: 'passou' }), spec({ status: 'passou' }),
          spec({ status: 'pulou' }),
          spec({ titulo: 'entrar (preparação)', arquivo: 'e2e/entrar.setup.ts' }),
        ],
      }),
      { causa: 'spec' },
    );
    expect(c.summary).toContain('4 passaram · 2 falharam');
    expect(c.summary).toContain('· 1 pulada');
    expect(c.summary).not.toContain('1 puladas');
    expect(c.text).toContain('· 2 ❌/⚠️ · 1 pulada ⏭️</summary>');
    expect(c.text).not.toContain('(preparação) (preparação)');
  });
  it('verde: aprovar e título verde; o main usa o nome do portão', () => {
    const c = comRel(rel(), { modo: 'main' });
    expect(c.title).toBe('E2E verde');
    expect(c.summary).toContain('## E2E do brabo-qa: VERDE');
    expect(c.summary).toContain('**Recomendação: aprovar: sem falha**');
    expect(c.summary).not.toContain('### Falhas');
  });
  it('digest: o lugar das specs é a tabela de digests', () => {
    const l = [...linhas];
    l[0] = { ...l[0]!, encontrado: 'sha256:outro' };
    const c = comRel(rel(), { causa: 'digest', linhas: l });
    expect(c.summary).toContain('Causa: E2E vermelho: digest divergente');
    expect(c.summary).toContain('### Digests e assinatura');
    expect(c.summary).toContain('Recomendação: atestado (não bloqueia): bloquear');
  });
  it('escapa texto de PR: pipe, crase, < e cerca', () => {
    const c = comRel(rel({ specs: [spec({ titulo: 'a|b`c<d>', status: 'falhou', erro: 'x ``` y' })] }), { causa: 'spec' });
    expect(c.summary).toContain("a\\|b'c&lt;d>");
    expect(c.summary).not.toContain('``` y');
  });
  it('sem relatório o resultado é o de antes, sem text', () => {
    expect('text' in montarCheck(base)).toBe(false);
  });
});

describe('caber (65 535)', () => {
  it('500 specs falsas: summary e text ficam abaixo do limite do check, com aviso de corte', () => {
    const specs = Array.from({ length: 500 }, (_, i) =>
      spec({ funcionalidades: ['autenticacao', 'backlog'], titulo: `spec número ${i} ${'x'.repeat(150)}`, arquivo: `e2e/testes/${'d'.repeat(100)}${i}.spec.ts`, status: i % 7 === 0 ? 'falhou' : 'passou', erro: Array.from({ length: 40 }, (_, k) => `linha ${k} ${'e'.repeat(250)}`).join('\n'), anexos: ['trace.zip', 'screenshot.png'] }),
    );
    const grande = rel({
      specs,
      funcionalidades: [func({ specs: 500, passou: 400, falhou: 100, resultado: 'vermelho' }), func({ id: 'backlog', specs: 500, passou: 400, falhou: 100, resultado: 'vermelho' })],
    });
    const c = comRel(grande, { causa: 'spec', vinculos: '## Vínculos\n\n| a | b |\n|---|---|\n' });
    expect(c.summary.length).toBeLessThanOrEqual(65_535);
    expect(c.summary.length).toBeLessThanOrEqual(LIMITE_DO_CHECK);
    expect(c.text!.length).toBeLessThanOrEqual(LIMITE_DO_CHECK);
    expect(c.summary).toMatch(/… \d+ itens a mais no artefato relatorio-regressivo-99/);
    expect(c.text).toMatch(/… \d+ itens a mais no artefato relatorio-regressivo-99/);
    expect(c.summary).toMatch(/^## Regressivo do brabo-qa: VERMELHO/);
  });
  it('cabe: devolve inteiro e sem aviso', () => {
    expect(caber([{ texto: 'a', prioridade: 1 }, { texto: 'b', prioridade: 2 }])).toEqual({ texto: 'a\n\nb', truncado: false });
  });
  it('estourou: tira primeiro a seção de maior prioridade e deixa o aviso', () => {
    const r = caber([{ texto: 'cabeçalho', prioridade: 1 }, { texto: 'x'.repeat(100), prioridade: 5 }, { texto: 'tabela', prioridade: 2 }], 90, 'art');
    expect(r.truncado).toBe(true);
    expect(r.texto).toContain('cabeçalho');
    expect(r.texto).toContain('tabela');
    expect(r.texto).not.toContain('xxx');
    expect(r.texto).toContain('… 1 itens a mais no artefato art');
    expect(r.texto.length).toBeLessThanOrEqual(90);
  });
  it('nem uma seção cabe: corta o texto e respeita o limite', () => {
    const r = caber([{ texto: 'y'.repeat(500), prioridade: 1 }], 100);
    expect(r.texto.length).toBeLessThanOrEqual(100);
    expect(r.texto).toContain('itens a mais');
  });
});

describe('secaoMotivos', () => {
  it('vazia quando não há motivo', () => {
    expect(secaoMotivos([{ id: 'a', motivo: [] }])).toBe('');
  });
});

describe('aceite preserva o relatório (AT-791)', () => {
  const aceite = { justificativa: 'flaky conhecido do login', por: 'dono', em: '2026-11-08', urlDoRunVermelho: 'https://run/0' };
  const vermelho = comRel(rel({ specs: [spec({ status: 'falhou' })], tocadas: ['autenticacao'] }), { causa: 'spec' });
  it('o resumo e o texto do vermelho seguem sob o bloco do aceite, e cita contra a recomendação', () => {
    const c = montarCheck({ ...base, causa: 'spec', aceite, resumoAnterior: vermelho.summary, textoAnterior: vermelho.text });
    expect(c.conclusion).toBe('success');
    expect(c.title).toBe('Aceito com justificativa');
    expect(c.summary).toContain('Aceito por @dono em 2026-11-08.');
    expect(c.summary).toContain('(aceito contra a recomendação)');
    expect(c.summary).toContain('| autenticacao | 1 |');
    expect(c.summary.indexOf('Aceito por')).toBeLessThan(c.summary.indexOf('## Regressivo'));
    expect(c.text).toBe(vermelho.text);
    expect(c.external_id).toBe('causa:spec');
  });
  it('recomendação "aceitar" não marca contra', () => {
    const v = comRel(rel({ specs: [spec({ status: 'falhou', funcionalidades: ['backlog'] })], tocadas: ['autenticacao'] }), { causa: 'spec' });
    const c = montarCheck({ ...base, causa: 'spec', aceite, resumoAnterior: v.summary });
    expect(c.summary).toContain('Recomendação do relatório: atestado (não bloqueia): aceitar com justificativa');
    expect(c.summary).not.toContain('contra a recomendação');
  });
  it('resumo anterior gigante continua dentro do limite', () => {
    const c = montarCheck({ ...base, causa: 'spec', aceite, resumoAnterior: 'z'.repeat(70_000) });
    expect(c.summary.length).toBeLessThanOrEqual(LIMITE_DO_CHECK);
    expect(c.summary).toContain('Aceito por @dono');
  });
  it('sem resumo anterior o aceite é o de antes', () => {
    expect(montarCheck({ ...base, causa: 'spec', aceite }).summary).toContain('| serviço |');
  });
});

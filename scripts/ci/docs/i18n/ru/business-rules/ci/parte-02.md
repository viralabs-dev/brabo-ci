---
traducao_de: 1c63ebcf9d7719601a0fe7777f0d97952aa6e76e
id: rn-ci-parte-02
title: 'Regras de negócio — CI — часть 2 (с RN-1031)'
sidebar_label: 'CI — часть 2 (с RN-1031)'
description: 'As RNs hospedadas na raiz ci.'
keywords: [regras de negócio, ci]
---

# CI — часть 2 (с RN-1031)

## Регрессионный прогон по функциональности и связи запусков (RN-1031..1035, RN-1043..1045) {#o-regressivo-por-funcionalidade-e-os-vínculos-dos-runs-rn-10311035-rn-10431045}

<a id="rn-1031"></a>

### RN-1031 — Каталог функциональностей и карта путь → функциональность живут в одном файле, а spec привязывается тегом {#rn-1031}

`brabo-qa/funcionalidades.yml` — единственный источник: у каждой функциональности
есть `id` (kebab-case, стабильный, никогда не переименовывается; вывод из
обращения — это `status: aposentada`), `nome`, `descricao`, `tema` (из `temas.yml`
ADR), `status` и `caminhos: {<repo>: [globs]}`. Файл живёт в `brabo-qa`, а не в
`brabo-contracts`, потому что contracts потребляется по TAG, и каждая правка карты
превращалась бы в тег и обновление у шести потребителей. Spec Playwright
привязывается к функциональности тегом самого теста (`{ tag: '@f-<id>' }`), а
фильтр — это `--grep`: каталог не хранит список файлов. Тест `brabo-qa` отклоняет
повторяющийся id или id не в kebab-case, тему вне `temas.yml`, glob, который не
совпал ни с одним файлом соседнего репозитория (протухшая карта), и тег
`@f-<id>` без записи; функциональность без spec просто перечисляется.

- **Код:** `funcionalidades.yml:1` (каталог и контракт файла),
  `scripts/ci/funcionalidades.ts:29` (`validarCatalogo`)
- **Тест:** `scripts/ci/funcionalidades.spec.ts` (валидатор) и
  `scripts/ci/qa-regressivo-catalogo-real.spec.ts:12` (в реальном каталоге 14
  активных функциональностей и globs, которые совпадают)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-769 (EP-033)

<a id="rn-1032"></a>

### RN-1032 — PR в `dev` запускает регрессионный прогон только затронутых функциональностей под проверкой `Regressivo do brabo-qa`, которая НИКОГДА не обязательна {#rn-1032}

В PR с целью `dev` job `regressivo-dev` из `qa-e2e-gatilho.yml` сопоставляет
файлы PR с картой из [RN-1031](#rn-1031) и запускает `brabo-qa` с затронутыми
функциональностями. Результат возвращается как проверка `Regressivo do
brabo-qa`, создаваемая App на `head_sha`: `success`, `failure` (видна, но merge
остаётся свободным) или `neutral` (ничего не затронуто, только docs, PR из форка,
репозиторий без spec). Имя намеренно отличается от `E2E do brabo-qa`: ruleset
«main требует E2E» привязывает именно тот контекст, а регрессионный прогон не
входит ни в один ruleset (`rulesets.md` фиксирует строку «не обязателен»). У job
есть `continue-on-error`, `/qa-aceitar` на `dev` не применяется, а App один раз
оставляет комментарий-напоминание, когда карта говорит, что функциональность
затронута, а ни один spec `@f-<id>` не изменился.

- **Код:** `.github/workflows/qa-e2e-gatilho.yml:74` (job
  `regressivo-dev`, с `continue-on-error`), `scripts/ci/qa-e2e-resumo.ts:22`
  (имя проверки по режиму), `scripts/ci/qa-regressivo-lembrete.ts`
  (единственный комментарий-напоминание)
- **Тест:** `scripts/ci/qa-e2e-resumo.spec.ts` (имя по режиму) и
  `scripts/ci/qa-regressivo-selecao.spec.ts:33` (выбор по карте) и
  `scripts/ci/qa-regressivo-lembrete.spec.ts` (напоминание)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-769 (EP-033)

<a id="rn-1033"></a>

### RN-1033 — Три правила сквозных файлов действуют раньше карты: ничего, весь каталог и без владельца {#rn-1033}

По порядку: (1) docs, `*.md`, `CHANGELOG.md`, `.github/**` (кроме самого
`qa-e2e.yml`), тесты репозитория и `.claude/**` не затрагивают функциональность, и
проверка выходит `neutral`; (2) lockfile и манифесты, `Dockerfile`, точка входа
приложения, схема и миграции, клиент web, `config/**` engine и набор
`brabo-qa` (`e2e/suporte/**`, `playwright.config.ts`) запускают весь каталог, и
сюда же попадает повышение TAG contracts; (3) путь, который не совпал ни с одним
glob, запускает smoke `instalacao` + `autenticacao`, а сводка перечисляет его как
«без владельца в карте», чтобы карту исправили. У `brabo-contracts` нет
регрессионного прогона в собственном PR.

- **Код:** `scripts/ci/qa-regressivo-selecao.ts:67` (`selecionar`),
  `scripts/ci/qa-regressivo-selecao.ts:43` (`SMOKE`)
- **Тест:** `scripts/ci/qa-regressivo-selecao.spec.ts:41` (правило 1),
  `:55` (правило 2 по репозиторию), `:58` (правило 3)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-769 (EP-033)

<a id="rn-1075"></a>

### RN-1075 — `brabo-runner` подтверждается собственным CI: бинарник linux-x64 входит в PR, а контракт с engine проверяется только в TP-01 {#rn-1075}

У `brabo-runner` нет `qa-e2e.yml`, образа и spec `@f-runner`/`@f-projetos` в `brabo-qa`; регрессия каталога не запускается в его PR (решение владельца от 08.11.2026, вариант b). PR подтверждается заданием `runner` его `ci.yml`: lint, типы, тесты, `dist` со `smoke` и бинарник linux-x64 с `build:bin` + `smoke:bin` (`--self-test-pty`, настоящий PTY). **Контракт runner ↔ engine** (join с ticket, возможности, exec, папка) в PR **не** проверяется: только в живом TP-01. Ключи `runner` в `funcionalidades.yml` остаются в каталоге и служат только карте.

- **Код:** задание `runner` в `.github/workflows/ci.yml` репозитория `brabo-runner`
- **Тест:** само задание (лог с `ok:` от `--self-test-pty`)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-853 (EP-033)

<a id="rn-1034"></a>

### RN-1034 — PR в `main` запускает весь каталог в `E2E do brabo-qa`, а функциональность без spec показывается как «без покрытия» и не проваливает проверку {#rn-1034}

Проверка `E2E do brabo-qa` ([ADR 0267](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0267-o-e2e-do-brabo-qa-e-portao-da-main.md))
запускает все spec и собирает таблицу `funcionalidade | specs | resultado`.
Функциональность каталога без spec попадает как `sem cobertura` и **не
проваливает** проверку (решение владельца от 06/11/2026): при обратном правиле
`main` неделями была бы красной, а `/qa-aceitar` стал бы рутиной. Существующие
тесты проходят без изменений; красное по `spec` или `ambiente` по-прежнему можно
принять через `/qa-aceitar`, а по `digest` или `assinatura` — никогда.

- **Код:** `scripts/ci/qa-e2e-resumo.ts:28` (результат `sem cobertura` в строке
  таблицы), `scripts/ci/qa-e2e-resumo.ts:22` (имя проверки `main`)
- **Тест:** `scripts/ci/qa-e2e-resumo.spec.ts` (таблица и строка «без
  покрытия»)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-769 (EP-033)

<a id="rn-1035"></a>

### RN-1035 — PR в `dev` публикует подписанный образ `sha-<12>` только своего репозитория, а очистка удаляет осиротевшие {#rn-1035}

Чтобы регрессионному прогону было что запускать, `ci.yml` у api, engine, web и
broker публикует `ghcr.io/viralabs-dev/brabo-<app>:sha-<12 primeiros do head>`
и тогда, когда база — `dev`, с Trivy и keyless `cosign sign`, как в `main`. PR из
форка не получает секретов: образ пропускается, а регрессионный прогон сообщает
«не запускается в PR из форка». Триггер использует `sha-<12>` в репозитории PR и
самый новый `-dev.N` в остальных. Каждый `synchronize` оставляет осиротевший
`sha-*`, поэтому `limpeza-ghcr.yml` удаляет каждый `sha-*` закрытого PR и те,
которым больше 7 дней.

- **Код:** `scripts/ci/qa-e2e-imagens.ts:83` (выбор `sha-<12>` для
  `dev` и `hotfix`)
- **Тест:** `scripts/ci/qa-e2e-imagens.spec.ts` (выбор по базе)
- **ADR:** [0268](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0268-o-brabo-qa-tem-regressivo-por-funcionalidade.md)
- **Источник:** AT-769 (EP-033)

<a id="rn-1043"></a>

### RN-1043 — Каждый запуск, читающий другой репозиторий, публикует `## Vínculos` в начале Summary, а хелпер никогда не проваливает job {#rn-1043}

Через action `vinculos` из `brabo-ci` Summary каждого job, связывающего
репозитории, содержит таблицу `## Vínculos` (источник, соседи `repo@SHA` со
ссылкой, назначение и запущенные runs) и диаграмму Mermaid — сразу после
checkout. Каждое значение проходит через regex до попадания в Markdown:
репозиторий `viralabs-dev/brabo(-x)?`, SHA из 40 hex, числовой PR, URL GitHub
организации, актор. То, что не совпало, превращается в `?` и `::warning::`.
Некорректный `origem` просто отбрасывается с предупреждением. У шага стоит
`continue-on-error`: хелпер никогда не проваливает job. В `brabo` `docs-check`,
`docs-deploy`, `docs-audit` и `regenera-gerados` передают SHA из
`.git/irmaos-sha.lst`, который записывает `montar-layout.sh`
([ADR 0274](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0274-os-gerados-leem-os-irmaos-por-uma-trava-de-shas.md)), а
`release.yml` передаёт `infra` по пути.

- **Код:** `scripts/ci/vinculos.ts:57` (`montar`), `.github/actions/vinculos/action.yml:31`
  (`continue-on-error`), `scripts/ci/validar-payload.ts:112` (`validarOrigem`),
  `.github/workflows/docs-check.yml:89` (`brabo` передаёт соседей)
- **Тест:** `scripts/ci/vinculos.spec.ts` (fixtures, вредоносное значение, пустой
  источник) и `scripts/ci/validar-payload.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Источник:** AT-773 (EP-033)

<a id="rn-1044"></a>

### RN-1044 — У целевого запуска dispatch или тега есть `run-name` с источником, а корреляция dispatch передаётся в имени как `c=<run_id>-<attempt>` {#rn-1044}

`run-name` переиспользуемого workflow игнорируется: действует имя вызывающего.
`e2e-pr.yml` из `brabo-qa` называется `E2E ← <repo>#<pr> · <sha7> · <ator> · c=<correlação>`
(`Regressivo ← …` в режиме dev); запуски, вызванные тегом, такие как `release` и
`install-e2e` из `brabo`, — `release <tag> ← tag do carimbo`. `repository_dispatch`
отвечает 204 без id, а `client_payload` не виден в API runs; запрашивать можно
только `display_title`. Поэтому триггер шлёт `origem.correlacao =
<run_id>-<attempt>`, которое попадает в `run-name`, а `qa-e2e-disparar.ts` опрашивает
runs `brabo-qa` каждые 5 с до 60 с, сопоставляя `c=`. `attempt` делает
корреляцию уникальной для каждого re-run. Старый payload без `origem` даёт пустые
поля и ничего не ломает. Источник запуска, вызванного тегом, берётся из строки
`Carimbo: <url>`, которую `tag-release` записывает в сообщение аннотированного тега.

- **Код:** `scripts/ci/qa-e2e-imagens.ts:113` (`origem.correlacao` в
  payload), `scripts/ci/qa-e2e-vinculos.ts:18` (`acharRun`),
  `scripts/ci/qa-e2e-disparar.ts:133` (корреляция), `scripts/ci/tag-release.ts:35`
  (`comCarimbo`), `.github/workflows/release.yml:3` (`run-name` тега)
- **Тест:** `scripts/ci/qa-e2e-vinculos.spec.ts` (сопоставление `c=`) и
  `scripts/ci/qa-e2e-imagens.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Источник:** AT-773 (EP-033)

<a id="rn-1045"></a>

### RN-1045 — Проверка App указывает на запуск `brabo-qa` с самого начала, а исходный запуск записывает ссылку на запущенный {#rn-1045}

Job `anunciar` из `e2e-pr.yml`, без `needs` и параллельно с `e2e`, обновляет
проверку по `check_run_id` из payload, указывая `details_url` запуска `brabo-qa` и
Vínculos, с токеном App только с `checks: write` и чистым checkout `dev`.
`fechar` в конце сохраняет `details_url` и прикладывает Vínculos. Сбой `anunciar`
лишь предупреждает. В исходном запуске триггер записывает в `disparados` запуск
`brabo-qa`, найденный по корреляции из [RN-1044](#rn-1044); если за 60 с не нашёл,
записывает ссылку на проверку (которая уже указывает на qa) и предупреждение.
`alarmar-prova.sh` прикладывает `vinculos.md` к телу issue, когда файл существует.

- **Код:** `scripts/ci/fechar-check.ts:39` (Vínculos при закрытии),
  `scripts/ci/qa-e2e-vinculos.ts:42` (`vinculosDoGatilho`),
  `scripts/ci/qa-e2e-disparar.ts:154` (предупреждение, когда запуск не найден)
- **Тест:** `scripts/ci/fechar-check.spec.ts` и `scripts/ci/qa-e2e-vinculos.spec.ts`
- **ADR:** [0271](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0271-os-runs-do-actions-mostram-os-vinculos-entre-os-repos.md)
- **Источник:** AT-773 (EP-033)

## Публикация npm-пакетов (RN-1042) {#publicação-de-pacotes-npm-rn-1042}

<a id="rn-1042"></a>

### RN-1042 — Пакет выходит только по тегу, с dist-tag версии и одной и той же версией во всех пакетах {#rn-1042}

`publish-npm.yml` переиспользуемый и запускается, когда вызывающий вызывает его по
тегу (`on: push: tags: ['v*']`). `scripts/ci/publish-npm.ts` берёт версию из тега
(без `v`) и принимает только `vX.Y.Z` или `vX.Y.Z-dev.N`; любая другая форма
отклоняется до публикации. `-dev.N` идёт в dist-tag `dev`; финальная — в `latest`,
а одиночный pre-release никогда не занимает `latest`. Каждый пакет из списка
получает одну и ту же версию (`npm version --no-git-tag-version`) до `pnpm pack`,
а `actions/attest` и `npm publish` используют один и тот же `.tgz`, без
`--provenance`. Повторная публикация версии проходит, только если registry уже
хранит тот же файл (тот же `dist.integrity`); другая целостность отклоняется.

- **Код:** `scripts/ci/publish-npm.ts:17` (`versaoDaTag`), `scripts/ci/publish-npm.ts:25`
  (`distTag`), `.github/workflows/publish-npm.yml:90` (одна версия в пакетах),
  `.github/workflows/publish-npm.yml:100` (`npm publish` того же `.tgz`)
- **Тест:** `scripts/ci/publish-npm.spec.ts` (dist-tag `dev` и `latest`, отбрасывание `v`)
- **Источник:** AT-770 (EP-033)

## Зависимость merge между репозиториями (RN-1047..1050) {#dependência-de-merge-entre-repositórios-rn-10471050}

<a id="rn-1047"></a>

### RN-1047 — PR объявляет зависимость строкой `Depende-de: viralabs-dev/<repo>#<n>`, а некорректная строка проваливает проверку, а не проходит молча {#rn-1047}

Каждая зависимость merge у PR — это строка тела: `Depende-de:` и далее
`viralabs-dev/<repo>#<n>`, в любом месте текста, с `- ` в начале или без.
Правило сопоставляет построчно и учитывает регистр. Репозиторий должен входить в
список 11 репозиториев `brabo*` из карты родительской папки, владелец должен быть
`viralabs-dev`, PR не может ссылаться на самого себя, а указанный PR должен
существовать (404 проваливает). Строка, которая начинается как объявление
(`Depende-de` или `depende de`), но не подходит под правило, проваливает проверку
с причиной, чтобы опечатка не заставила зависимость исчезнуть. Тело — это текст
третьей стороны: оно попадает в скрипт через переменную окружения и никогда не
интерполируется в `run:`.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (правило и валидация), будет
  опубликован в `brabo-ci`; в `dev` у `brabo` его пока нет
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts`, с regex, allowlist,
  владельцем, самоссылкой и некорректной строкой
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Источник:** AT-787 (EP-033)

<a id="rn-1048"></a>

### RN-1048 — У проверки `Dependências de merge` четыре состояния, никогда не `neutral`, а ожидание жёлтое {#rn-1048}

Проверку публикует App на `head_sha` PR под именем `Dependências de
merge`. Без строки `Depende-de` выходит `success` «Sem dependências declaradas», и
она публикуется всегда, чтобы не оставалась залипшая старая проверка. Если какая-либо
зависимость `OPEN`, выходит `in_progress` (жёлтый) с заголовком `esperando viralabs-dev/<repo>#<n>`,
перечисляющим недостающие. Если все `MERGED`, выходит `success` «Dependências mergeadas».
При зависимости `CLOSED` без merge, при недопустимой строке, цикле или 404
выходит `failure` с причиной; зависимость, закрытая без merge, требует убрать
строку или указать заменяющий её PR, а не ждать вечно. `neutral` не используется
ни в одном случае, потому что для ruleset он считается зелёным. Сам job использует
`continue-on-error`: проваливается проверка, а сбой job лишь предупреждает.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (чистая функция оценки) и
  `.github/workflows/dependencias-de-merge.yml` (переиспользуемый workflow), в `brabo-ci`
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts`, по случаю на каждое состояние
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Источник:** AT-787 (EP-033)

<a id="rn-1049"></a>

### RN-1049 — Merge зависимости обновляет проверку PR, которые на неё ссылаются, а часовой cron — лишь страховочная сеть {#rn-1049}

Когда PR в одном из репозиториев смёрджен, job `avisar-dependentes` в самом
репозитории-владельце смёрдженного PR ищет открытые PR организации, которые
ссылаются на смёрдженный в теле, и заново оценивает каждый. Поиск нечёткий, поэтому
у каждого кандидата тело перепарсивается по правилу [RN-1047](#rn-1047) до любой
записи. Проверка обновляется токеном App, без повторного запуска workflow
зависимого PR. Cron раз в час в `brabo-ci` повторяет тот же обход для открытых PR с
`Depende-de` и покрывает потерянный merge, когда ломается запуск в
репозитории-владельце. Cron включится, только когда `brabo-ci` попадёт в `main`,
потому что `schedule` работает только из ветки по умолчанию.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (режим `avisar-dependentes`) и
  `.github/workflows/dependencias-de-merge.yml` (job и cron), в `brabo-ci`
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts`, с имитацией поиска и
  телом, которое больше не подходит
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Источник:** AT-787 (EP-033)

<a id="rn-1050"></a>

### RN-1050 — Цикл зависимостей проваливает проверку с полным путём, до глубины 5 {#rn-1050}

Оценка идёт по строкам `Depende-de` открытых зависимостей шаг за шагом, до
глубины 5. Если цепочка возвращается к оцениваемому PR, проверка проваливается с
полным путём (`A → B → A`) и ссылкой на каждый PR пути. Глубина больше 5 тоже
проваливает. Выход из цикла — отредактировать тело одного из PR, убрав строку,
замыкающую цикл: PR не нужен bypass.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (обход до глубины 5), в `brabo-ci`
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts`, с циклом A↔B и превышенной глубиной
- **ADR:** [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Источник:** AT-787 (EP-033)

<a id="rn-1071"></a>

### RN-1071 — PR продвижения зависит от открытых продвижений предыдущих слоёв, а порядок — это проверенный список {#rn-1071}

В PR с базой `main` и head `dev` того же репозитория проверка `Dependências de
merge` добавляет к строкам `Depende-de` из тела по зависимости на каждый открытый
PR продвижения в репозиториях предыдущих слоёв, даже если никто её не написал.
Порядок задаёт `CAMADAS_DE_PROMOCAO`: 0 brabo-ci; 1 brabo-contracts и
brabo-workspace; 2 brabo-api, brabo-engine, brabo-web, brabo-runner и brabo-broker;
3 brabo-infra; 4 brabo-qa; 5 brabo. Учитывается только ребро, где `main`
потребителя использует финальный артефакт производителя. В заголовке выводится `esperando viralabs-dev/<repo>#<n>`.
Если у репозитория предыдущего слоя `dev` впереди `main` и нет открытого
продвижения, проверка остаётся pending и называет репозиторий, который нужно
продвинуть (`esperando promoção de viralabs-dev/<repo> (a dev está à frente da main)`).
Открытие продвижения (`abrir-pr-de-promocao.sh`) также пишет строки `Depende-de`
уже открытых продвижений, по мере возможности. Объединение слоёв — это список
`REPOS` без повторов, и spec это охраняет.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (`CAMADAS_DE_PROMOCAO`, `predecessores`, `avaliar`, режим `linhas`) и `scripts/ci/abrir-pr-de-promocao.sh`, в `brabo-ci`
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts` (блок «promoção em camadas»)
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md), пересматривающий решение 7 из [0276](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0276-a-pr-declara-de-que-pr-depende-o-merge.md)
- **Источник:** AT-788 (EP-033)

<a id="rn-1072"></a>

### RN-1072 — Merge продвижения и cron заново оценивают продвижения последующих слоёв {#rn-1072}

Поскольку выведенная зависимость не записана в теле, поиск по `in:body` её не
находит. Поэтому `avisar-dependentes` смёрдженного PR также заново оценивает
открытые продвижения (`base:main head:dev`) репозиториев последующих слоёв, а
`varrer` (часовой cron) включает тот же поиск. Продвижение, открывшееся после
нижележащего, пробуждается собственным событием или cron.

- **Код:** `scripts/ci/dependencias-de-merge.ts` (режимы `avisar-dependentes` и `varrer`)
- **Тест:** `scripts/ci/dependencias-de-merge.spec.ts` (`sucessores`); сам поиск — это GitHub, он будет доказан на следующем продвижении
- **ADR:** [0284](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0284-a-promocao-infere-as-dependencias-pela-ordem-dos-repos.md)
- **Источник:** AT-788 (EP-033)

## Отчёт-решение регрессионного прогона (RN-1051..1053) {#o-relatório-de-decisão-do-regressivo-rn-10511053}

<a id="rn-1051"></a>

### RN-1051 — Отчёт регрессионного прогона строится из одного JSON, а рекомендация следует фиксированному правилу из шести строк {#rn-1051}

Запуск регрессионного прогона `brabo-qa` записывает `relatorio-regressivo.json`
(версия 1) и выводит из него `relatorio-regressivo.md`. Summary, текст проверки и
комментарий в PR — это представления этого JSON, а не отдельные источники.
Рекомендация не пишется вручную: она берётся из первой подошедшей строки, в таком
порядке: зелёный без flaky — **одобрить**; зелёный с flaky — **одобрить**, с
предупреждением и списком; `digest` или `assinatura` — **заблокировать**, потому
что это никогда не принимается (AT-765), а E2E запускается заново; `spec` в
функциональности, которую PR **затрагивает** по карте, — **заблокировать**; `spec`
только в функциональности, которую PR **не** затрагивает, или в «без
функциональности» — **принять с обоснованием** (`/qa-aceitar`); `ambiente` или
`sem-resposta` — **запустить заново**, а если повторится — **принять с
обоснованием**. В режиме `dev` та же метка выходит с префиксом «atestado (não bloqueia)».

- **Код:** `scripts/ci/qa-e2e-resumo.ts:292` (`montarCheck`, который сегодня
  собирает проверку из результата); `relatorio.ts` из `brabo-qa` и JSON v1 в
  `dev` пока не существуют (AT-791, lanes L1 и L2)
- **Тест:** `scripts/ci/qa-e2e-resumo.spec.ts` (проверка по режиму); правило
  рекомендации и JSON v1 получают тест в L1 и L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Источник:** AT-791 (EP-033)

<a id="rn-1052"></a>

### RN-1052 — `/qa-aceitar` сохраняет отчёт о красном и записывает принятие против рекомендации {#rn-1052}

Сегодня принятие заново собирает проверку с `linhas: []` и поэтому стирает таблицу
digests и таблицу функциональностей красного прогона: тот, кто смотрит позже, не
видит, что было принято. Новое правило: `/qa-aceitar` **сохраняет** `summary` и
`text` красной проверки, помещает сверху блок принятия (кто, когда, обоснование,
ссылка на красный запуск и рекомендация, которую давал отчёт) и меняет только
заголовок на `Aceito com justificativa`. Когда рекомендацией было **заблокировать**
из-за spec затронутой функциональности, принятие всё равно действует, потому что
решение за владельцем, но проверка и комментарий фиксируют «принято против
рекомендации». В `dev` принятие не применяется: отчёт — лишь свидетельство.

- **Код:** `scripts/ci/qa-e2e-aceitar.ts:53` (`montarCheck`, вызываемый с
  `linhas: []` — это и есть дефект для исправления); `scripts/ci/qa-e2e-aceite.ts:21`
  (`avaliarAceite`, который продолжает читать `external_id` `causa:*`)
- **Тест:** `scripts/ci/qa-e2e-aceite.spec.ts` (вердикт принятия); сохранение
  сводки и запись «против рекомендации» получают тест в L1
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Источник:** AT-791 (EP-033)

<a id="rn-1053"></a>

### RN-1053 — Spec без тега `@f-*` показывается как «без функциональности» и никогда не пропадает из отчёта {#rn-1053}

Выбор регрессионного прогона уже отделяет то, у чего нет владельца в карте (`semDono`,
`scripts/ci/qa-regressivo-selecao.ts:86`), но эти данные не доходят до отчёта.
Новое правило: spec без единого тега `@f-<id>` попадает в корзину **«без
функциональности»**, в таблице и в списке сбоев, и никогда не исчезает. Красный
spec в этой корзине становится **принять с обоснованием**, никогда не
заблокировать, по правилу [RN-1051](#rn-1051). Логин-`setup`
(`entrar.setup.ts`) тоже попадает в эту корзину и помечается как подготовка, чтобы
не выглядеть тестом функциональности. Без корзины таблица показывала бы всё как
«без покрытия» при красном spec, что и есть находка qa#28.

- **Код:** `scripts/ci/qa-regressivo-selecao.ts:76` (`semDono.push`); корзины
  «без функциональности» в отчёте пока нет (AT-791, lanes L1 и L2)
- **Тест:** `scripts/ci/qa-regressivo-selecao.spec.ts` (выбор по карте и
  `semDono`); корзина в отчёте получает тест в L2
- **ADR:** [0277](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0277-o-regressivo-roda-num-compose-so-e-o-relatorio-decide.md)
- **Источник:** AT-791 (EP-033)

## Триггер ждёт штамп и подпись, прежде чем стать красным (RN-1066) {#o-gatilho-espera-o-carimbo-e-a-assinatura-antes-do-vermelho-rn-1066}

<a id="rn-1066"></a>

### RN-1066 — Триггер ждёт штамп и подпись, прежде чем провалить проверку из-за окружения или подписи {#rn-1066}

Когда PR в `main` (шлюз `E2E do brabo-qa`) или в `dev` (проверка
`Regressivo do brabo-qa`) запускает триггер, образ head репозитория события может
ещё штамповаться или подписываться: merge в `dev` двигает head продвижения, а
штамп (тег `-dev`, образ) и подпись образа занимают от 3 до 8 мин. Поэтому
триггер повторяет три поиска до настраиваемого потолка (`QA_ESPERA_MINUTOS`, по
умолчанию 10 мин, интервал 15 с):

- тег `-dev` для head (в `main`);
- существование образа (`-dev` для head в `main`, `sha-<12>` в `dev`);
- проверка подписи `cosign verify` с идентичностью `e2e-pr` из brabo-qa.

Только после потолка проверка закрывается красной, и сообщение говорит, чего не
хватило: тега `-dev` для head или образа (причина `ambiente`), либо подписи
(причина `assinatura`). Недействительная подпись никогда не принимается через
`/qa-aceitar` (RN-1052). Ожидание действует только для образа репозитория события;
образы остальных сервисов уже проштампованы и подписаны.

- **Код:** `scripts/ci/qa-e2e-espera.ts:51` (`esperarImagemAssinada`, ожидание
  образа и подписи); `scripts/ci/qa-e2e-espera.ts:33` (`repetirAte`, повтор
  до потолка); `scripts/ci/qa-e2e-disparar.ts:151` (резолвер тегов, повторяемый до
  потолка) и `scripts/ci/qa-e2e-disparar.ts:157` (ожидание только образа репозитория события)
- **Тест:** `scripts/ci/qa-e2e-espera.spec.ts` (повтор до потолка, причина
  `ambiente` и причина `assinatura`)
- **Источник:** AT-790 (EP-033), brabo-ci#31

## Панель изменения (RN-1054..1056, ADR 0278) {#o-painel-da-mudança-rn-10541056-adr-0278}

<a id="rn-1054"></a>

### RN-1054 — У каждого изменения есть панель, собирающая runs {#rn-1054}

У каждого изменения (компонента `Depende-de`, отдельного PR или тега) есть запуск
`Painel da mudança` в `brabo-ci`. Он собирает runs изменения по head SHA, merge SHA,
тегу и `c=` из E2E. Опрашивает каждые 60 с, с ETag; если остаётся меньше 500
запросов, интервал становится 5 мин. Останавливается, когда всё завершено и прошло
3 мин тишины, либо на потолке в 45 мин. Run, всё ещё идущий на потолке, выходит как
«em andamento há N min». Панель **никогда не проваливается**.

- **Код:** `scripts/ci/painel.ts:235` (`terminou`, правило остановки)
- **Тест:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Источник:** AT-792 (EP-033)

<a id="rn-1055"></a>

### RN-1055 — Панель не публикует проверку в PR; ссылка остаётся в исходных runs {#rn-1055}

Хелпер Vínculos в режиме auto с PR пишет строку `Disparado | Painel da
mudança`. Она указывает на `…/brabo-ci/actions/workflows/painel.yml?query=<repo>%23<n>`.
Токен App панели только читает (`actions`, `pull-requests` и `contents`). Единственный
токен с записью — токен dispatch (`contents: write`, ограниченный `brabo-ci`).
Поэтому `checks: write` не нужен.

- **Код:** `scripts/ci/vinculos.ts:164` (`linhaDoPainel`, строка Vínculo)
- **Тест:** `scripts/ci/vinculos.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Источник:** AT-792 (EP-033)

<a id="rn-1056"></a>

### RN-1056 — Одна панель на компонент {#rn-1056}

Отправитель (job `avisar-painel`) не запускает панель, если уже есть панель
`queued` или `in_progress` с `<repo>#<n>` в заголовке, при совпадении всего токена.
Когда компонент растёт (ключ `m=<hash>`), работающая панель пишет «superado» и
выходит, а отправитель запускает новую.

- **Код:** `scripts/ci/painel.ts:247` (`jaTemPainel`); `scripts/ci/painel.ts:90`
  (`superado`, который опрашивает работающая панель)
- **Тест:** `scripts/ci/painel.spec.ts`
- **ADR:** [0278](https://github.com/viralabs-dev/brabo/blob/dev/docs/adr/0278-a-mudanca-e-vista-num-painel-do-brabo-ci.md)
- **Источник:** AT-792 (EP-033)

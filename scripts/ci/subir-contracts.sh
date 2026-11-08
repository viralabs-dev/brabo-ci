#!/usr/bin/env bash
# Sobe a versão do brabo-contracts num consumidor (AT-770, RN-1038). Roda na raiz
# do repo, um por vez: scripts/ci/subir-contracts.sh <X.Y.Z[-dev.N]>
# 1. troca o alias `npm:@viralabs-dev/brabo-*@` do package.json e a constante dos
#    scripts de download; 2. regenera o lock só com `pnpm install --lockfile-only`;
# 3. se o lock mudou fora das entradas `@viralabs-dev/brabo-*` (a lição do
#    broker#14: lock reescrito inteiro; AT-797: lock semeado com overrides), NÃO
#    usa o lock novo: enxerta no lock antigo só os blocos do contracts e valida
#    com `--frozen-lockfile`; se isso falhar, RECUSA restaurando tudo (inclusive
#    o pnpm-workspace.yaml); 4. garante `minimumReleaseAgeExclude: '@viralabs-dev/*'`
#    no pnpm-workspace.yaml (a 1a versão de um pacote do mesmo dia viola a idade mínima).
# bash 3.2-compatível. `PNPM` troca o binário (o teste usa um falso).
set -euo pipefail

versao="${1:-}"
versao="${versao#v}"
if ! printf '%s' "${versao}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-dev\.[0-9]+)?$'; then
  echo "uso: subir-contracts.sh <X.Y.Z[-dev.N]>" >&2
  exit 2
fi

pnpm_bin="${PNPM:-pnpm}"
salva="$(mktemp -d)"
trap 'rm -rf "${salva}"' EXIT
constantes="scripts/baixar-contratos.sh scripts/baixar-areas.mjs .github/actions/irmaos/action.yml pnpm-workspace.yaml"
ws_existia=0
[ ! -f pnpm-workspace.yaml ] || ws_existia=1

restaurar() {
  local f
  [ "${ws_existia}" = 1 ] || rm -f pnpm-workspace.yaml
  for f in package.json pnpm-lock.yaml ${constantes}; do
    if [ -f "${salva}/$(echo "${f}" | tr / _)" ]; then cp "${salva}/$(echo "${f}" | tr / _)" "${f}"; fi
  done
}

for f in package.json pnpm-lock.yaml ${constantes}; do
  if [ -f "${f}" ]; then cp "${f}" "${salva}/$(echo "${f}" | tr / _)"; fi
done

# Sem o trecho entre aspas/linhas das entradas do contracts, o lock tem de ficar igual.
# `sem_contracts <lock>` imprime o lock sem os blocos do contracts. `enxertar <novo> <antigo>`
# imprime o antigo com os blocos do contracts do novo no lugar dos dele (por seção/importer).
# shellcheck disable=SC2016  # é programa awk, não expansão de shell
awk_blocos='
    function flush() {
      if (n > 0) {
        if (modo == "enxertar" && fase == 1) { if (taint) T[ctx] = T[ctx] buf sep }
        else if (modo == "enxertar") {
          if (taint) { drop = 1; if (!(ctx in feito)) { printf "%s", T[ctx]; feito[ctx] = 1 } }
          else printf "%s", buf
        } else if (!taint) printf "%s", buf
      }
      buf = ""; n = 0; taint = 0
    }
    function saida(l) { if (modo != "enxertar" || fase == 2) print l }
    FNR == 1 { if (NR > 1) flush(); fase = (NR == 1) ? 1 : 2; secao = ""; cur = 0 }
    /^[a-zA-Z]/ { flush(); secao = $1; ctx = secao; drop = 0; saida($0); next }
    {
      match($0, /^ */); ind = RLENGTH
      inicio = (secao == "importers:") ? 6 : 2
      sep = (secao == "importers:") ? "" : "\n"
      if ($0 == "" || (n > 0 && ind <= inicio && ind < cur) ) flush()
      if ($0 != "" && ind == inicio && secao != "") { flush(); cur = ind }
      if ($0 != "") drop = 0
      if ($0 == "") { if (drop) drop = 0; else saida(""); next }
      if (ind >= inicio && (ind == inicio || n > 0)) {
        buf = buf $0 "\n"; n++
        if (index($0, "@viralabs-dev/brabo-")) taint = 1
        next
      }
      drop = 0
      if (secao == "importers:") { if (ind == 2) { ctx0 = $0; ctx = $0 } else if (ind == 4) ctx = ctx0 "|" $0 }
      saida($0)
    }
    END { flush() }
'
sem_contracts() { awk "${awk_blocos}" "$1"; }
enxertar() { awk -v modo=enxertar "${awk_blocos}" "$1" "$2"; }

if [ -f package.json ]; then
  sed -E "s#(npm:@viralabs-dev/brabo-[a-z-]+@)[^\"]+#\1${versao}#" package.json > "${salva}/pkg.novo"
  cp "${salva}/pkg.novo" package.json
fi
[ ! -f scripts/baixar-contratos.sh ] || { sed -E "s#(tag=\"\\$\\{1:-)v[^}\"]+#\1v${versao}#" scripts/baixar-contratos.sh > "${salva}/a" && cp "${salva}/a" scripts/baixar-contratos.sh; }
[ ! -f scripts/baixar-areas.mjs ] || { sed -E "s#(const TAG = ')v[^']+#\1v${versao}#" scripts/baixar-areas.mjs > "${salva}/b" && cp "${salva}/b" scripts/baixar-areas.mjs; }
[ ! -f .github/actions/irmaos/action.yml ] || { sed -E "s#(brabo-contracts, ref: )v[^,} ]+#\1v${versao}#" .github/actions/irmaos/action.yml > "${salva}/c" && cp "${salva}/c" .github/actions/irmaos/action.yml; }

if ! grep -qF "'@viralabs-dev/*'" pnpm-workspace.yaml 2>/dev/null; then
  if grep -q '^minimumReleaseAgeExclude:' pnpm-workspace.yaml 2>/dev/null; then
    awk '{ print } /^minimumReleaseAgeExclude:/ { print "  - \047@viralabs-dev/*\047" }' pnpm-workspace.yaml > "${salva}/ws" && cp "${salva}/ws" pnpm-workspace.yaml
  else
    printf "minimumReleaseAgeExclude:\n  - '@viralabs-dev/*'\n" >> pnpm-workspace.yaml
  fi
fi

if [ -f pnpm-lock.yaml ]; then
  if ! "${pnpm_bin}" install --lockfile-only; then restaurar; echo "pnpm falhou; nada foi alterado" >&2; exit 1; fi
  sem_contracts "${salva}/pnpm-lock.yaml" > "${salva}/lock.antes"
  sem_contracts pnpm-lock.yaml > "${salva}/lock.depois"
  if ! diff -u "${salva}/lock.antes" "${salva}/lock.depois" > "${salva}/lock.diff"; then
    # Lock semeado: o pnpm mexeu em outras entradas. Fica o antigo + só os blocos do contracts.
    enxertar pnpm-lock.yaml "${salva}/pnpm-lock.yaml" > "${salva}/lock.enxerto"
    cp "${salva}/lock.enxerto" pnpm-lock.yaml
    if ! "${pnpm_bin}" install --lockfile-only --frozen-lockfile >/dev/null 2>&1; then
      restaurar
      echo "RECUSADO: o pnpm-lock.yaml mudou fora das entradas @viralabs-dev/brabo-* e o enxerto não passa no --frozen-lockfile; tudo restaurado:" >&2
      head -40 "${salva}/lock.diff" >&2
      exit 1
    fi
    echo "lock semeado: só as entradas @viralabs-dev/brabo-* foram trocadas" >&2
  fi
fi
echo "brabo-contracts ${versao}: ok"

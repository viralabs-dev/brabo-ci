#!/usr/bin/env bash
# Sobe a versão do brabo-contracts num consumidor (AT-770, RN-1038). Roda na raiz
# do repo, um por vez: scripts/ci/subir-contracts.sh <X.Y.Z[-dev.N]>
# 1. troca o alias `npm:@viralabs-dev/brabo-*@` do package.json e a constante dos
#    scripts de download; 2. regenera o lock só com `pnpm install --lockfile-only`;
# 3. RECUSA, restaurando tudo, se o lock mudou fora das entradas
#    `@viralabs-dev/brabo-*` (a lição do broker#14: lock reescrito inteiro).
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
constantes="scripts/baixar-contratos.sh scripts/baixar-areas.mjs .github/actions/irmaos/action.yml"

restaurar() {
  local f
  for f in package.json pnpm-lock.yaml ${constantes}; do
    if [ -f "${salva}/$(echo "${f}" | tr / _)" ]; then cp "${salva}/$(echo "${f}" | tr / _)" "${f}"; fi
  done
}

for f in package.json pnpm-lock.yaml ${constantes}; do
  if [ -f "${f}" ]; then cp "${f}" "${salva}/$(echo "${f}" | tr / _)"; fi
done

# Sem o trecho entre aspas/linhas das entradas do contracts, o lock tem de ficar igual.
sem_contracts() {
  awk '
    function flush() { if (n > 0 && !taint) printf "%s", buf; buf = ""; n = 0; taint = 0 }
    /^[a-zA-Z]/ { flush(); secao = $1; print; next }
    {
      match($0, /^ */); ind = RLENGTH
      inicio = (secao == "importers:") ? 6 : 2
      if ($0 == "" || (n > 0 && ind <= inicio && ind < cur) ) flush()
      if ($0 != "" && ind == inicio && secao != "") { flush(); cur = ind }
      if ($0 == "") { print; next }
      if (ind >= inicio && (ind == inicio || n > 0)) {
        buf = buf $0 "\n"; n++
        if (index($0, "@viralabs-dev/brabo-")) taint = 1
        next
      }
      print
    }
    END { flush() }
  ' "$1"
}

if [ -f package.json ]; then
  sed -E "s#(npm:@viralabs-dev/brabo-[a-z-]+@)[^\"]+#\1${versao}#" package.json > "${salva}/pkg.novo"
  cp "${salva}/pkg.novo" package.json
fi
[ ! -f scripts/baixar-contratos.sh ] || { sed -E "s#(tag=\"\\$\\{1:-)v[^}\"]+#\1v${versao}#" scripts/baixar-contratos.sh > "${salva}/a" && cp "${salva}/a" scripts/baixar-contratos.sh; }
[ ! -f scripts/baixar-areas.mjs ] || { sed -E "s#(const TAG = ')v[^']+#\1v${versao}#" scripts/baixar-areas.mjs > "${salva}/b" && cp "${salva}/b" scripts/baixar-areas.mjs; }
[ ! -f .github/actions/irmaos/action.yml ] || { sed -E "s#(brabo-contracts, ref: )v[^,} ]+#\1v${versao}#" .github/actions/irmaos/action.yml > "${salva}/c" && cp "${salva}/c" .github/actions/irmaos/action.yml; }

if [ -f pnpm-lock.yaml ]; then
  if ! "${pnpm_bin}" install --lockfile-only; then restaurar; echo "pnpm falhou; nada foi alterado" >&2; exit 1; fi
  sem_contracts "${salva}/pnpm-lock.yaml" > "${salva}/lock.antes"
  sem_contracts pnpm-lock.yaml > "${salva}/lock.depois"
  if ! diff -u "${salva}/lock.antes" "${salva}/lock.depois" > "${salva}/lock.diff"; then
    restaurar
    echo "RECUSADO: o pnpm-lock.yaml mudou fora das entradas @viralabs-dev/brabo-*; tudo restaurado:" >&2
    head -40 "${salva}/lock.diff" >&2
    exit 1
  fi
fi
echo "brabo-contracts ${versao}: ok"

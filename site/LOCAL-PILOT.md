# Piloto local Banco do Brasil 2021

O lote aprovado de dez questões permanece fora do Git e do Supabase. Ele deve
ser copiado do checkout local do `kad-collector` depois da aprovação editorial.

```powershell
$source = '..\kad-collector\data\editorial-approval\bb-2021-tech-pilot10\staging'
New-Item -ItemType Directory -Force -Path 'site\.local-pilot' | Out-Null
Copy-Item -LiteralPath (Join-Path $source 'manifesto.json') -Destination 'site\.local-pilot'
Copy-Item -LiteralPath (Join-Path $source 'questoes.jsonl') -Destination 'site\.local-pilot'
$env:VITE_KAD_LOCAL_PILOT = '1'
npm --prefix site run dev -- --host 127.0.0.1 --port 5198
```

Abra <http://127.0.0.1:5198/questoes/buscar>. O carregador exige exatamente dez
registros `draft`, IDs únicos e o hash SHA-256 do JSONL registrado no manifesto.
Se faltar o pacote ou algum registro for inválido, nenhuma questão do lote é
mostrada. O modo só funciona no desenvolvimento e não inicia o Supabase.
Respostas de visitante ficam apenas neste navegador; não há publicação remota.

O diretório `site/.local-pilot/` está no `.gitignore` e só é servido pelo
servidor de desenvolvimento. O build de produção não contém esse pacote.
Nunca inclua os PDFs oficiais ou os textos integrais das questões no PR.

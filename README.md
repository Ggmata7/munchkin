# Munchkin 3D Companion

App de apoio para Munchkin (Jogo Base + Expansões 2, 3 e 4, com a variante Epic Munchkin até o Nível 20).

**Jogar / instalar:** https://ggmata7.github.io/munchkin/

No iPhone: abra o link no Safari → Compartilhar → Adicionar à Tela de Início. Depois de instalado, funciona sem internet.

Ao publicar uma versão nova, troque o número de `CACHE` em `sw.js` para os celulares baixarem a atualização.

## Testes

`npm install && npx playwright install chromium && npm test` abre o app num Chromium sem GPU, confere as contas de poder, carrega estados salvos corrompidos e monta/anima todas as combinações de raça × classe × gênero × tier × montaria, falhando em qualquer erro de console. O mesmo teste roda no GitHub Actions a cada PR. `npm run test:quick` usa menos tiers.

Para depurar o visual: `index.html?nomerge` desliga a fusão de malhas estáticas (útil para inspecionar peças individuais), e no console `Engine.mood('happy',2)` testa as expressões.

**Najdene ranljivosti:**

**SNYK**
- Backend (server/Dockerfile, base image node:18-slim) — Snyk pokazal:
  - 1 × Critical: `zlib/zlib1g Integer Overflow or Wraparound` (CVE-2023-45853) — CVSS 9.8  
    - Introduced through: node@...-slim › zlib/zlib1g@1:1.2.13.dfsg-1  
  - 5 x high
  - 3 Medium
  - 41 Low
 
  - Odpravili z zamenjavo slike v server/Dockerfile in Dockerfile iz node:18-slim na node:20-alpine.
 
- Dockerfile ni pokazal nobenih težav.

**CODE SCANNING**
- Vsega skupaj 12 težav(3 high, 9 medium)
  - 3x missing rate limit na src/index.js:
    - Za rešitev uporabili predlog: A rate-limiting middleware should be used to prevent attacks.
  - 9x Workflow does not contain permissions - nimo popravljali

 **DATADOG**
 - V analizi ni večjih ozkih grl
 - V primerjavi main branch-a in production branch-a se sicer vidi, da prduction CI traja cca 3m 13s
   medtem ko main branch CI v povprečju med 1min-2min.
 - Najdaljša koraka v pipeline-u sta Build & Push Docker in SonarCloude Code Analysis.
   -  Build & Push Docker je za cca 30s daljši na production branch-u
   -  Prav tako se backend testi na production branchu dlje izvajajo
  
**Kaj bi še lahko optimizirali?**
1. Optimiziranje testiranja - v trenutnem workflow‑u se testi in npm install izvajajo večkrat
   (v frontend-test, backend-test in ponovno v sonarcloud jobu) kar podaljša celoten čas.
   - prenesemo že zgrajene/izvedene artefakte (coverage, dist) iz test in build job‑ov z
     actions/upload-artifact / actions/download-artifact. V sonarcloud jobu zaženemo samo Sonar scan
     (brez ponovnega testiranja).
2. Docker build & push (frontend in backend ločeno) - trenutno se v enem jobu gradita frontend in backend
   zaporedno
   - lahko ločimo v dva joba, ki lahko gradita vzporedno, kar skrajša čas.
    

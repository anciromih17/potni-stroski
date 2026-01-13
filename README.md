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

<img width="1646" height="398" alt="image" src="https://github.com/user-attachments/assets/a7e542c5-0a3a-441b-a47f-4057ae131d99" />

**CODE SCANNING**
- Vsega skupaj 12 težav(3 high, 9 medium)
  - 3x missing rate limit na src/index.js:
    - Za rešitev uporabili predlog: A rate-limiting middleware should be used to prevent attacks.
<img width="563" height="300" alt="image" src="https://github.com/user-attachments/assets/56bd9b9a-6a08-4020-a1e3-44d39d440c8d" />

  - 9x Workflow does not contain permissions - nimo popravljali

 **DATADOG**
 - V analizi ni večjih ozkih grl
 - V primerjavi main branch-a in production branch-a se sicer vidi, da prduction CI traja cca 3m 13s
   medtem ko main branch CI v povprečju med 1min-2min.
 - Najdaljša koraka v pipeline-u sta Build & Push Docker in SonarCloude Code Analysis.
   -  Build & Push Docker je za cca 30s daljši na production branch-u
   -  Prav tako se backend testi na production branchu dlje izvajajo

<img width="1065" height="277" alt="image" src="https://github.com/user-attachments/assets/4dea83d2-7b20-4ae0-85c4-174d4af67c11" />

<img width="1676" height="311" alt="image" src="https://github.com/user-attachments/assets/e909203b-2d16-4981-9058-7f0ee034f6d7" />
  
**Kaj bi še lahko optimizirali?**
1. Optimiziranje testiranja - v trenutnem workflow‑u se testi in npm install izvajajo večkrat
   (v frontend-test, backend-test in ponovno v sonarcloud jobu) kar podaljša celoten čas.
   - prenesemo že zgrajene/izvedene artefakte (coverage, dist) iz test in build job‑ov z
     actions/upload-artifact / actions/download-artifact. V sonarcloud jobu zaženemo samo Sonar scan
     (brez ponovnega testiranja).
2. Docker build & push (frontend in backend ločeno) - trenutno se v enem jobu gradita frontend in backend
   zaporedno
   - lahko ločimo v dva joba, ki lahko gradita vzporedno, kar skrajša čas.
    

<script setup lang="ts">
// Névjegy: a program verziója és a specifikáció, amely alapján készült
import { APP_LABEL, SPEC } from '~/utils/meta'
const ua = ref('')
const speech = ref(false)
onMounted(() => { ua.value = navigator.userAgent; speech.value = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) })
</script>

<template>
  <div>
    <div class="pagehead"><NuxtLink to="/beallitasok" class="btn">‹ Beállítások</NuxtLink><h1>Névjegy</h1></div>
    <div class="card" style="border-top:5px solid var(--green)">
      <div class="row" style="gap:16px;margin-bottom:14px">
        <img src="/logo.svg" alt="" style="width:64px;height:64px;border-radius:18px">
        <div><div style="font-size:30px;font-weight:800;color:var(--slate)">Mol<b style="color:var(--green)">io</b></div><div class="muted">{{ APP_LABEL }}</div></div>
      </div>
      <VersionBlock style="margin-bottom:14px" />
      <div class="kv">
        <div>Specifikáció</div><div><b>{{ SPEC.title }}</b><br><span class="muted">{{ SPEC.name }} – {{ SPEC.version }}, utolsó módosítás: {{ SPEC.date }}</span></div>
        <div>Név</div><div>Molio = <i>molar</i> (őrlőfog) + IO</div>
        <div>Mintacég</div><div>Cooldent Kft. (kitalált) – egy telephely, egy rendelő, két fogorvos</div>
        <div>Adattárolás</div><div>A böngésző saját tárolójában (IndexedDB), csak ezen az eszközön. Szerver és adatbázis nincs.</div>
        <div>Diktálás</div><div>Pontos felismerés a Cloudflare Workers AI Whisper-modelljével (szakszó-listával), élő előnézet a böngésző beszédfelismerőjével, tartalékként a böngésző saját felismerője; szleng-szótár, hasonlóság szerinti egyeztetés és szabályalapú értelmezés. A böngésző felismerője: <b :style="speech ? 'color:var(--green)' : 'color:var(--red)'">{{ speech ? 'elérhető' : 'nem érhető el – a szöveg gépelhető' }}</b></div>
        <div>AI</div><div>Kísérleti AI-értelmezés a diktálásnál kapcsolóval (Cloudflare Workers AI nyelvi modell, kulcs nélkül, napi kerettel); a hangfelvétel nem tárolódik.</div>
      </div>
    </div>
    <div class="card">
      <h2>A demó hatóköre (demó v2.3, specifikáció v2.3)</h2>
      <ul style="line-height:1.8;margin:0;padding-left:20px">
        <li><b>Recepció:</b> betegnyilvántartás, két fogorvos naptára (napi, heti, havi nézet), ráhagyási sávok, emlékeztetők előnézete és szimulált küldése, meg nem jelenési kockázat.</li>
        <li><b>Kezelés:</b> diktálás, fogszám (FDI, „tizenhatos”, „jobb felső hatos”, tejfogak), fogfelszínek és bővítés kezelés közben, anyagjavaslat, díj a felszínek szerint, ívelt röntgenszerű fogtérkép, fogazati státusz diktálással, csatolmányok, PDF ügyfélkarton.</li>
        <li><b>Raktár:</b> készlet, automatikus levonás, 60 napos előrejelzés, rendelési határidő, bevételezés egységárral és <b>gördülő átlagárral</b>, gyártási szám (LOT) és lejárat, kiadás lejárat szerint, <b>rendelési javaslat</b> (a rendelést munkatárs adja le), implantátum-nyomonkövetés és LOT-keresés visszahíváshoz.</li>
        <li><b>Új a 2.0-ban:</b> digitális beleegyező nyilatkozat tableten aláírva (PDF a kartonba), közérthető páciens-tájékoztató orvosi jóváhagyással, kontroll-meghívók (recall), sterilizációs napló, EESZT-jelentés és számla előkészítése (szemléltetés), letölthető felhasználói kézikönyv.</li>
        <li><b>Új a v2.1 specifikációban:</b> több fog és több művelet egy kezelési alkalomban (kezelési tételek), a diktált fogállapot frissíti a fogtérképet, javasolt kezelések követése („időpontot kell egyeztetni” lista), kontroll-emlékeztetők sablonüzenettel, a „NEM” válasz az időpont-emlékeztetőre, raktári szűrők és megrendelés-követés, a páciens Kezelések almenüje a jövőbeli időpontokkal, diktálás-időkorlát (30 mp) a demóban.</li>
        <li><b>Új a v2.2 specifikációban:</b> figyelmeztetés a páciens meglévő időpontjairól foglaláskor, időpont törlése 30 napos visszaállítással, tételek áthelyezése és időpontok összevonása, verziójelzés és „Frissítés keresése”, a diktálás azonnali feldolgozása előnézettel és ⚠-megerősítéssel (piszkozat 7 napig), kötelező kezelő orvos, a javasolt kezelés forrásvizitje és több tétel egy időponton részleges ütemezéssel, tájékoztató üzenet rögzített időponthoz és egységes Teendők menü.</li>
        <li><b>Új a v2.3 specifikációban:</b> a diktálás pontosítása (szerveroldali Whisper-felismerés szakszó-listával, élő előnézet, felvétel- és hangerőjelző, zajszűrés, kitaláció-szűrő), diktálási alapszótár és ismeretlen kifejezések gyűjtése, hasonlóság szerinti egyeztetés, az előjegyzett kezelés és a fogtérkép felhasználása az ellenőrzésben, javítási napló és „Nem ezt mondtam” jelzés tanuló szabályokkal, „Diktálás betanítása” és személyes javítások, kísérleti AI-értelmezés, automatikus pontosságmérés kiadás előtt, csatornaválasztó gombok a tájékoztató- és emlékeztető-küldésben, a fogállapot-szótár a Kódtáblák alatt, foglalási időtartam- és közeli időpont-javítások (B-006, B-007), új verzió felugró ablak a main ágon.</li>
        <li><b>Nem része:</b> bejelentkezés és szerepkörök, drag-and-drop foglalás, check-in és váróterem, valódi SMS/e-mail küldés, valódi EESZT-beküldés és számlakiállítás, kéz nélküli diktálás és hangparancsok (12. pont: csak a végleges változatban).</li>
      </ul>
    </div>
    <div class="card">
      <h2>Ajánlott böngészők</h2>
      <p style="margin-top:0;line-height:1.6">Asztali gépen Chrome vagy Edge (Windows), Safari vagy Chrome (macOS); iPhone-on és iPaden Safari; Androidon Chrome. Firefoxban a beépített beszédfelismerés nem érhető el, ott a szöveg gépelhető. Telepíthető alkalmazásként is: iPhone/iPad Safari → Megosztás → Főképernyőhöz adás; Android/asztali Chrome → Alkalmazás telepítése.</p>
      <p class="small muted" style="margin:0;word-break:break-all">{{ ua }}</p>
    </div>
  </div>
</template>

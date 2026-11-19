<script setup lang="ts">
// Névjegy: a program verziója és a specifikáció, amely alapján készült
import { APP_LABEL, APP_VERSION, BUILD_DATE_HU, SPEC, VERSION_LINE } from '~/utils/meta'
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
      <div class="kv">
        <div>Programverzió</div><div><b>Molio 2.0</b> ({{ APP_VERSION }}, bemutató / demó) – {{ VERSION_LINE.replace('Molio 2.0 – ', '') }}<br><span class="muted">Build dátuma: {{ BUILD_DATE_HU }}</span></div>
        <div>Specifikáció</div><div><b>{{ SPEC.title }}</b><br><span class="muted">{{ SPEC.name }} – {{ SPEC.version }}, utolsó módosítás: {{ SPEC.date }}</span></div>
        <div>Név</div><div>Molio = <i>molar</i> (őrlőfog) + IO</div>
        <div>Mintacég</div><div>Cooldent Kft. (kitalált) – egy telephely, egy rendelő, két fogorvos</div>
        <div>Adattárolás</div><div>A böngésző saját tárolójában (IndexedDB), csak ezen az eszközön. Szerver és adatbázis nincs.</div>
        <div>Diktálás</div><div>A böngésző beépített magyar beszédfelismerése + szabályalapú értelmezés. Ebben a böngészőben: <b :style="speech ? 'color:var(--green)' : 'color:var(--red)'">{{ speech ? 'elérhető' : 'nem érhető el – a szöveg gépelhető' }}</b></div>
        <div>AI</div><div>A demóban nincs AI-kapcsolat; az AI-összefoglaló a későbbi verziókban jön.</div>
      </div>
    </div>
    <div class="card">
      <h2>A demó hatóköre (Molio 2.0, specifikáció v2.1)</h2>
      <ul style="line-height:1.8;margin:0;padding-left:20px">
        <li><b>Recepció:</b> betegnyilvántartás, két fogorvos naptára (napi, heti, havi nézet), ráhagyási sávok, emlékeztetők előnézete és szimulált küldése, meg nem jelenési kockázat.</li>
        <li><b>Kezelés:</b> diktálás, fogszám (FDI, „tizenhatos”, „jobb felső hatos”, tejfogak), fogfelszínek és bővítés kezelés közben, anyagjavaslat, díj a felszínek szerint, ívelt röntgenszerű fogtérkép, fogazati státusz diktálással, csatolmányok, PDF ügyfélkarton.</li>
        <li><b>Raktár:</b> készlet, automatikus levonás, 60 napos előrejelzés, rendelési határidő, bevételezés egységárral és <b>gördülő átlagárral</b>, gyártási szám (LOT) és lejárat, kiadás lejárat szerint, <b>rendelési javaslat</b> (a rendelést munkatárs adja le), implantátum-nyomonkövetés és LOT-keresés visszahíváshoz.</li>
        <li><b>Új a 2.0-ban:</b> digitális beleegyező nyilatkozat tableten aláírva (PDF a kartonba), közérthető páciens-tájékoztató orvosi jóváhagyással, kontroll-meghívók (recall), sterilizációs napló, EESZT-jelentés és számla előkészítése (szemléltetés), letölthető felhasználói kézikönyv.</li>
        <li><b>Új a v2.1 specifikációban:</b> több fog és több művelet egy kezelési alkalomban (kezelési tételek), a diktált fogállapot frissíti a fogtérképet, javasolt kezelések követése („időpontot kell egyeztetni” lista), kontroll-emlékeztetők sablonüzenettel, a „NEM” válasz az időpont-emlékeztetőre, raktári szűrők és megrendelés-követés, a páciens Kezelések almenüje a jövőbeli időpontokkal, diktálás-időkorlát (30 mp) a demóban.</li>
        <li><b>Nem része:</b> bejelentkezés és szerepkörök, drag-and-drop foglalás, check-in és váróterem, valódi SMS/e-mail küldés, valódi EESZT-beküldés és számlakiállítás, AI-feldolgozás.</li>
      </ul>
    </div>
    <div class="card">
      <h2>Ajánlott böngészők</h2>
      <p style="margin-top:0;line-height:1.6">Asztali gépen Chrome vagy Edge (Windows), Safari vagy Chrome (macOS); iPhone-on és iPaden Safari; Androidon Chrome. Firefoxban a beépített beszédfelismerés nem érhető el, ott a szöveg gépelhető. Telepíthető alkalmazásként is: iPhone/iPad Safari → Megosztás → Főképernyőhöz adás; Android/asztali Chrome → Alkalmazás telepítése.</p>
      <p class="small muted" style="margin:0;word-break:break-all">{{ ua }}</p>
    </div>
  </div>
</template>

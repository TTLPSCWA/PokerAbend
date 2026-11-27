'use strict';
{
  const art = {
    desk: ['#f5a760','#50356b','M26 62h108v52H26z M45 74h70v27H45z M75 116h10v14'],
    door: ['#55b4aa','#173645','M41 25h78v106H41z M51 37h58v94 M98 83h3'],
    coffee: ['#ffd885','#793841','M38 67h72v39a14 14 0 0 1-14 14H52a14 14 0 0 1-14-14z M110 71h11a11 11 0 0 1 0 22h-11 M56 51q-12-13 1-23 M76 51q-12-13 1-23'],
    orbit: ['#f695ce','#292a67','M25 93c0-12 108-43 112-30s-109 45-112 30z M99 76a20 20 0 1 1-40 0 20 20 0 0 1 40 0z'],
    crates: ['#ffe28e','#265060','M26 85h48v40H26z M90 85h48v40H90z M55 40h48v40H55z M26 85l48 40m16-40l48 40M55 40l48 40'],
    laser: ['#76e5f1','#47317b','M25 100l29-61 27 67 25-23 29 21 M25 120h110'],
    queue: ['#f6bb9d','#264364','M31 116V86a12 12 0 0 1 24 0v30 M68 116V78a12 12 0 0 1 24 0v38 M105 116V65a12 12 0 0 1 24 0v51'],
    letter: ['#d6c4ff','#314575','M24 45h112v72H24z M24 45l56 49 56-49 M24 117l39-35m73 35l-39-35'],
    laundry: ['#ffd883','#393268','M39 22h82v108H39z M39 48h82 M95 88a15 15 0 1 1-30 0 15 15 0 0 1 30 0z M48 35h13'],
    moon: ['#ffd490','#2b2762','M115 105c-43 19-72-14-62-51 8-17 24-25 43-23-20 24-15 53 19 74z M105 49h14m-7-7v14'],
    plant: ['#abe2af','#2b473f','M56 124h48l7-34H49z M81 91V54c0-19 15-27 34-27-1 24-14 37-34 41 M81 72C79 48 61 43 46 44c0 18 16 31 35 34'],
    umbrella: ['#f0ab90','#71475e','M24 78c0-30 25-49 56-49s56 19 56 49H24z M80 29v82q0 17 14 17 M80 32q-20 12-23 46m23-46q20 12 23 46'],
    party: ['#ffc778','#33416b','M60 44h59v65H60z M54 44h70v15H54z M89 44v65 M89 43Q54 15 69 17q18 2 20 26m0 0q35-28 20-26-18 2-20 26z M37 77h9m-5-5v10'],
    cards: ['#efafc5','#27505e','M36 40l60-7 10 82-61 7z M67 42l59 7-9 79-59-7z M89 81l12-12 12 12-12 12z'],
    coat: ['#88dcd2','#1d4059','M51 36l25 11 33-11 22 38-17 12-12-16v56H60V70L48 86 31 74z M79 50v74 M65 103h8m14 0h8'],
    spark: ['#ffaf92','#493c79','M82 22l12 39 40 9-40 13-12 39-12-39-40-13 40-9z M121 31v19m-9-9h18'],
    waves: ['#aae6e1','#305076','M23 70q15-24 30 0t30 0 30 0 30 0 M23 90q15-24 30 0t30 0 30 0 30 0 M23 110q15-24 30 0t30 0 30 0 30 0'],
    signal: ['#ffe0a7','#593674','M39 110h16V93H39z M65 110h16V76H65z M91 110h16V58H91z M117 110h16V40h-16z M30 118h109'],
  };
  const t = (de, en) => I18n.content(de, en);
  const translate = value => Array.isArray(value) ? t(...value) : '';
  const templateId = id => typeof id === 'string' && /-alt$/.test(id) ? id.slice(0, -4) : id;
  const pos = n => Math.max(5, Math.min(95, Number(n) || 50));
  const textSize = n => Math.max(16, Math.min(52, Number(n) || 30));
  const modes = {text: ['Meme trifft Text', 'Caption the meme'], image: ['Memes Against Humanity','Memes Against Humanity'], creator: ['Meme Creator','Meme Creator']};
  const authored = () => ({text:'', x:50, y:80, size:30, align:'center'});
  let draftKey = '';
  let draft = [];
  let editor;
  let paintEditor = false;
  let previousCue = null;
  let busy = false;
  let activeMedia = {};

  function background(id) {
    const image = activeMedia[id];
    if (typeof image === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image)) {
      return `<img src="${image}" alt="">`;
    }
    const [accent, shade, path] = art[templateId(id)] ?? art.spark;
    const alt = id !== templateId(id);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 145" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="160" height="145" fill="${alt ? accent : shade}"/>
      <circle cx="36" cy="14" r="64" fill="#fff" opacity=".11"/><circle cx="150" cy="121" r="50" fill="#000" opacity=".10"/>
      <path d="${path}" fill="none" stroke="${alt ? shade : accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
      <rect x="9" y="9" width="142" height="127" fill="none" stroke="#fff" stroke-width="1" opacity=".35" rx="7"/>
    </svg>`;
  }

  function fieldHtml(field) {
    const alignment = ['left','right','center'].includes(field.align) ? field.align : 'center';
    return `<span class="meme-field" style="--meme-x:${pos(field.x)}%;--meme-y:${pos(field.y)}%;--meme-size:${textSize(field.size)/28}em;text-align:${alignment}">${esc(field.text)}</span>`;
  }

  function preview(template, fields = []) {
    return `<div class="meme-picture">${background(template)}${fields.filter(f => f.text).map(fieldHtml).join('')}</div>`;
  }

  function card(entry, index, button = '') {
    const caption = translate(entry.caption);
    return `<article class="meme-card">
      ${preview(entry.template, entry.fields)}
      ${caption ? `<p class="meme-caption">${esc(caption)}</p>` : ''}
      ${Number.isInteger(index) ? `<small>${t('Beitrag', 'Entry')} ${index + 1}</small>` : ''}
      ${entry.name ? `<p class="meme-caption">${esc(entry.name)} · ${entry.votes} ${t('Stimmen', 'votes')}${entry.winner ? ' · '+t('Gewonnen', 'Winner') : ''}</p>` : ''}
      ${button}
    </article>`;
  }

  function action(id, label, index = '') {
    return `<button class="btn" type="button" data-g="${id}" data-meme-index="${index}">${label}</button>`;
  }

  function editorHtml(g) {
    const range = (field, name, title, min, max) =>
      `<label>${title}<input type="range" data-meme-prop="${name}" min="${min}" max="${max}" value="${field[name]}"></label>`;
    const inputs = draft.map((field, index) => `<fieldset data-meme-field="${index}">
      <legend>${t('Textfeld', 'Text field')} ${index + 1}</legend>
      <label>${t('Beschriftung', 'Caption')}<textarea maxlength="160" rows="2" data-meme-prop="text">${esc(field.text)}</textarea></label>
      <div class="meme-editor-position">
        ${range(field,'x',t('Waagerecht', 'Horizontal'),5,95)}
        ${range(field,'y',t('Senkrecht', 'Vertical'),5,95)}
        ${range(field,'size',t('Schriftgröße', 'Text size'),16,52)}
        <label>${t('Ausrichtung', 'Alignment')}<select data-meme-prop="align">${[['left','Links','Left'],['center','Mitte','Centre'],['right','Rechts','Right']].map(([value,de,en]) =>
          `<option value="${value}" ${value === field.align ? 'selected' : ''}>${t(de,en)}</option>`).join('')}</select></label>
      </div>
      ${draft.length > 1 ? action('remove-text',t('Feld entfernen', 'Remove field'),index) : ''}
    </fieldset>`).join('');
    return `<div class="meme-editor">
      <div><div data-meme-preview>${preview(g.template,draft)}</div>${action('export-meme',t('Als PNG speichern', 'Save as PNG'))}</div>
      <div class="meme-editor-fields"><div class="meme-editor-actions">
        ${draft.length < 3 ? action('add-text',t('Textfeld hinzufügen', 'Add text field')) : ''}
        ${action('submit-editor',t('Anonym einreichen', 'Submit anonymously'))}
      </div>${inputs}</div>
    </div>`;
  }

  function onInput(event) {
    const control = event.target.closest('.meme-editor [data-meme-prop]');
    if (!control || !editor) return;
    const field = draft[Number(control.closest('[data-meme-field]').dataset.memeField)];
    if (!field) return;
    const prop = control.dataset.memeProp;
    field[prop] = control.type === 'range' ? Number(control.value) : control.value;
    const show = document.querySelector('[data-meme-preview]');
    if (show) show.innerHTML = preview(editor.template,draft);
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  async function exportPng() {
    const svg = document.querySelector('[data-meme-preview] svg');
    const raster = document.querySelector('[data-meme-preview] img');
    if (!svg && !raster) return;
    const src = svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg)) : raster.src;
    try {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 725;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const field of draft.filter(field => field.text.trim())) {
        const px = canvas.width * pos(field.x) / 100;
        const py = canvas.height * pos(field.y) / 100;
        const size = textSize(field.size) * 2;
        ctx.font = '700 ' + size + 'px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(3, size / 10);
        ctx.strokeStyle = '#111421';
        ctx.fillStyle = '#fff9ec';
        const max = Math.max(100, Math.min(px, canvas.width-px) * 2 - 8);
        const parts = field.text.match(/.{1,32}(?:\s|$)|.{1,32}/gu) || [];
        parts.forEach((part, index) => {
          const y = py + (index - (parts.length-1)/2) * size * 1.05;
          const offset = field.align === 'left' ? -max*.16 : field.align === 'right' ? max*.16 : 0;
          ctx.strokeText(part.trim(), px+offset, y, max*.68);
          ctx.fillText(part.trim(), px+offset, y, max*.68);
        });
      }
      const anchor = document.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = 'spieleabend-meme.png';
      anchor.click();
    } catch {
      toast(t('Bildexport fehlgeschlagen.', 'Could not export the image.'), true);
    }
  }

  async function gameAction(event, payload) {
    try {
      const answer = await socket.timeout(5000).emitWithAck(event, payload);
      if (!answer?.ok) toast(answer?.error || t('Aktion abgelehnt.', 'Action was rejected.'), true);
      return answer;
    } catch {
      toast(t('Keine Entscheidung bestätigt. Warte auf den aktuellen Spielstand.', 'No action was confirmed. Wait for the current game state.'), true);
      return null;
    }
  }

  async function dispatch(event, values) {
    if (busy) return;
    busy = true;
    try { await gameAction(event, values); } finally { busy = false; }
  }

  async function uploadImage() {
    if (busy) return;
    const selected = document.querySelector('.meme-upload input[type=file]')?.files?.[0];
    const title = document.querySelector('[data-meme-image-title]')?.value.trim();
    if (!selected || !title || selected.size > 2 * 1024 * 1024) {
      toast(t('Wähle ein Bild bis 2 MB und gib ihm einen Titel.', 'Choose an image up to 2 MB and enter a title.'), true);
      return;
    }
    busy = true;
    try {
      const bytes = new Uint8Array(await selected.slice(0,12).arrayBuffer());
      const typed = selected.type === 'image/png' && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ||
        selected.type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
        selected.type === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8)) === 'WEBP';
      if (!typed) throw Error(t('Nur gültige PNG-, JPEG- oder WebP-Dateien sind möglich.', 'Choose a valid PNG, JPEG or WebP file.'));
      const img = await createImageBitmap(selected);
      try {
        if (img.width > 2048 || img.height > 2048 || img.width < 1 || img.height < 1) {
          throw Error(t('Das Bild darf höchstens 2048 × 2048 Pixel groß sein.', 'The image must be at most 2048 × 2048 pixels.'));
        }
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        const ctx = canvas.getContext('2d', {willReadFrequently:true});
        ctx.fillStyle = '#222e43';
        ctx.fillRect(0,0,160,160);
        const scale = Math.min(160/img.width,160/img.height);
        ctx.drawImage(img,(160-img.width*scale)/2,(160-img.height*scale)/2,img.width*scale,img.height*scale);
        const raw = ctx.getImageData(0,0,160,160).data;
        let binary = '';
        for (let i = 0; i<raw.length; i+=4096) binary += String.fromCharCode(...raw.subarray(i,i+4096));
        const encoded = btoa(binary);
        const started = await gameAction('meme-image-begin',{title});
        if (!started?.ok || !started.token) return;
        for (let offset=0,index=0; offset<encoded.length; offset+=12000,index++) {
          const reply = await gameAction('meme-image-chunk',{token:started.token,index,chunk:encoded.slice(offset,offset+12000)});
          if (!reply?.ok) return;
        }
        toast(t('Bild für diesen Raum gespeichert.', 'Image saved for this room.'));
      } finally { img.close(); }
    } catch(error) {
      toast(error?.message || t('Bild konnte nicht gelesen werden.', 'Could not read the image.'), true);
    } finally { busy = false; }
  }

  function privatePack(S) {
    if (!S.you?.isHost) return '';
    return `<details class="meme-upload">
      <summary>${t('Private Bilder für diesen Raum', 'Private images for this room')}</summary>
      <p>${t('Nur Bilder mit Nutzungsrecht. Aktiviere das eigene Paket im Host-Menü.', 'Upload images you may use. Enable the private pack in host settings.')}</p>
      <label>${t('Bilddatei', 'Image file')} <input type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label>${t('Bildtitel', 'Image title')} <input maxlength="64" data-meme-image-title></label>
      ${action('meme-upload',t('Privates Bild hinzufügen', 'Add private image'))}
      <ul>${(S.privateMemeCards || []).map(image => `<li>${esc(image.title)} <button type="button" class="btn" data-g="meme-remove" data-meme-id="${esc(image.id)}">${t('Löschen', 'Delete')}</button></li>`).join('')}</ul>
    </details>`;
  }

  function display(S) {
    const g = S.g;
    activeMedia = g?.media || {};
    if (!g?.stage) return `<div class="wk-stage meme-stage"><h2>${t('Meme-Duell', 'Meme Duel')}</h2></div>`;
    const head = WorldKit.head({
      title: t(...modes[g.mode]),
      chips: [
        WorldKit.chip('●', `${t('Runde', 'Round')} ${g.q}/${g.of}`),
        ...(g.judge ? [WorldKit.chip('★', `${t('Jury', 'Judge')}: ${esc(g.judge)}`)] : []),
      ],
    });
    let body;
    if (g.stage === 'write') {
      if (g.mode === 'creator' && g.canSubmit) {
        if (draftKey !== S.code + ':' + g.stamp) {
          draft = [authored()];
          draftKey = S.code + ':' + g.stamp;
        }
        editor = g;
        body = editorHtml(g);
      } else {
        const selected = g.canSubmit && g.mode === 'text' ? `<div class="meme-options">${g.hand.map((answer,i) => action('meme-card',esc(translate(answer)),i)).join('')}</div>`
          : g.canSubmit && g.mode === 'image' ? `<div class="meme-cards">${g.hand.map((template,i) => card({template},null,
            action('meme-card',`${t('Bild wählen', 'Choose image')} ${i+1}`,i))).join('')}</div>`
            : `<p role="status">${g.submitted ? t('Beitrag eingereicht.', 'Entry submitted.') : t('Warten auf die Beiträge.', 'Waiting for entries.')}</p>`;
        const question = g.situation ? `<h3 class="meme-question">${esc(translate(g.situation))}</h3>` : preview(g.template);
        body = `<div class="meme-compose">${question}${selected}</div>`;
      }
    } else if (g.stage === 'vote') {
      const choices = g.choices.map((entry,i) => card(entry,i,g.canVote && !entry.mine
        ? action('meme-ballot',`${t('Abstimmen', 'Vote')} ${i+1}`,i)
        : entry.mine ? `<small>${t('Dein Beitrag', 'Your entry')}</small>` : '')).join('');
      const status = g.voteSent ? t('Stimme gespeichert.', 'Vote recorded.') : t('Anonyme Beiträge', 'Anonymous entries');
      body = `<h3>${status}</h3><div class="meme-cards">${choices}</div>`;
    } else {
      body = `<h3>${t('Rundenergebnis', 'Round result')}</h3><div class="meme-cards">${g.results.map(entry => card(entry)).join('')}</div>`;
    }
    return `<div class="wk-stage meme-stage">${head}${body}</div>`;
  }

  const kit = kitGame({
    id: 'meme-duell',
    name: t('Meme-Duell','Meme Duel'),
    ring: false,
    playerInfo: (p) => `${p.pts || 0} ${t('Punkte', 'points')}`,
    status: S => S.g?.stage ? `${t('Runde', 'Round')} ${S.g.q}/${S.g.of} · ${t(...modes[S.g.mode])}` : '',
    onState(S) {
      const stage = S.phase === 'playing' ? S.g?.stage : null;
      if (S.settings.effects && previousCue?.code === S.code && previousCue.stage && previousCue.stage !== stage && stage === 'reveal') {
        GameDesign.sound('meme-duell','done');
      }
      previousCue = {code:S.code,stage};
      if (S.phase !== 'playing' || S.g?.stage !== 'write' || !S.g.canSubmit) editor = null;
    },
    keepMain(S) {
      if (paintEditor) { paintEditor = false; return false; }
      return !!(editor && S.g?.stage === 'write' && S.g.canSubmit && S.g.mode === 'creator' &&
        draftKey === S.code + ':' + S.g.stamp && document.querySelector('.meme-editor'));
    },
    main: display,
    lobbyExtra: privatePack,
    hostExtra: S => S.phase === 'over' ? privatePack(S) : '',
    hint: S => S.g?.stage === 'write' ? t('Beiträge werden gesammelt', 'Collecting entries')
      : S.g?.stage === 'vote' ? t('Abstimmung läuft', 'Voting in progress')
      : t('Die Runde ist ausgewertet', 'Round scored'),
    dock: S => S.you?.isHost && S.phase === 'playing' && S.g?.stage === 'reveal'
      ? action('meme-next',t('Weiter', 'Next')) : '',
    rules: `<p>${t('Im Textmodus wählt die wechselnde Jury. Bei der Bildwahl stimmt die Gruppe für fremde Beiträge. Für eigene Memes kann der Host auch eine Jury wählen. Bei Gleichstand erhalten alle Erstplatzierten einen Punkt.',
      'A rotating judge picks in caption mode. In picture mode, everyone votes for another player. The host may choose a judge for creator mode. Tied winners receive one point each.')}</p>`,
    async onClick(button,S) {
      const g = S.g;
      const index = Number(button.dataset.memeIndex);
      switch (button.dataset.g) {
        case 'meme-next': await dispatch('next', {}); break;
        case 'meme-upload': await uploadImage(); break;
        case 'meme-remove': await dispatch('meme-image-remove', {id:button.dataset.memeId}); break;
        case 'meme-card': await dispatch('meme-submit', {stamp:g.stamp, card:index}); break;
        case 'meme-ballot': await dispatch('meme-vote', {stamp:g.stamp, choice:index}); break;
        case 'add-text':
        case 'remove-text': {
          if (!editor) return;
          if (button.dataset.g === 'add-text' && draft.length < 3) draft.push({...authored(), y:20});
          if (button.dataset.g === 'remove-text' && draft.length > 1) draft.splice(index, 1);
          paintEditor = true;
          kit.render();
          [...document.querySelectorAll('.meme-editor textarea')].at(-1)?.focus();
          break;
        }
        case 'submit-editor': {
          const fields = draft.filter(field => field.text.trim().length);
          if (fields.length) await dispatch('meme-submit', {stamp:g.stamp, fields});
          else document.querySelector('.meme-editor textarea')?.focus();
          break;
        }
        case 'export-meme':
          await exportPng();
          break;
      }
    },
  });
}

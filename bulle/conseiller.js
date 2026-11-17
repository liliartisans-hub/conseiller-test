/* Conseiller virtuel (IA) de la cave Maison Désiré — bulle du site (P1).
 * Fichier autonome, chargé dans le thème par : <script src="https://liliartisans-hub.github.io/conseiller-test/bulle/conseiller.js" defer></script>
 * AUCUNE clé ni code d'accès ici : seulement l'adresse publique de la fonction. Aucun cookie : l'identifiant de conversation et
 * le fil restent dans l'onglet (sessionStorage), effacés à sa fermeture. Si le conseiller est éteint ou ne répond pas, rien ne
 * s'affiche. Styles isolés (Shadow DOM) : la bulle ne modifie ni le thème, ni le panier, ni la vérification de l'âge. */
(function (w, d) {
  'use strict';
  if (w.__conseillerMaisonDesire) return; // ligne collée deux fois : une seule bulle
  w.__conseillerMaisonDesire = true;

  var ADRESSE = 'https://bcntaxpxhyyhgrlhekmn.supabase.co/functions/v1/conseiller';
  var ACCUEIL = 'Bonjour ! Je vous aide à choisir une bouteille de la cave. Dites-moi pour qui, pour quelle occasion, et votre budget si vous en avez un.';
  var TRES_DEMANDE = 'Le conseiller est très demandé, réessayez plus tard ou appelez la boutique au 05 56 93 06 04.';
  var CLE = 'conseiller-md';

  function lire() { try { return JSON.parse(w.sessionStorage.getItem(CLE)) || null; } catch (e) { return null; } }
  function ecrire(etat) { try { w.sessionStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* stockage refusé : la bulle marche quand même */ } }
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    var b = new Uint8Array(16); w.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var etat = lire() || {};
  if (typeof etat.session !== 'string' || !Array.isArray(etat.fil)) etat = { session: uuid(), fil: [], ouvert: false };

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // « [Nom — prix](https://maisondesire.com/…) » écrit par le code devient un lien qui ouvre la fiche dans le MÊME onglet.
  var BOUTIQUE = 'https:\\/\\/(?:www\\.)?maisondesire\\.com\\/[\\w\\/-]*';
  function lier(s) {
    return echapper(s)
      .replace(new RegExp('\\[([^\\]]+)\\]\\((' + BOUTIQUE + ')\\)', 'g'), function (m, t, u) { return '<a href="' + u + '">' + t + '</a>'; })
      .replace(new RegExp('(^|[^"\\w])(' + BOUTIQUE + ')(?![\\w\\/-])', 'g'), function (m, avant, u) { return avant + '<a href="' + u + '">voir la bouteille</a>'; });
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.lanceur{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;border:0;border-radius:999px;',
    ' padding:12px 16px;background:#7b2d26;color:#fff;font-size:15px;line-height:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}',
    '.panneau{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;width:min(380px,calc(100vw - 16px));',
    ' height:min(560px,calc(100dvh - 32px));display:flex;flex-direction:column;background:#f7f4ef;color:#2a2420;border:1px solid #e2dbd2;',
    ' border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.22);overflow:hidden;font-size:15px;line-height:1.45}',
    '@media (max-width:420px){.panneau{right:8px;bottom:calc(8px + env(safe-area-inset-bottom));height:calc(100dvh - 16px)}}',
    '[hidden]{display:none!important}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e2dbd2}',
    'header strong{font-size:15px}',
    '.fermer{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#6f645b;padding:4px 8px}',
    '.fil{flex:1;overflow-y:auto;padding:10px 12px}',
    '.msg{margin:8px 0;padding:8px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.client{background:#7b2d26;color:#fff;margin-left:14%}',
    '.conseiller{background:#fff;border:1px solid #e2dbd2;margin-right:6%}',
    '.conseiller a{color:#7b2d26}',
    '.attente{color:#6f645b;font-style:italic;display:flex;align-items:center;gap:10px}',
    '.points{display:inline-flex;gap:4px;flex:none}',
    '.points i{width:7px;height:7px;border-radius:50%;background:#7b2d26;opacity:.25;animation:pulse 1.2s infinite ease-in-out}',
    '.points i:nth-child(2){animation-delay:.2s}.points i:nth-child(3){animation-delay:.4s}',
    '@keyframes pulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.points i{animation:none;opacity:.6}}',
    'form{display:flex;gap:8px;padding:8px 10px;border-top:1px solid #e2dbd2;background:#fff}',
    'input{flex:1;min-width:0;padding:9px 10px;border:1px solid #e2dbd2;border-radius:8px;font-size:16px;color:#2a2420;background:#fff}',
    'button.envoyer{border:0;border-radius:8px;padding:9px 14px;background:#7b2d26;color:#fff;font-size:15px;cursor:pointer}',
    'button.envoyer:disabled{opacity:.5}',
  ].join('\n');

  var HTML = '<style>' + CSS + '</style>' +
    '<button class="lanceur" type="button" aria-label="Ouvrir le conseiller virtuel (IA)">Conseiller virtuel (IA)</button>' +
    '<section class="panneau" role="dialog" aria-label="Conseiller virtuel (IA)" hidden>' +
    '<header><strong>Conseiller virtuel (IA)</strong><button class="fermer" type="button" aria-label="Fermer">×</button></header>' +
    '<div class="fil" aria-live="polite"></div>' +
    '<form><input maxlength="1000" autocomplete="off" placeholder="Votre question…" aria-label="Votre question">' +
    '<button class="envoyer" type="submit">Envoyer</button></form></section>';

  function monter() {
    var hote = d.createElement('div');
    hote.id = 'conseiller-maison-desire';
    var racine = hote.attachShadow ? hote.attachShadow({ mode: 'closed' }) : hote;
    racine.innerHTML = HTML;
    var lanceur = racine.querySelector('.lanceur'), panneau = racine.querySelector('.panneau');
    var fil = racine.querySelector('.fil'), form = racine.querySelector('form');
    var champ = racine.querySelector('input'), bouton = racine.querySelector('.envoyer');

    function bulle(classe, html) {
      var m = d.createElement('div'); m.className = 'msg ' + classe; m.innerHTML = html; fil.appendChild(m);
      fil.scrollTop = fil.scrollHeight; return m;
    }
    function ouvrir(oui) {
      etat.ouvert = oui; ecrire(etat);
      panneau.hidden = !oui; lanceur.hidden = oui;
      if (oui) { fil.scrollTop = fil.scrollHeight; champ.focus(); }
    }
    bulle('conseiller', echapper(ACCUEIL));
    etat.fil.forEach(function (m) { bulle(m.qui, m.qui === 'client' ? echapper(m.texte) : lier(m.texte)); });
    lanceur.addEventListener('click', function () { ouvrir(true); });
    racine.querySelector('.fermer').addEventListener('click', function () { ouvrir(false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = champ.value.trim();
      if (!message || bouton.disabled) return;
      champ.value = '';
      bulle('client', echapper(message));
      etat.fil.push({ qui: 'client', texte: message }); ecrire(etat);
      // E14 : bulle d'attente écrite par la page, remplacée par la réponse vérifiée.
      var attente = bulle('conseiller attente', '<span class="points" aria-hidden="true"><i></i><i></i><i></i></span><span class="etat">Je regarde dans le catalogue…</span>');
      var relais = setTimeout(function () { var x = attente.querySelector('.etat'); if (x) x.textContent = 'Je compare quelques bouteilles pour vous…'; }, 4000);
      bouton.disabled = true;
      envoyer(message).then(function (texte) {
        attente.className = 'msg conseiller'; attente.innerHTML = lier(texte);
        etat.fil.push({ qui: 'conseiller', texte: texte }); etat.fil = etat.fil.slice(-40); ecrire(etat);
      }).then(function () { clearTimeout(relais); bouton.disabled = false; fil.scrollTop = fil.scrollHeight; });
    });

    d.body.appendChild(hote);
    ouvrir(!!etat.ouvert);
  }

  // Envoi : jamais de code d'accès, jamais d'erreur technique affichée (message poli à la place).
  function envoyer(message) {
    return w.fetch(ADRESSE, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ session: etat.session, message: message }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (s) { return r.ok && s.texte_affiche ? s.texte_affiche : TRES_DEMANDE; }); })
      .catch(function () { return TRES_DEMANDE; });
  }

  // Démarrage : le conseiller est-il allumé ? (4 s au plus) Non, erreur ou silence → aucune bulle.
  function demarrer() {
    var fini = false;
    var minuterie = setTimeout(function () { fini = true; }, 4000);
    w.fetch(ADRESSE, { method: 'GET', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { clearTimeout(minuterie); if (!fini && s && s.actif === true && d.body) monter(); })
      .catch(function () { clearTimeout(minuterie); });
  }

  if (w.__CONSEILLER_TEST__) w.__CONSEILLER_TEST__ = { lier: lier, envoyer: envoyer, etat: function () { return etat; } };
  demarrer();
})(window, document);

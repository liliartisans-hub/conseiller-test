/* Notre caviste virtuel (IA) de la cave Maison Désiré — bulle du site (P1, P2 « une bulle qui donne envie »).
 * Fichier autonome, chargé dans le thème par : <script src="https://liliartisans-hub.github.io/conseiller-test/bulle/conseiller.js" defer></script>
 * AUCUNE clé ni code d'accès ici : seulement l'adresse publique de la fonction. Aucun cookie : l'identifiant de conversation,
 * le fil et l'invitation déjà vue restent dans l'onglet (sessionStorage), effacés à sa fermeture. Si le conseiller est éteint
 * ou ne répond pas, rien ne s'affiche. Styles isolés (Shadow DOM) ; seul ajout dans la page : un lien discret sous
 * « Ajouter au panier » d'une fiche bouteille, et seulement si ce bouton est trouvé. La bulle s'efface tant qu'une fenêtre
 * de vérification de l'âge est visible. */
(function (w, d) {
  'use strict';
  if (w.__conseillerMaisonDesire) return; // ligne collée deux fois : une seule bulle
  w.__conseillerMaisonDesire = true;

  var ADRESSE = 'https://bcntaxpxhyyhgrlhekmn.supabase.co/functions/v1/conseiller';
  var ACCUEIL = 'Bonjour ! Je vous aide à choisir une bouteille de la cave. Dites-moi pour qui, pour quelle occasion, et votre budget si vous en avez un.';
  // E19 (test réel du 17/11) : une erreur technique n'est JAMAIS présentée comme une limite (« très demandé » : seulement quand la
  // fonction le dit elle-même) ; message honnête à la place.
  var ERREUR_TECHNIQUE = 'Je n’arrive pas à répondre pour l’instant, la boutique vous renseigne au 05 56 93 06 04.';
  var INVITATION = 'Un cadeau à trouver, une bouteille à découvrir ? Je vous aide en 30 secondes.';
  var LIEN_FICHE = 'Une question sur cette bouteille ? Des bouteilles proches ? Demandez à notre caviste (IA)';
  var SUGGESTIONS = [['Un cadeau', 'Je cherche une bouteille à offrir'], ['Pour débuter', 'Je débute, que me conseillez-vous ?'],
    ['Un whisky tourbé', 'Un whisky tourbé'], ['Avec un plat', 'Que servir avec mon repas ?'], ['Un apéritif', 'Une idée pour l\'apéritif']];
  var SUGGESTIONS_FICHE = [['Parlez-moi de cette bouteille', 'Parlez-moi de cette bouteille'], ['Des bouteilles proches', 'Des bouteilles proches']];
  var DELAI_INVITATION_MS = 10000;
  var CLE = 'conseiller-md';
  // Bouton « Ajouter au panier » des thèmes Shopify (formulaire /cart/add). Introuvable → aucun lien, aucune erreur.
  var BOUTON_PANIER = 'form[action*="/cart/add"] button[name="add"], form[action*="/cart/add"] [type="submit"], button.product-form__submit, [data-add-to-cart], #AddToCart';
  // Fenêtres de vérification de l'âge : identifiants usuels des applications, ou dialogue qui parle de l'âge.
  var FENETRE_AGE = '[id*="age-verif" i], [class*="age-verif" i], [id*="ageverif" i], [class*="ageverif" i], [id*="age_verif" i], [class*="age_verif" i],' +
    ' [id*="age-gate" i], [class*="age-gate" i], [id*="agegate" i], [class*="agegate" i], [id*="age-check" i], [class*="age-check" i]';
  var DIALOGUES = '[role="dialog"], [aria-modal="true"], dialog[open]';
  var TEXTE_AGE = /18 ans|18\+|majeur|majorité|âge légal|votre âge|l['’]âge requis|date de naissance/i;
  // Barre « Ajouter au panier » collée en bas de l'écran (téléphone) : la bulle se place au-dessus.
  var BARRE_COLLANTE = '[class*="sticky" i][class*="cart" i], [class*="sticky" i][class*="atc" i], [id*="sticky" i][id*="cart" i], [id*="sticky" i][id*="atc" i], sticky-add-to-cart';

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

  // Pages : panier et paiement (jamais d'invitation), fiche bouteille (adresse de la fiche).
  function chemin() { return (w.location && w.location.pathname) || '/'; }
  function pagePanier(p) { return /(^|\/)(cart|checkouts?)(\/|$)/.test(p); }
  function adresseFiche(p) { var m = /(?:^|\/)products\/([a-z0-9][a-z0-9-]*)/i.exec(p); return m ? m[1].toLowerCase() : null; }
  function visible(e) {
    if (!e || e.hidden) return false;
    if (e.getClientRects && !e.getClientRects().length) return false;
    var s = w.getComputedStyle ? w.getComputedStyle(e) : null;
    return !s || (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0');
  }
  function chercher(selecteur) { try { return Array.prototype.slice.call(d.querySelectorAll(selecteur)); } catch (e) { return []; } }
  function verificationAgeVisible() {
    if (chercher(FENETRE_AGE).some(visible)) return true;
    return chercher(DIALOGUES).some(function (e) { return visible(e) && TEXTE_AGE.test(e.textContent || ''); });
  }
  function hauteurBarreCollante() {
    var h = 0, bas = w.innerHeight || 0;
    chercher(BARRE_COLLANTE).forEach(function (e) {
      if (!visible(e) || !e.getBoundingClientRect) return;
      var r = e.getBoundingClientRect();
      if (r.height > 0 && r.height < 200 && r.bottom >= bas - 4) h = Math.max(h, r.height);
    });
    return h;
  }

  var ICONE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" ' +
    'd="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 3 13.5"/><path fill="currentColor" d="M8 8.5h8v1.6H8zM8 11.5h5.5v1.6H8z"/></svg>';

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '[hidden]{display:none!important}',
    '.lanceur{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;display:flex;align-items:center;gap:10px;',
    ' border:2px solid #f3e9dc;border-radius:999px;padding:12px 18px 12px 14px;background:#7b2d26;color:#fff;font-size:16px;font-weight:600;',
    ' line-height:1.1;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.28);transition:transform .15s ease,box-shadow .15s ease}',
    '.lanceur:hover,.lanceur:focus-visible{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.32)}',
    '.lanceur:focus-visible{outline:3px solid #f3e9dc;outline-offset:2px}',
    '.icone{display:inline-flex;flex:none}',
    '.ia{flex:none;background:#f3e9dc;color:#7b2d26;font-size:12px;font-weight:800;letter-spacing:.04em;border-radius:6px;padding:3px 6px}',
    '.court{display:none}',
    '@media (max-width:420px){.long{display:none}.court{display:inline}.lanceur{right:12px;padding:10px 14px 10px 12px;font-size:15px;gap:8px}}',
    '.invitation{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:900;width:min(280px,calc(100vw - 32px));',
    ' background:#fff;color:#2a2420;border:1px solid #e2dbd2;border-radius:14px;padding:12px 34px 12px 14px;font-size:15px;line-height:1.4;',
    ' box-shadow:0 8px 24px rgba(0,0,0,.18)}',
    '.invitation p{margin:0;cursor:pointer}',
    '.invitation:after{content:"";position:absolute;right:28px;bottom:-7px;width:12px;height:12px;background:#fff;border-right:1px solid #e2dbd2;',
    ' border-bottom:1px solid #e2dbd2;transform:rotate(45deg)}',
    '.croix{position:absolute;top:4px;right:4px;border:0;background:none;font-size:20px;line-height:1;color:#6f645b;cursor:pointer;padding:4px 8px}',
    '@media (prefers-reduced-motion:no-preference){.invitation{animation:apparaitre .3s ease-out}}',
    '@keyframes apparaitre{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.panneau{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;width:min(380px,calc(100vw - 16px));',
    ' height:min(560px,calc(100dvh - 32px));display:flex;flex-direction:column;background:#f7f4ef;color:#2a2420;border:1px solid #e2dbd2;',
    ' border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.22);overflow:hidden;font-size:15px;line-height:1.45}',
    '@media (max-width:420px){.panneau{right:8px;bottom:calc(8px + env(safe-area-inset-bottom));height:calc(100dvh - 16px)}}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e2dbd2}',
    'header strong{font-size:15px}',
    '.fermer{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#6f645b;padding:4px 8px}',
    '.fil{flex:1;overflow-y:auto;padding:10px 12px}',
    '.msg{margin:8px 0;padding:8px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.client{background:#7b2d26;color:#fff;margin-left:14%}',
    '.conseiller{background:#fff;border:1px solid #e2dbd2;margin-right:6%}',
    '.conseiller a{color:#7b2d26}',
    '.suggestions{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
    '.suggestions button{border:1px solid #7b2d26;background:#fff;color:#7b2d26;border-radius:999px;padding:7px 12px;font-size:14px;line-height:1.2;cursor:pointer}',
    '.suggestions button:hover,.suggestions button:focus-visible{background:#7b2d26;color:#fff}',
    '@media (max-width:420px){.suggestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.suggestions button{padding:7px 6px;font-size:13px}}',
    '.attente{color:#6f645b;font-style:italic;display:flex;align-items:center;gap:10px}',
    '.points{display:inline-flex;gap:4px;flex:none}',
    '.points i{width:7px;height:7px;border-radius:50%;background:#7b2d26;opacity:.25;animation:pulse 1.2s infinite ease-in-out}',
    '.points i:nth-child(2){animation-delay:.2s}.points i:nth-child(3){animation-delay:.4s}',
    '@keyframes pulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.points i{animation:none;opacity:.6}.lanceur{transition:none}}',
    'form{display:flex;gap:8px;padding:8px 10px;border-top:1px solid #e2dbd2;background:#fff}',
    'input{flex:1;min-width:0;padding:9px 10px;border:1px solid #e2dbd2;border-radius:8px;font-size:16px;color:#2a2420;background:#fff}',
    'button.envoyer{border:0;border-radius:8px;padding:9px 14px;background:#7b2d26;color:#fff;font-size:15px;cursor:pointer}',
    'button.envoyer:disabled{opacity:.5}',
  ].join('\n');

  // Construction par éléments (aucun HTML venu de l'extérieur, sauf les réponses passées par lier()).
  function el(tag, attributs, enfants) {
    var e = d.createElement(tag);
    Object.keys(attributs || {}).forEach(function (k) {
      if (k === 'texte') e.textContent = attributs[k];
      else if (k === 'classe') e.className = attributs[k];
      else e.setAttribute(k, attributs[k]);
    });
    (enfants || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function monter() {
    var hote = el('div', { id: 'conseiller-maison-desire' });
    var racine = hote.attachShadow ? hote.attachShadow({ mode: 'closed' }) : hote;
    var icone = el('span', { classe: 'icone' }); icone.innerHTML = ICONE;
    var lanceur = el('button', { classe: 'lanceur', type: 'button', 'aria-label': 'Un conseil ? Demandez à notre caviste, conseiller virtuel (IA)' }, [
      icone, el('span', { classe: 'long', texte: 'Un conseil ? Demandez à notre caviste' }), el('span', { classe: 'court', texte: 'Conseil' }),
      el('span', { classe: 'ia', texte: 'IA' })]);
    var texteInvitation = el('p', { texte: INVITATION });
    var croix = el('button', { classe: 'croix', type: 'button', 'aria-label': 'Fermer l\'invitation', texte: '×' });
    var invitation = el('div', { classe: 'invitation', role: 'status' }, [texteInvitation, croix]);
    invitation.hidden = true;
    var fil = el('div', { classe: 'fil', 'aria-live': 'polite' });
    var suggestions = el('div', { classe: 'suggestions' });
    var champ = el('input', { maxlength: '1000', autocomplete: 'off', placeholder: 'Votre question…', 'aria-label': 'Votre question' });
    var bouton = el('button', { classe: 'envoyer', type: 'submit', texte: 'Envoyer' });
    var form = el('form', {}, [champ, bouton]);
    var fermer = el('button', { classe: 'fermer', type: 'button', 'aria-label': 'Fermer', texte: '×' });
    var panneau = el('section', { classe: 'panneau', role: 'dialog', 'aria-label': 'Notre caviste virtuel (IA)' }, [
      el('header', {}, [el('strong', { texte: 'Notre caviste virtuel (IA)' }), fermer]), fil, form]);
    panneau.hidden = true;
    [el('style', { texte: CSS }), lanceur, invitation, panneau].forEach(function (e) { racine.appendChild(e); });

    var fiche = adresseFiche(chemin());
    var lienFiche = null;

    function bulle(classe, html) {
      var m = el('div', { classe: 'msg ' + classe }); m.innerHTML = html; fil.appendChild(m);
      fil.scrollTop = fil.scrollHeight; return m;
    }
    // Suggestions : sous l'accueil tant qu'aucun message n'est envoyé ; celles de la fiche quand on vient du lien de la fiche.
    function proposer(liste, avecFiche) {
      suggestions.textContent = '';
      liste.forEach(function (s) {
        var b = el('button', { type: 'button', texte: s[0] });
        b.addEventListener('click', function () { envoyerMessage(s[1], avecFiche ? fiche : null); });
        suggestions.appendChild(b);
      });
      fil.appendChild(suggestions); suggestions.hidden = false;
      fil.scrollTop = fil.scrollHeight;
    }
    function ouvrir(oui) {
      etat.ouvert = oui; ecrire(etat);
      panneau.hidden = !oui; lanceur.hidden = oui;
      if (oui) { cacherInvitation(); fil.scrollTop = fil.scrollHeight; champ.focus(); }
    }
    function cacherInvitation() { invitation.hidden = true; }
    function placer() {
      var h = hauteurBarreCollante();
      lanceur.style.bottom = h ? 'calc(' + (16 + h) + 'px + env(safe-area-inset-bottom))' : '';
      invitation.style.bottom = h ? 'calc(' + (84 + h) + 'px + env(safe-area-inset-bottom))' : '';
    }
    // Invitation : une fois par visite, après 10 s ET une interaction, jamais sur le panier ou le paiement, jamais si la
    // conversation est commencée ou le panneau ouvert, jamais devant la vérification de l'âge. N'ouvre jamais le panneau.
    function verifierInvitation() {
      if (!delaiPasse || !interaction || etat.invitation || etat.ouvert || etat.fil.length || pagePanier(chemin())) return;
      if (hote.style.display === 'none') return;
      etat.invitation = 'vue'; ecrire(etat);
      invitation.hidden = false;
    }
    function insererLienFiche() {
      if (!fiche || (lienFiche && lienFiche.isConnected)) return;
      var cible = chercher(BOUTON_PANIER).filter(visible)[0];
      if (!cible) return;
      var point = (cible.closest && cible.closest('form')) || cible;
      lienFiche = el('a', { href: '#conseiller', classe: 'conseiller-lien-fiche', texte: LIEN_FICHE });
      lienFiche.style.display = 'block'; lienFiche.style.marginTop = '10px'; lienFiche.style.fontSize = '0.92em'; lienFiche.style.lineHeight = '1.45';
      lienFiche.style.color = '#7b2d26'; lienFiche.style.textDecoration = 'underline'; lienFiche.style.cursor = 'pointer';
      lienFiche.addEventListener('click', function (e) {
        e.preventDefault();
        ouvrir(true); proposer(SUGGESTIONS_FICHE, true);
      });
      point.insertAdjacentElement('afterend', lienFiche);
    }
    function surveiller() {
      hote.style.display = verificationAgeVisible() ? 'none' : '';
      placer(); insererLienFiche(); verifierInvitation();
    }

    bulle('conseiller', echapper(ACCUEIL));
    etat.fil.forEach(function (m) { bulle(m.qui, m.qui === 'client' ? echapper(m.texte) : lier(m.texte)); });
    if (!etat.fil.length) proposer(SUGGESTIONS, false);
    lanceur.addEventListener('click', function () { ouvrir(true); });
    fermer.addEventListener('click', function () { ouvrir(false); });
    texteInvitation.addEventListener('click', function () { ouvrir(true); });
    croix.addEventListener('click', function () { etat.invitation = 'fermee'; ecrire(etat); cacherInvitation(); });

    function envoyerMessage(message, ficheEnvoyee) {
      if (!message || bouton.disabled) return;
      suggestions.hidden = true;
      bulle('client', echapper(message));
      etat.fil.push({ qui: 'client', texte: message }); ecrire(etat);
      // E14 : bulle d'attente écrite par la page, remplacée par la réponse vérifiée.
      var attente = bulle('conseiller attente', '<span class="points" aria-hidden="true"><i></i><i></i><i></i></span><span class="etat">Je regarde dans le catalogue…</span>');
      var relais = setTimeout(function () { var x = attente.querySelector('.etat'); if (x) x.textContent = 'Je compare quelques bouteilles pour vous…'; }, 4000);
      bouton.disabled = true;
      return envoyer(message, ficheEnvoyee).then(function (texte) {
        attente.className = 'msg conseiller'; attente.innerHTML = lier(texte);
        etat.fil.push({ qui: 'conseiller', texte: texte }); etat.fil = etat.fil.slice(-40); ecrire(etat);
      }).then(function () { clearTimeout(relais); bouton.disabled = false; fil.scrollTop = fil.scrollHeight; });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = champ.value.trim();
      if (!message || bouton.disabled) return;
      champ.value = '';
      envoyerMessage(message, null);
    });

    surInvitation = verifierInvitation;
    d.body.appendChild(hote);
    surveiller();
    setInterval(surveiller, 1000);
    ouvrir(!!etat.ouvert);
  }

  // Envoi : jamais de code d'accès, jamais d'erreur technique affichée (message poli à la place).
  function envoyer(message, fiche) {
    var corps = { session: etat.session, message: message };
    if (fiche) corps.fiche = fiche;
    return w.fetch(ADRESSE, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit', body: JSON.stringify(corps) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (s) { return r.ok && s.texte_affiche ? s.texte_affiche : ERREUR_TECHNIQUE; }); })
      .catch(function () { return ERREUR_TECHNIQUE; });
  }

  // Invitation : 10 s et interaction du visiteur (défilement, clic, toucher, clavier) comptés dès le chargement de la page,
  // même avant l'affichage de la bulle.
  var interaction = false, delaiPasse = false, surInvitation = null;
  function interagir() { interaction = true; if (surInvitation) surInvitation(); }
  w.addEventListener('scroll', interagir, { passive: true });
  ['click', 'touchstart', 'keydown'].forEach(function (t) { d.addEventListener(t, interagir, { passive: true }); });
  setTimeout(function () { delaiPasse = true; if (surInvitation) surInvitation(); }, DELAI_INVITATION_MS);

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

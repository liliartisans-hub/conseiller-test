/* La cave à conseils (IA) de la cave Maison Désiré — bulle du site (P1, P2 « une bulle qui donne envie », P3 cartes bouteille).
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
  var NOM = 'La cave à conseils';
  // P3 (7) : nombres calculés par la fonction (jamais écrits ici), arrondis à la centaine inférieure ; sans nombre, sans chiffre.
  var nombres = null;
  // Typographie française : espace insécable dans les milliers, avant « : ? ! ; » et entre les chiffres d'un numéro.
  function insecable(s) { return String(s).replace(/ ([:?!;»])/g, ' $1').replace(/(\d) (?=\d)/g, '$1 '); }
  function milliers(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function texteAccueil() {
    return insecable(nombres && nombres.total > 0
      ? 'Bonjour ! Je connais toute la cave : les bouteilles du site et plus de ' + milliers(nombres.total) + ' références de la boutique. Dites-moi pour qui, pour quelle occasion, et votre budget si vous en avez un.'
      : 'Bonjour ! Je connais toute la cave, en ligne et en boutique. Dites-moi pour qui, pour quelle occasion, et votre budget si vous en avez un.');
  }
  function texteInvitationCourant() {
    return insecable(nombres && nombres.total > 0
      ? 'Plus de ' + milliers(nombres.total) + ' bouteilles de la boutique, bien plus que sur le site : je vous aide à choisir.'
      : 'Toute la cave de la boutique, bien plus que sur le site : je vous aide à choisir.');
  }
  // E19 (test réel du 17/11) : une erreur technique n'est JAMAIS présentée comme une limite (« très demandé » : seulement quand la
  // fonction le dit elle-même) ; message honnête à la place.
  var ERREUR_TECHNIQUE = 'Je n’arrive pas à répondre pour l’instant, la boutique vous renseigne au 05 56 93 06 04.';
  var MENTION_SANITAIRE = 'L\'abus d\'alcool est dangereux pour la santé, à consommer avec modération.';
  var LIEN_FICHE = 'Une question sur cette bouteille ? Des bouteilles proches ? → La cave à conseils (IA)';
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

  // P4 (2) : palette et polices du site www.maisondesire.com (thème Horizon) — noir et blanc, filets gris fins, titres en
  // serif (nom de la bulle, nom des bouteilles), texte en sans-serif, coins des boutons du site. Polices et coins lus sur la page
  // (policesDuSite) et passés en variables --md-serif, --md-sans, --md-rayon ; repli propre sinon.
  var CSS = [
    '*{box-sizing:border-box;font-family:var(--md-sans)}',
    '[hidden]{display:none!important}',
    '.lanceur{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;display:flex;align-items:center;gap:10px;border:0;border-radius:var(--md-rayon);padding:12px 16px 12px 14px;background:#000;color:#fff;font-size:15px;font-weight:400;line-height:1.1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:background .15s ease}',
    '.lanceur:hover,.lanceur:focus-visible{background:#333}',
    '.lanceur:focus-visible{outline:2px solid #000;outline-offset:3px}',
    '.lanceur .long,.lanceur .court{font-family:var(--md-serif);font-size:16px;letter-spacing:.01em}',
    '.icone{display:inline-flex;flex:none}',
    '.ia{flex:none;background:#f2f2f2;color:#000;font-size:11px;font-weight:600;letter-spacing:.06em;border-radius:4px;padding:3px 6px;font-family:var(--md-sans)}',
    '.court{display:none}',
    '@media (max-width:420px){.long{display:none}.court{display:inline}.lanceur{right:12px;padding:10px 14px 10px 12px;gap:8px}}',
    '.invitation{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:900;width:min(280px,calc(100vw - 32px));background:#fff;color:#181414;border:1px solid #e6e6e6;border-radius:4px;padding:12px 34px 12px 14px;font-size:15px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.12)}',
    '.invitation p{margin:0;cursor:pointer}',
    '.invitation:after{content:"";position:absolute;right:28px;bottom:-7px;width:12px;height:12px;background:#fff;border-right:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;transform:rotate(45deg)}',
    '.croix{position:absolute;top:4px;right:4px;border:0;background:none;font-size:20px;line-height:1;color:#6b6b6b;cursor:pointer;padding:4px 8px}',
    '@media (prefers-reduced-motion:no-preference){.invitation{animation:apparaitre .3s ease-out}}',
    '@keyframes apparaitre{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.panneau{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:900;width:min(390px,calc(100vw - 16px));height:min(580px,calc(100dvh - 32px));display:flex;flex-direction:column;background:#fff;color:#181414;border:1px solid #e6e6e6;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.16);overflow:hidden;font-size:15px;line-height:1.5}',
    '@media (max-width:420px){.panneau{right:8px;bottom:calc(8px + env(safe-area-inset-bottom));height:calc(100dvh - 16px)}}',
    'header{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;background:#fff;border-bottom:1px solid #e6e6e6}',
    'header .titre{font-family:var(--md-serif);font-size:19px;font-weight:400;color:#000;letter-spacing:.005em}',
    'header .outils{margin-left:auto;display:flex;align-items:center;gap:2px}',
    '.fermer,.agrandir,.nouvelle{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#6b6b6b;padding:4px 8px;border-radius:4px}',
    '.fermer{font-size:22px}',
    '.fermer:hover,.agrandir:hover,.nouvelle:hover,.fermer:focus-visible,.agrandir:focus-visible,.nouvelle:focus-visible{background:#f2f2f2;color:#000}',
    // P3 (5) : agrandi sur ordinateur, ≈ 720 px de large et 85 % de la hauteur ; téléphone : déjà plein écran.
    '.panneau.grand{width:min(720px,calc(100vw - 32px));height:85vh;bottom:7.5vh}',
    '@media (max-width:420px){.agrandir{display:none}}',
    // Cartes bouteille : blanches, filet gris fin ; la première (« Notre suggestion ») se distingue par un filet noir.
    '.reponse{margin:10px 0;margin-right:4%}',
    '.reponse .texte{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0;padding:0 2px;background:none;border:0}',
    '.reponse .texte a{color:#000}',
    '.carte{background:#fff;border:1px solid #e6e6e6;border-radius:4px;padding:12px 14px;margin:10px 0}',
    '.carte.premiere{border-color:#000;box-shadow:0 0 0 1px #000 inset}',
    '.carte .suggestion{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#000;margin-bottom:4px}',
    '.carte .ligne{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
    '.carte .nom{font-family:var(--md-serif);font-weight:400;font-size:17px;line-height:1.3;color:#000;overflow-wrap:anywhere}',
    '.carte .prix{flex:none;text-align:right;font-weight:500;font-size:16px;color:#000;white-space:nowrap}',
    '.carte .prix small{display:block;font-weight:400;font-size:11px;color:#6b6b6b}',
    '.carte .faits{font-size:13px;color:#6b6b6b;margin-top:3px}',
    '.carte .phrase{margin:8px 0 0;font-size:14px;line-height:1.5;color:#181414}',
    '.carte .bas{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}',
    '.carte .etiquette,.carte .rare{display:inline-block;font-size:12px;border-radius:100px;padding:3px 10px;background:#f2f2f2;color:#000;font-weight:500}',
    '.carte .rare{background:#fff;border:1px solid #000}',
    '.carte a.voir{display:inline-block;font-size:13px;font-weight:400;border-radius:var(--md-rayon);padding:7px 14px;background:#000;color:#fff;text-decoration:none}',
    '.carte a.voir:hover,.carte a.voir:focus-visible{background:#333}',
    // P4 (3) : cartes « boutique » — appeler ou écrire à la boutique (boutons discrets).
    '.carte .agir{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.carte .agir a{display:inline-block;font-size:13px;border-radius:var(--md-rayon);padding:6px 12px;background:#fff;color:#000;border:1px solid #e6e6e6;text-decoration:none}',
    '.carte .agir a:hover,.carte .agir a:focus-visible{border-color:#000}',
    '@media (max-width:420px){.numero{display:none}}',
    '.mention-boutique{font-size:12px;line-height:1.5;color:#6b6b6b;margin:4px 2px 8px}',
    '.sanitaire{font-size:11px;color:#6b6b6b;margin:2px 2px 10px}',
    '.fil{flex:1;overflow-y:auto;padding:12px 14px;background:#fff}',
    '.msg{margin:8px 0;padding:9px 13px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.client{background:#000;color:#fff;margin-left:14%}',
    '.conseiller{background:#fff;border:1px solid #e6e6e6;margin-right:4%}',
    '.conseiller a{color:#000}',
    '.suggestions{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
    '.suggestions button{border:1px solid #e6e6e6;background:#fff;color:#000;border-radius:var(--md-rayon);padding:7px 12px;font-size:14px;line-height:1.2;cursor:pointer}',
    '.suggestions button:hover,.suggestions button:focus-visible{border-color:#000}',
    '@media (max-width:420px){.suggestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.suggestions button{padding:7px 6px;font-size:13px}}',
    '.attente{color:#6b6b6b;font-style:italic;display:flex;align-items:center;gap:10px}',
    '.points{display:inline-flex;gap:4px;flex:none}',
    '.points i{width:6px;height:6px;border-radius:50%;background:#000;opacity:.25;animation:pulse 1.2s infinite ease-in-out}',
    '.points i:nth-child(2){animation-delay:.2s}.points i:nth-child(3){animation-delay:.4s}',
    '@keyframes pulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.points i{animation:none;opacity:.6}.lanceur{transition:none}}',
    'form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e6e6e6;background:#fff}',
    'input{flex:1;min-width:0;padding:10px 12px;border:1px solid #e6e6e6;border-radius:4px;font-size:16px;color:#181414;background:#fff}',
    'input:focus{outline:none;border-color:#000}',
    'button.envoyer{border:0;border-radius:var(--md-rayon);padding:10px 16px;background:#000;color:#fff;font-size:15px;cursor:pointer}',
    'button.envoyer:hover{background:#333}',
    'button.envoyer:disabled{opacity:.5}',
  ].join('\n');

  // P4 (2a) : polices et coins réellement utilisés par la page (variables CSS du thème Horizon, sinon style calculé du texte,
  // du menu ou d'un titre, et du bouton « Ajouter au panier ») ; valeur absente ou douteuse → repli.
  var POLICE_SURE = /^[\w\s"',.\-]{1,200}$/;
  var RAYON_SUR = /^\d{1,2}(?:\.\d+)?px$/;
  var REPLI = { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', rayon: '14px' };
  function styleCalcule(e) { try { return e && w.getComputedStyle ? w.getComputedStyle(e) : null; } catch (x) { return null; } }
  function sure(v, rx) { v = String(v || '').trim(); return rx.test(v) ? v : ''; }
  function policesDuSite() {
    var racine = styleCalcule(d.documentElement);
    var variable = function (k) { return racine && racine.getPropertyValue ? racine.getPropertyValue(k) : ''; };
    var police = function (sel) { var e = chercher(sel)[0]; var s = styleCalcule(e); return s ? s.fontFamily : ''; };
    var corps = styleCalcule(d.body);
    var sans = sure(variable('--font-body--family'), POLICE_SURE) || sure(corps && corps.fontFamily, POLICE_SURE);
    var serif = sure(variable('--font-heading--family'), POLICE_SURE) || sure(police('header nav a, nav a, .header__menu-item, h1, h2'), POLICE_SURE);
    if (serif && serif === sans) serif = '';
    var bouton = styleCalcule(chercher(BOUTON_PANIER)[0]);
    var rayon = sure(variable('--style-border-radius-buttons-primary'), RAYON_SUR) || sure(bouton && bouton.borderRadius, RAYON_SUR);
    if (rayon && parseFloat(rayon) > 40) rayon = '';
    return { serif: serif || REPLI.serif, sans: sans || REPLI.sans, rayon: rayon || REPLI.rayon };
  }
  function cssAvecPolices() {
    var p = policesDuSite();
    return ':host{all:initial;--md-serif:' + p.serif + ';--md-sans:' + p.sans + ';--md-rayon:' + p.rayon + '}\n' + CSS;
  }

  // P4 (3) : coordonnées de la boutique pour les cartes « En boutique uniquement » (informations publiques de la boutique).
  var TEL = '+33556930604', TEL_AFFICHE = '05 56 93 06 04', COURRIEL = 'contact@maisondesire.com';
  function lienCourriel(c) {
    var nom = String(c.nom || '');
    var corps = 'Bonjour, la bouteille ' + nom + ' (' + String(c.prix || '') + ', prix indicatif) est-elle disponible en boutique ? Je souhaiterais la faire mettre de côté. Merci.';
    return 'mailto:' + COURRIEL + '?subject=' + encodeURIComponent('Demande : ' + nom) + '&body=' + encodeURIComponent(corps);
  }

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
    // P3 (1) : « La cave à conseils » + « IA » (toujours visible, obligation d'information) ; « Conseils » sur téléphone.
    var lanceur = el('button', { classe: 'lanceur', type: 'button', 'aria-label': NOM + ', conseiller virtuel (IA)' }, [
      icone, el('span', { classe: 'long', texte: NOM }), el('span', { classe: 'court', texte: 'Conseils' }),
      el('span', { classe: 'ia', texte: 'IA' })]);
    var texteInvitation = el('p', { texte: texteInvitationCourant() });
    var croix = el('button', { classe: 'croix', type: 'button', 'aria-label': 'Fermer l\'invitation', texte: '×' });
    var invitation = el('div', { classe: 'invitation', role: 'status' }, [texteInvitation, croix]);
    invitation.hidden = true;
    var fil = el('div', { classe: 'fil', 'aria-live': 'polite' });
    var suggestions = el('div', { classe: 'suggestions' });
    var champ = el('input', { maxlength: '1000', autocomplete: 'off', placeholder: 'Votre question…', 'aria-label': 'Votre question' });
    var bouton = el('button', { classe: 'envoyer', type: 'submit', texte: 'Envoyer' });
    var form = el('form', {}, [champ, bouton]);
    var fermer = el('button', { classe: 'fermer', type: 'button', 'aria-label': 'Fermer', texte: '×' });
    // P3 (5) : agrandir / réduire (ordinateur) et nouvelle conversation.
    var agrandir = el('button', { classe: 'agrandir', type: 'button', 'aria-label': 'Agrandir', 'aria-pressed': 'false', title: 'Agrandir', texte: '⤢' });
    var nouvelle = el('button', { classe: 'nouvelle', type: 'button', 'aria-label': 'Nouvelle conversation', title: 'Nouvelle conversation', texte: '↺' });
    var panneau = el('section', { classe: 'panneau', role: 'dialog', 'aria-label': NOM + ' (IA)' }, [
      el('header', {}, [el('strong', { classe: 'titre', texte: NOM }), el('span', { classe: 'ia', texte: 'IA' }),
        el('span', { classe: 'outils' }, [nouvelle, agrandir, fermer])]), fil, form]);
    panneau.hidden = true;
    [el('style', { texte: cssAvecPolices() }), lanceur, invitation, panneau].forEach(function (e) { racine.appendChild(e); });

    var fiche = adresseFiche(chemin());
    var lienFiche = null;

    function bulle(classe, html) {
      var m = el('div', { classe: 'msg ' + classe }); m.innerHTML = html; fil.appendChild(m);
      fil.scrollTop = fil.scrollHeight; return m;
    }
    // P3 (2) : réponse en blocs — texte, cartes bouteille (construites élément par élément, jamais de HTML venu de la
    // fonction), mention de la boutique, puis la mention sanitaire.
    function carte(c) {
      var haut = [];
      if (c.suggestion) haut.push(el('span', { classe: 'suggestion', texte: 'Notre suggestion' }));
      var prix = el('span', { classe: 'prix', texte: String(c.prix || '') });
      if (c.indicatif) prix.appendChild(el('small', { texte: 'prix indicatif' }));
      var bas = [];
      if (c.boutique) bas.push(el('span', { classe: 'etiquette', texte: 'En boutique uniquement' }));
      else if (c.url && new RegExp('^' + BOUTIQUE + '$').test(c.url)) bas.push(el('a', { classe: 'voir', href: c.url, texte: 'Voir la bouteille' }));
      if (c.rare) bas.push(el('span', { classe: 'rare', texte: 'Pièce rare' }));
      var enfants = haut.concat([el('div', { classe: 'ligne' }, [el('span', { classe: 'nom', texte: String(c.nom || '') }), prix])]);
      if (c.faits) enfants.push(el('div', { classe: 'faits', texte: String(c.faits) }));
      if (c.phrase) enfants.push(el('p', { classe: 'phrase', texte: insecable(c.phrase) }));
      if (bas.length) enfants.push(el('div', { classe: 'bas' }, bas));
      // P4 (3) : appeler ou écrire à la boutique, sur les cartes « boutique » seulement (numéro en clair sur ordinateur).
      if (c.boutique) {
        var appeler = el('a', { classe: 'appeler', href: 'tel:' + TEL }, [el('span', { texte: 'Appeler la boutique' }), el('span', { classe: 'numero', texte: insecable(' · ' + TEL_AFFICHE) })]);
        enfants.push(el('div', { classe: 'agir' }, [appeler, el('a', { classe: 'courriel', href: lienCourriel(c), texte: 'Demander par e-mail' })]));
      }
      return el('div', { classe: 'carte' + (c.suggestion ? ' premiere' : '') }, enfants);
    }
    function rendreBlocs(conteneur, blocs, sanitaire) {
      conteneur.className = 'reponse';
      conteneur.textContent = '';
      blocs.forEach(function (b) {
        if (!b) return;
        if (b.type === 'cartes' && Array.isArray(b.cartes)) b.cartes.forEach(function (c) { conteneur.appendChild(carte(c)); });
        else if (b.type === 'mention') conteneur.appendChild(el('p', { classe: 'mention-boutique', texte: insecable(b.texte || '') }));
        else if (b.type === 'texte') { var t = el('div', { classe: 'msg texte' }); t.innerHTML = lier(insecable(b.texte || '')); conteneur.appendChild(t); }
      });
      conteneur.appendChild(el('p', { classe: 'sanitaire', texte: sanitaire || MENTION_SANITAIRE }));
      return conteneur;
    }
    function afficherReponse(conteneur, r) {
      if (r.blocs && r.blocs.length) rendreBlocs(conteneur, r.blocs, r.sanitaire);
      else { conteneur.className = 'msg conseiller'; conteneur.innerHTML = lier(r.texte); }
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
      lienFiche.style.color = 'inherit'; lienFiche.style.textDecoration = 'underline'; lienFiche.style.cursor = 'pointer';
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

    function accueillir() {
      bulle('conseiller', echapper(texteAccueil()));
      etat.fil.forEach(function (m) {
        if (m.qui === 'client') bulle('client', echapper(m.texte));
        else afficherReponse(bulle('conseiller', ''), m);
      });
      if (!etat.fil.length) proposer(SUGGESTIONS, false);
    }
    accueillir();
    lanceur.addEventListener('click', function () { ouvrir(true); });
    fermer.addEventListener('click', function () { ouvrir(false); });
    // Taille gardée pendant la visite (onglet), comme le fil.
    function taille(grand) {
      panneau.className = grand ? 'panneau grand' : 'panneau';
      agrandir.setAttribute('aria-pressed', grand ? 'true' : 'false');
      agrandir.setAttribute('aria-label', grand ? 'Réduire' : 'Agrandir');
      agrandir.setAttribute('title', grand ? 'Réduire' : 'Agrandir');
      fil.scrollTop = fil.scrollHeight;
    }
    taille(!!etat.grand);
    agrandir.addEventListener('click', function () {
      etat.grand = !/\bgrand\b/.test(panneau.className); ecrire(etat);
      taille(etat.grand);
    });
    // Nouvelle conversation : nouvel identifiant (la fonction repart d'une fiche de suivi vide), fil effacé, accueil et
    // suggestions réaffichés. L'invitation déjà vue le reste.
    nouvelle.addEventListener('click', function () {
      if (bouton.disabled) return;
      etat = { session: uuid(), fil: [], ouvert: true, invitation: etat.invitation, grand: etat.grand };
      ecrire(etat);
      fil.textContent = '';
      accueillir();
      champ.focus();
    });
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
      var session = etat.session;
      return envoyerComplet(message, ficheEnvoyee).then(function (r) {
        if (session !== etat.session) { attente.remove(); return; } // nouvelle conversation entre-temps
        afficherReponse(attente, r);
        etat.fil.push(r.blocs ? { qui: 'conseiller', texte: r.texte, blocs: r.blocs, sanitaire: r.sanitaire } : { qui: 'conseiller', texte: r.texte });
        etat.fil = etat.fil.slice(-40); ecrire(etat);
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
  // P3 : la réponse complète (texte de secours avec la mention sanitaire, blocs avec les cartes, mention sanitaire).
  function envoyerComplet(message, fiche) {
    var corps = { session: etat.session, message: message };
    if (fiche) corps.fiche = fiche;
    return w.fetch(ADRESSE, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit', body: JSON.stringify(corps) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (s) {
          if (!r.ok || !s.texte_affiche) return { texte: ERREUR_TECHNIQUE };
          var blocs = Array.isArray(s.blocs) && s.blocs.length ? s.blocs : null;
          return blocs ? { texte: s.texte_affiche, blocs: blocs, sanitaire: s.message_sanitaire || MENTION_SANITAIRE } : { texte: s.texte_affiche };
        });
      })
      .catch(function () { return { texte: ERREUR_TECHNIQUE }; });
  }
  function envoyer(message, fiche) { return envoyerComplet(message, fiche).then(function (r) { return r.texte; }); }

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
      .then(function (s) {
        clearTimeout(minuterie);
        if (fini || !s || s.actif !== true || !d.body) return;
        var nb = s.nombres;
        if (nb && typeof nb.total === 'number' && isFinite(nb.total) && nb.total > 0) nombres = { total: Math.floor(nb.total) };
        monter();
      })
      .catch(function () { clearTimeout(minuterie); });
  }

  if (w.__CONSEILLER_TEST__) w.__CONSEILLER_TEST__ = { lier: lier, envoyer: envoyer, etat: function () { return etat; } };
  demarrer();
})(window, document);

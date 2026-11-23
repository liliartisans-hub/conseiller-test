/* La cave à conseils (IA) de la cave Maison Désiré — bulle du site (P1, P2 « une bulle qui donne envie », P3 cartes bouteille).
 * Fichier autonome, chargé dans le thème par : <script src="https://liliartisans-hub.github.io/conseiller-test/bulle/conseiller.js" defer></script>
 * AUCUNE clé ni code d'accès ici : seulement l'adresse publique de la fonction. Aucun cookie : l'identifiant de conversation,
 * le fil et l'invitation déjà vue restent dans l'onglet (sessionStorage), effacés à sa fermeture. Si le conseiller est éteint
 * ou ne répond pas, rien ne s'affiche. Styles isolés (Shadow DOM) ; seul ajout dans la page : un lien discret sous
 * « Ajouter au panier » d'une fiche bouteille, et seulement si ce bouton est trouvé. La bulle s'efface tant qu'une fenêtre
 * de vérification de l'âge est visible. P10 : après un clic vers une fiche bouteille, le panier Shopify reçoit l'attribut
 * « conseiller : oui » (requête de la boutique elle-même, cookie du panier géré par le navigateur, jamais lu ici) et la fonction
 * compte le clic (handle seul). */
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
    ' [id*="age-gate" i], [class*="age-gate" i], [id*="agegate" i], [class*="agegate" i], [id*="age-check" i], [class*="age-check" i],' +
    // P8 : application de vérification de l'âge du site www.maisondesire.com (fenêtre « Veuillez confirmer… », classes agp__…).
    ' [class*="agp__wrapper" i]';
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

  // P10 · Mesure, sans donnée personnelle ni texte de conversation, et seulement sur la boutique (jamais sur la page de test) :
  // (1) attribut de panier Shopify « conseiller : oui » (visible sur la commande) après un clic vers une fiche bouteille ;
  //     renvoyé une fois à la page suivante si la réponse n'est pas arrivée (la page a changé avant), puis plus jamais ;
  // (2) clic compté par la fonction : le handle de la bouteille, rien d'autre (ni session, ni texte). Envois « keepalive » :
  //     ils partent même si la page de la fiche s'ouvre aussitôt ; texte brut, sans cookie : aucune requête préalable.
  var FICHE_SITE = /^https:\/\/(?:www\.)?maisondesire\.com\/products\/([a-z0-9][a-z0-9-]*)\/?$/i;
  function surLaBoutique() {
    var h = String((w.location && w.location.hostname) || '').toLowerCase();
    return /(^|\.)maisondesire\.com$/.test(h) || /\.myshopify\.com$/.test(h);
  }
  function marquerPanier() {
    if (!surLaBoutique()) return;
    try {
      w.fetch('/cart/update.js', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attributes: { conseiller: 'oui' } }) })
        .then(function (r) { if (r && r.ok && etat.panier === 'a_marquer') { etat.panier = 'marque'; ecrire(etat); } }, function () {});
    } catch (e) { /* panier indisponible : rien ne change pour le client */ }
  }
  function compterClic(handle) {
    if (!surLaBoutique()) return;
    try {
      w.fetch(ADRESSE, { method: 'POST', keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ clic: handle }) })
        .then(null, function () {});
    } catch (e) { /* comptage seulement */ }
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
    '.lanceur{position:fixed;right:calc(16px + var(--md-dx,0px));bottom:calc(16px + var(--md-barre,0px) + var(--md-dy,0px) + env(safe-area-inset-bottom));z-index:900;display:flex;align-items:center;gap:10px;border:0;border-radius:var(--md-rayon);padding:12px 16px 12px 14px;background:#000;color:#fff;font-size:15px;font-weight:400;line-height:1.1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:background .15s ease}',
    '.lanceur:hover,.lanceur:focus-visible{background:#333}',
    '.lanceur:focus-visible{outline:2px solid #000;outline-offset:3px}',
    '.lanceur .long,.lanceur .court{font-family:var(--md-serif);font-size:16px;letter-spacing:.01em}',
    '.icone{display:inline-flex;flex:none}',
    '.ia{flex:none;background:#f2f2f2;color:#000;font-size:11px;font-weight:600;letter-spacing:.06em;border-radius:4px;padding:3px 6px;font-family:var(--md-sans)}',
    '.court{display:none}',
    // P7 : « Reprendre la conversation » (après « Voir la bouteille ») avec une petite pastille, sur téléphone comme sur ordinateur.
    '.lanceur .reprendre{font-family:var(--md-serif);font-size:16px;letter-spacing:.01em;white-space:nowrap}',
    '.lanceur .pastille{flex:none;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px #000}',
    '@media (max-width:420px){.long{display:none}.court{display:inline}.lanceur{right:calc(12px + var(--md-dx,0px));padding:10px 14px 10px 12px;gap:8px}}',
    // P8 : téléphone reconnu d'après l'écran visible (Chrome Android élargit la page quand le site déborde : la règle de largeur
    // ci-dessus ne s'applique alors plus) ; mêmes réglages sous :host(.tel).
    ':host(.tel) .long{display:none}', ':host(.tel) .court{display:inline}',
    ':host(.tel) .lanceur{right:calc(12px + var(--md-dx,0px));padding:10px 14px 10px 12px;gap:8px}',
    '.invitation{position:fixed;right:calc(16px + var(--md-dx,0px));bottom:calc(84px + var(--md-barre,0px) + var(--md-dy,0px) + env(safe-area-inset-bottom));z-index:900;width:min(280px,calc(var(--md-vw,100vw) - 32px));background:#fff;color:#181414;border:1px solid #e6e6e6;border-radius:4px;padding:12px 34px 12px 14px;font-size:15px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.12)}',
    '.invitation p{margin:0;cursor:pointer}',
    '.invitation:after{content:"";position:absolute;right:28px;bottom:-7px;width:12px;height:12px;background:#fff;border-right:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;transform:rotate(45deg)}',
    '.croix{position:absolute;top:4px;right:4px;border:0;background:none;font-size:20px;line-height:1;color:#6b6b6b;cursor:pointer;padding:4px 8px}',
    '@media (prefers-reduced-motion:no-preference){.invitation{animation:apparaitre .3s ease-out}}',
    '@keyframes apparaitre{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.panneau{position:fixed;right:calc(16px + var(--md-dx,0px));bottom:calc(16px + var(--md-dy,0px) + env(safe-area-inset-bottom));z-index:900;width:min(390px,calc(var(--md-vw,100vw) - 16px));height:min(580px,calc(var(--md-vh,100dvh) - 32px));display:flex;flex-direction:column;background:#fff;color:#181414;border:1px solid #e6e6e6;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.16);overflow:hidden;font-size:15px;line-height:1.5}',
    '@media (max-width:420px){.panneau{right:calc(8px + var(--md-dx,0px));bottom:calc(8px + var(--md-dy,0px) + env(safe-area-inset-bottom));height:calc(var(--md-vh,100dvh) - 16px)}}',
    ':host(.tel) .panneau{right:calc(8px + var(--md-dx,0px));bottom:calc(8px + var(--md-dy,0px) + env(safe-area-inset-bottom));width:calc(var(--md-vw,100vw) - 16px);height:calc(var(--md-vh,100dvh) - 16px)}',
    'header{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;background:#fff;border-bottom:1px solid #e6e6e6}',
    'header .titre{font-family:var(--md-serif);font-size:19px;font-weight:400;color:#000;letter-spacing:.005em}',
    'header .outils{margin-left:auto;display:flex;align-items:center;gap:2px}',
    '.fermer,.agrandir,.nouvelle{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#6b6b6b;padding:4px 8px;border-radius:4px}',
    '.fermer{font-size:22px}',
    '.fermer:hover,.agrandir:hover,.nouvelle:hover,.fermer:focus-visible,.agrandir:focus-visible,.nouvelle:focus-visible{background:#f2f2f2;color:#000}',
    // P3 (5) : agrandi sur ordinateur, ≈ 720 px de large et 85 % de la hauteur ; téléphone : déjà plein écran.
    '.panneau.grand{width:min(720px,calc(var(--md-vw,100vw) - 32px));height:calc(var(--md-vh,100vh) * .85);bottom:calc(var(--md-vh,100vh) * .075 + var(--md-dy,0px))}',
    '@media (max-width:420px){.agrandir{display:none}}', ':host(.tel) .agrandir{display:none}',
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
    '.carte .bas{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;margin-top:10px;white-space:nowrap}',
    '.carte .etiquette{display:inline-block;font-size:12px;border-radius:100px;padding:3px 10px;background:#f2f2f2;color:#000;font-weight:500}',
    '.carte a.voir{display:inline-block;font-size:13px;font-weight:400;border-radius:var(--md-rayon);padding:7px 14px;background:#000;color:#fff;text-decoration:none}',
    '.carte a.voir:hover,.carte a.voir:focus-visible{background:#333}',
    // P6 : « Appeler » et « E-mail » : petits liens discrets, sur la ligne de l'étiquette (jamais de gros boutons).
    '.carte .bas a.appeler,.carte .bas a.courriel{font-size:12px;color:#6b6b6b;text-decoration:underline;text-underline-offset:2px;padding:2px 0;background:none;border:0}',
    '.carte .bas a.appeler:hover,.carte .bas a.courriel:hover,.carte .bas a.appeler:focus-visible,.carte .bas a.courriel:focus-visible{color:#000}',
    '.mention-boutique{font-size:12px;line-height:1.5;color:#6b6b6b;margin:4px 2px 8px}',
    '.sanitaire{font-size:11px;color:#6b6b6b;margin:2px 2px 10px}',
    '.fil{flex:1;overflow-y:auto;padding:12px 14px;background:#fff;position:relative}',
    // P9 : flèche « ↓ » discrète quand il reste du contenu en dessous (au-dessus de la zone de saisie).
    '.descendre{position:absolute;right:16px;bottom:72px;width:32px;height:32px;border-radius:50%;border:1px solid #e6e6e6;background:#fff;color:#000;font-size:16px;line-height:1;padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:1;opacity:.9}',
    '.descendre:hover,.descendre:focus-visible{border-color:#000;opacity:1}',
    '.msg{margin:8px 0;padding:9px 13px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.client{background:#000;color:#fff;margin-left:14%}',
    '.conseiller{background:#fff;border:1px solid #e6e6e6;margin-right:4%}',
    '.conseiller a{color:#000}',
    '.suggestions{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
    '.suggestions button{border:1px solid #e6e6e6;background:#fff;color:#000;border-radius:var(--md-rayon);padding:7px 12px;font-size:14px;line-height:1.2;cursor:pointer}',
    '.suggestions button:hover,.suggestions button:focus-visible{border-color:#000}',
    '@media (max-width:420px){.suggestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.suggestions button{padding:7px 6px;font-size:13px}}',
    ':host(.tel) .suggestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}', ':host(.tel) .suggestions button{padding:7px 6px;font-size:13px}',
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
    // P8 : l'hôte ne prend aucune place dans la page du site, quels que soient les styles du thème (tout est fixé dedans).
    ['width', 'height', 'margin', 'padding', 'border'].forEach(function (k) { hote.style[k] = '0'; });
    hote.style.overflow = 'visible';
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
    // P9 : flèche « ↓ » (fin de l'échange).
    var descendre = el('button', { classe: 'descendre', type: 'button', 'aria-label': 'Aller à la fin de la réponse', title: 'Aller en bas', texte: '↓' });
    descendre.hidden = true;
    panneau.appendChild(descendre);
    [el('style', { texte: cssAvecPolices() }), lanceur, invitation, panneau].forEach(function (e) { racine.appendChild(e); });

    var fiche = adresseFiche(chemin());
    var lienFiche = null;

    // P9 — Défilement. enBas() : la fin de l'échange ; placerReponse() : le message du client en haut du panneau et le début de
    // la réponse juste en dessous (le début de la réponse en haut si le message est long) ; flèche « ↓ » tenue à jour.
    function maxDefilement() { return Math.max(0, fil.scrollHeight - fil.clientHeight); }
    function majFleche() { descendre.hidden = !(maxDefilement() - fil.scrollTop > 24); }
    function defiler(v) { fil.scrollTop = Math.max(0, Math.min(v, maxDefilement())); majFleche(); return fil.scrollTop; }
    function enBas() { return defiler(maxDefilement()); }
    function placerReponse(reponseEl, clientEl) {
      var cible = reponseEl.offsetTop - 8;
      if (clientEl && cible - (clientEl.offsetTop - 8) <= fil.clientHeight * 0.45) cible = clientEl.offsetTop - 8;
      return defiler(cible);
    }
    fil.addEventListener('scroll', majFleche);
    descendre.addEventListener('click', function () { enBas(); });
    function bulle(classe, html) {
      var m = el('div', { classe: 'msg ' + classe }); m.innerHTML = html; fil.appendChild(m);
      enBas(); return m;
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
      // P12 bis : aucune étiquette de stock (stock Shopify non synchronisé avec la boutique), même si une ancienne réponse en portait.
      // P4 (3) → P6 : appeler ou écrire à la boutique, cartes « boutique » seulement : deux petits liens discrets sur la même
      // ligne que l'étiquette « En boutique uniquement » (libellé complet pour les lecteurs d'écran).
      if (c.boutique) {
        bas.push(el('a', { classe: 'appeler', href: 'tel:' + TEL, 'aria-label': 'Appeler la boutique au ' + TEL_AFFICHE, texte: 'Appeler' }));
        bas.push(el('a', { classe: 'courriel', href: lienCourriel(c), 'aria-label': 'Demander à la boutique par e-mail', texte: 'E-mail' }));
      }
      var enfants = haut.concat([el('div', { classe: 'ligne' }, [el('span', { classe: 'nom', texte: String(c.nom || '') }), prix])]);
      if (c.faits) enfants.push(el('div', { classe: 'faits', texte: String(c.faits) }));
      if (c.phrase) enfants.push(el('p', { classe: 'phrase', texte: insecable(c.phrase) }));
      if (bas.length) enfants.push(el('div', { classe: 'bas' }, bas));
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
      enBas();
    }
    // P7 : lanceur « Reprendre la conversation » + pastille tant que le panneau a été replié par un lien vers une page du site.
    var reprendre = null, pastille = null;
    function majLanceur() {
      var oui = !!etat.reprendre && etat.fil.length > 0;
      if (oui && !reprendre) {
        reprendre = el('span', { classe: 'reprendre', texte: 'Reprendre la conversation' });
        pastille = el('span', { classe: 'pastille', 'aria-hidden': 'true' });
        lanceur.insertBefore(reprendre, lanceur.children[1]);
        lanceur.appendChild(pastille);
      } else if (!oui && reprendre) { reprendre.remove(); pastille.remove(); reprendre = pastille = null; }
      Array.prototype.forEach.call(lanceur.children, function (c) { if (/\b(long|court)\b/.test(c.className)) c.hidden = oui; });
      lanceur.setAttribute('aria-label', oui ? 'Reprendre la conversation, ' + NOM + ' (IA)' : NOM + ', conseiller virtuel (IA)');
    }
    function ouvrir(oui) {
      var revenir = oui && etat.reprendre && typeof etat.defilement === 'number' ? etat.defilement : null;
      if (oui) { etat.reprendre = false; delete etat.defilement; }
      etat.ouvert = oui; ecrire(etat);
      panneau.hidden = !oui; lanceur.hidden = oui;
      majLanceur();
      // P7 : rouvert après un repli → même position de défilement ; sinon, en bas de l'échange.
      if (oui) { cacherInvitation(); if (revenir != null) defiler(revenir); else enBas(); champ.focus(); }
    }
    // P7 : un lien vers une page du site (« Voir la bouteille », lien d'une réponse) replie le panneau AVANT que la page s'ouvre :
    // la page de la bouteille s'affiche normalement, la conversation reste dans l'onglet (même session) et le panneau ne se
    // rouvre jamais tout seul. Jamais pour « Appeler », « E-mail », un lien ouvert ailleurs ou un clic avec Ctrl / Maj.
    function lienDuSite(a) {
      var h = String(a.getAttribute('href') || '');
      var cible = a.getAttribute('target');
      if (cible && cible !== '_self') return false;
      return /^https:\/\/(?:www\.)?maisondesire\.com\//i.test(h) || /^\/(?!\/)/.test(h);
    }
    function replier() {
      etat.defilement = fil.scrollTop; etat.reprendre = true;
      ouvrir(false);
    }
    panneau.addEventListener('click', function (e) {
      if (!e || e.defaultPrevented || (e.button && e.button !== 0) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a && lienDuSite(a)) replier();
    });
    // P10 : clic vers une fiche bouteille (carte « Voir la bouteille » ou lien d'une réponse), même avec Ctrl : le clic est
    // compté (handle seul) et le panier marqué « conseiller ».
    panneau.addEventListener('click', function (e) {
      var a = e && e.target && e.target.closest ? e.target.closest('a[href]') : null;
      var m = a ? FICHE_SITE.exec(String(a.getAttribute('href') || '')) : null;
      if (!m) return;
      compterClic(m[1].toLowerCase());
      etat.panier = 'a_marquer'; ecrire(etat);
      marquerPanier();
    });
    function cacherInvitation() { invitation.hidden = true; }
    // P8 : la bulle se cale sur l'écran VISIBLE. Sur Chrome Android, une page du site plus large que l'écran élargit la zone de
    // référence des éléments fixés : sans ce calage, le bouton partait hors de l'écran (visible seulement en dézoomant).
    // --md-dx / --md-dy : écart entre le bord droit / bas de cette zone et celui de l'écran visible ; --md-vw / --md-vh : taille
    // de l'écran visible ; --md-barre : barre « Ajouter au panier » collée en bas. Classe « tel » : écran de téléphone.
    var variables = {};
    function poser(nom, valeur) {
      if (variables[nom] === valeur) return;
      variables[nom] = valeur;
      if (hote.style.setProperty) { if (valeur == null) hote.style.removeProperty(nom); else hote.style.setProperty(nom, valeur); } else hote.style[nom] = valeur;
    }
    function placer() {
      var h = hauteurBarreCollante();
      poser('--md-barre', h ? h + 'px' : null);
      var vv = w.visualViewport;
      if (!vv || !vv.width) return;
      poser('--md-dx', Math.max(0, Math.round((w.innerWidth || 0) - (vv.offsetLeft + vv.width))) + 'px');
      poser('--md-dy', Math.max(0, Math.round((w.innerHeight || 0) - (vv.offsetTop + vv.height))) + 'px');
      poser('--md-vw', Math.round(vv.width) + 'px');
      poser('--md-vh', Math.round(vv.height) + 'px');
      var tel = vv.width * (vv.scale || 1) <= 420;
      hote.className = tel ? 'tel' : '';
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
    fermer.addEventListener('click', function () { etat.reprendre = false; delete etat.defilement; ouvrir(false); });
    // Taille gardée pendant la visite (onglet), comme le fil.
    function taille(grand) {
      panneau.className = grand ? 'panneau grand' : 'panneau';
      agrandir.setAttribute('aria-pressed', grand ? 'true' : 'false');
      agrandir.setAttribute('aria-label', grand ? 'Réduire' : 'Agrandir');
      agrandir.setAttribute('title', grand ? 'Réduire' : 'Agrandir');
      enBas();
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
      var messageClient = bulle('client', echapper(message));
      etat.fil.push({ qui: 'client', texte: message }); ecrire(etat);
      // E14 : bulle d'attente écrite par la page, remplacée par la réponse vérifiée.
      var attente = bulle('conseiller attente', '<span class="points" aria-hidden="true"><i></i><i></i><i></i></span><span class="etat">Je regarde dans le catalogue…</span>');
      var relais = setTimeout(function () { var x = attente.querySelector('.etat'); if (x) x.textContent = 'Je compare quelques bouteilles pour vous…'; }, 4000);
      bouton.disabled = true;
      var session = etat.session;
      // P9 : position après l'envoi ; si le client fait défiler pendant l'attente, on ne déplace plus rien.
      var positionAuto = fil.scrollTop;
      function laisse() { return Math.abs(fil.scrollTop - positionAuto) <= 2; }
      function placer9() { if (laisse()) positionAuto = placerReponse(attente, messageClient); else majFleche(); }
      // P5 (1) : l'introduction (écrite par le code de la fonction, jamais par l'IA) s'affiche dès qu'elle arrive, l'animation
      // d'attente dessous ; la réponse vérifiée la remplace ensuite (elle commence par la même introduction).
      function surIntro(t) {
        if (session !== etat.session || !attente.parentNode) return;
        attente.className = 'reponse';
        attente.textContent = '';
        var m = el('div', { classe: 'msg texte' }); m.innerHTML = lier(insecable(t)); attente.appendChild(m);
        var a = el('div', { classe: 'msg conseiller attente' });
        a.innerHTML = '<span class="points" aria-hidden="true"><i></i><i></i><i></i></span><span class="etat">Je choisis les bouteilles…</span>';
        attente.appendChild(a);
        placer9();
      }
      return envoyerComplet(message, ficheEnvoyee, surIntro).then(function (r) {
        if (session !== etat.session) { attente.remove(); return; } // nouvelle conversation entre-temps
        afficherReponse(attente, r);
        // P9 : début de la réponse en haut (déjà fait à l'introduction : même position, rien ne bouge ; sinon fait maintenant).
        placer9();
        etat.fil.push(r.blocs ? { qui: 'conseiller', texte: r.texte, blocs: r.blocs, sanitaire: r.sanitaire } : { qui: 'conseiller', texte: r.texte });
        etat.fil = etat.fil.slice(-40); ecrire(etat);
      }).then(function () { clearTimeout(relais); bouton.disabled = false; majFleche(); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = champ.value.trim();
      if (!message || bouton.disabled) return;
      champ.value = '';
      envoyerMessage(message, null);
    });

    surInvitation = verifierInvitation;
    // P8 : recalage dès que l'écran visible bouge (zoom, défilement, clavier, rotation).
    if (w.visualViewport && w.visualViewport.addEventListener) { w.visualViewport.addEventListener('resize', placer); w.visualViewport.addEventListener('scroll', placer); }
    w.addEventListener('resize', placer);
    d.body.appendChild(hote);
    surveiller();
    setInterval(surveiller, 1000);
    // P7 : retour arrière du navigateur (page restaurée telle quelle, ou rechargée) : l'échange de l'onglet est relu, le panneau
    // reste replié avec « Reprendre la conversation » ; jamais rouvert tout seul.
    function auRetour() {
      var s = lire();
      if (s && typeof s.session === 'string' && Array.isArray(s.fil)) etat = s;
      etat.ouvert = false;
      if (etat.fil.length) etat.reprendre = true;
      ecrire(etat);
      fil.textContent = '';
      accueillir();
      ouvrir(false);
    }
    w.addEventListener('pageshow', function (e) { if (e && e.persisted) auRetour(); });
    if (retourArriere()) { etat.ouvert = false; if (etat.fil.length) etat.reprendre = true; }
    ouvrir(!!etat.ouvert);
  }

  // Envoi : jamais de code d'accès, jamais d'erreur technique affichée (message poli à la place).
  // P3 : la réponse complète (texte de secours avec la mention sanitaire, blocs avec les cartes, mention sanitaire).
  // P5 (1) : réponse en deux temps demandée (« flux ») : événements « intro » (texte du code) puis « fin » ({ statut, corps },
  // la réponse habituelle). Une fonction qui ne connaît pas le flux répond en JSON comme avant : lu comme avant.
  // Le flux est décodé par le décodeur UTF-8 du navigateur en mode « stream » (un caractère coupé entre deux morceaux est
  // gardé jusqu'au morceau suivant) ; sans lecteur de flux, la réponse est lue d'un bloc (r.text()).
  function lireFlux(r, surIntro) {
    var fin = null, reste = '';
    function bloc(b) {
      var donnees = b.split('\n').filter(function (x) { return x.indexOf('data:') === 0; }).map(function (x) { return x.slice(5).trim(); }).join('');
      if (!donnees) return;
      var o; try { o = JSON.parse(donnees); } catch (e) { return; }
      if (o && o.type === 'intro' && typeof o.texte === 'string') { if (surIntro) surIntro(o.texte); }
      else if (o && o.type === 'fin') fin = { statut: Number(o.statut) || 500, corps: o.corps || {} };
    }
    function consommer(t) { reste += t; var i; while ((i = reste.indexOf('\n\n')) >= 0) { bloc(reste.slice(0, i)); reste = reste.slice(i + 2); } }
    function resultat() { if (reste) { bloc(reste); reste = ''; } return fin || { statut: 500, corps: {} }; }
    if (!(r.body && r.body.getReader && w.TextDecoder)) return r.text().then(function (t) { consommer(t); return resultat(); });
    var lecteur = r.body.getReader(), decodeur = new w.TextDecoder('utf-8');
    function suite() {
      return lecteur.read().then(function (x) {
        if (x.done) { consommer(decodeur.decode()); return resultat(); }
        consommer(decodeur.decode(x.value, { stream: true }));
        return suite();
      });
    }
    return suite();
  }
  function envoyerComplet(message, fiche, surIntro) {
    var corps = { session: etat.session, message: message, flux: true };
    if (fiche) corps.fiche = fiche;
    return w.fetch(ADRESSE, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit', body: JSON.stringify(corps) })
      .then(function (r) {
        var type = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
        var lecture = /event-stream/.test(type) ? lireFlux(r, surIntro)
          : r.json().catch(function () { return {}; }).then(function (s) { return { statut: r.ok ? 200 : (r.status || 500), corps: s }; });
        return lecture.then(function (f) {
          var s = f.corps || {};
          if (f.statut >= 400 || !s.texte_affiche) return { texte: ERREUR_TECHNIQUE };
          var blocs = Array.isArray(s.blocs) && s.blocs.length ? s.blocs : null;
          return blocs ? { texte: s.texte_affiche, blocs: blocs, sanitaire: s.message_sanitaire || MENTION_SANITAIRE } : { texte: s.texte_affiche };
        });
      })
      .catch(function () { return { texte: ERREUR_TECHNIQUE }; });
  }
  // P7 : page ouverte par le bouton « retour » du navigateur.
  function retourArriere() {
    try { var n = w.performance && w.performance.getEntriesByType && w.performance.getEntriesByType('navigation')[0]; return !!n && n.type === 'back_forward'; } catch (e) { return false; }
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
    if (etat.panier === 'a_marquer') marquerPanier(); // P10 : marquage pas encore confirmé (page changée avant la réponse)
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

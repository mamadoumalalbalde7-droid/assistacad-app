/**********************************************************************
 *  AssistAcad — EspacePlus2.gs  (module ADDITIF, mise à jour 18)
 *  Nécessite EspacePlus.gs (ses outils « ep… » sont réutilisés).
 *
 *  1. COMMISSIONS : déclaration avec le reçu du paiement intégral,
 *     vérifiée puis validée par l'administration, puis versée.
 *  2. OUTILS DE TRAVAIL v2 : accès par numéro de commande, rédaction
 *     enregistrée, brouillon organisé, catégories d'universités
 *     (russes, européennes, africaines), soumission du travail fini,
 *     « Mon dossier ».
 *  3. RÉVISION v2 : examen blanc noté sur 20, évolution, objectifs,
 *     plan de révision, mode « Mes erreurs », « Expliquer simplement »,
 *     rapport par e-mail et rappels quotidiens.
 *  Préfixe « ep2 ». Ne modifie aucune fonction existante.
 **********************************************************************/

var EP2 = {
  F_COMPREUVES: "CommissionsPreuves",
  F_REDAC: "OutilsRedactions", F_BROUILLON: "OutilsBrouillons", F_CMD: "OutilsCommandes", F_SOUMIS: "Soumissions",
  F_EXAMENS: "RevisionExamens", F_PROFILS: "RevisionProfils", F_FICHIERS: "OutilsFichiers", F_CHARTE: "ChartesAcceptations", F_AVENANTS: "ContratsAvenants",
  PREUVE_MAX_KO: 8000, SOUMIS_MAX_KO: 20000, REDAC_MAX: 1000000
};
var EP2_ENT = {
  COMPREUVES: ["ID", "Date", "Numero", "Client ID", "Client", "Email", "Identifiant", "Prenom filleul", "Fichier", "Drive ID", "Mime", "Statut", "Paiement integral constate", "Traite par", "Traite le", "Motif", "Versee le"],
  REDAC: ["Commande", "Employe ID", "Nom", "Drive ID", "Mots", "Objectif", "MAJ"],
  BROUILLON: ["Commande", "Employe ID", "Drive ID", "Elements", "MAJ"],
  CMD: ["Commande", "Categorie", "Etablissement", "Coches categorie", "MAJ", "Par"],
  SOUMIS: ["ID", "Date", "Commande", "Employe ID", "Nom", "Fichier", "Drive ID", "Mime", "Taille (Ko)", "Message", "Statut", "Traite par", "Traite le", "Remarque", "Origine", "Fichier dossier"],
  FICHIERS: ["ID", "Date", "Commande", "Employe ID", "Nom", "Fichier", "Drive ID", "Mime", "Taille (Ko)", "Format", "Origine", "Statut", "MAJ"],
  CHARTE: ["Date", "ID", "Nom", "Role", "Version", "Empreinte"],
  AVENANTS: ["ID", "Date", "Employe ID", "Nom", "Role", "Version", "Contrat", "Signature Drive ID", "Empreinte", "Statut"],
  EXAMENS: ["ID", "Client ID", "Cree le", "Modules", "Niveau", "Questions", "Duree (min)", "Statut", "Rendu le", "Note /20", "Points", "Total", "Detail", "Email"],
  PROFILS: ["Client ID", "Date examen", "Note visee", "Niveau", "Rappels", "Dernier rappel", "MAJ", "Essai debut", "Org alertes", "Org heure", "Org hebdo", "Org dernier envoi", "Org hebdo fait"]
};

// ════════════════════ 0. OUTILS ════════════════════
function ep2Num_(n) { return String(n == null ? "" : n).toUpperCase().replace(/\s+/g, "").slice(0, 40); }
function ep2Fichier_(b64, nom, max) {
  if (!b64 || typeof b64 !== "string") return null;
  var octets = Utilities.base64Decode(b64);
  if (octets.length > max * 1024) throw new Error("Fichier trop lourd (" + Math.round(max / 1000) + " Mo maximum).");
  return octets;
}
// Texte long (rédaction, brouillon) : un fichier Drive par commande et par personne
function ep2Ecrire_(cle, nomDossier, nomFichier, idExistant, contenu) {
  if (idExistant) { try { var f = DriveApp.getFileById(idExistant); f.setContent(contenu); return idExistant; } catch (e) {} }
  var dos = epDossier_(cle, nomDossier);
  return dos.createFile(nomFichier, contenu, "text/plain").getId();
}
function ep2Lire_(id) { if (!id) return ""; try { return DriveApp.getFileById(String(id)).getBlob().getDataAsString("UTF-8"); } catch (e) { return ""; } }
function ep2Mail_(to, sujet, html) {
  to = String(to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return false;
  try { if (MailApp.getRemainingDailyQuota() < 3) return false; MailApp.sendEmail({ to: to, name: "AssistAcad", subject: sujet, htmlBody: html, body: ep2Texte_(html) }); return true; } catch (e) { console.error("E-mail : " + e); return false; }
}
// Version texte d'un e-mail HTML : certaines messageries (et les aperçus) n'affichent que le texte
function ep2Texte_(html) {
  return String(html || "").replace(/<(br|\/p|\/h[1-6]|\/li|\/tr|\/?div|\/table)[^>]*>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<\/t[dh]>/gi, "  ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function ep2Gabarit_(titre, corps) {
  return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#11251C">' +
    '<div style="background:#0E2A1F;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0"><b style="font-size:18px">Assist<span style="color:#C9A227">Acad</span></b><div style="font-size:15px;margin-top:4px">' + epEsc_(titre) + '</div></div>' +
    '<div style="border:1px solid #DCE5D8;border-top:0;padding:20px 22px;border-radius:0 0 14px 14px;line-height:1.55">' + corps +
    '<p style="color:#4D6157;font-size:13px;margin-top:22px">AssistAcad · @acades_bot · lundi–vendredi, 8 h – 23 h</p></div></div>';
}
// Numéros uniques même si deux personnes enregistrent à la même seconde
function ep2Id_(prefixe) {
  var l = LockService.getScriptLock(), pris = false;
  try { l.waitLock(5000); pris = true; } catch (e) {}
  try { return epId_(prefixe); } finally { if (pris) { try { l.releaseLock(); } catch (e) {} } }
}
function ep2Membre_(id) { return epMembres_().filter(function (m) { return m.id === String(id); })[0] || null; }

// ════════════════════ 1. COMMISSIONS AVEC PREUVE ════════════════════

function ep2ComPret_() {
  return ["etatPaiement_", "commissionExistante_", "enregistrerCommission_", "majCellule_", "normNom_"].every(function (f) { return typeof globalThis[f] === "function"; }) && typeof F_COMMISSIONS !== "undefined";
}

// Le client déclare un parrainage APRÈS le paiement intégral de la personne parrainée,
// avec le reçu (capture ou PDF). L'administration vérifie, valide, puis verse.
function apiCliDeclarerPreuve(jeton, d, fichier) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  if (!ep2ComPret_()) return { ok: false, msg: "Le module commissions (MiseAJour3.gs) est introuvable : prévenez l’administration." };
  d = d || {};
  var num = ep2Num_(d.numero), ident = epTxt_(d.identifiant, 60), prenom = normNom_(d.prenom);
  if (!ident) return { ok: false, msg: "Indiquez votre identifiant de parrain." };
  if (!num) return { ok: false, msg: "Indiquez le numéro de commande de la personne parrainée." };
  if (prenom.length < 2) return { ok: false, msg: "Indiquez le prénom de la personne parrainée." };
  if (!fichier || !fichier.b64) return { ok: false, msg: "Joignez le reçu ou la capture du paiement intégral : sans preuve, la commission ne peut pas être validée." };
  if (!/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/i.test(String(fichier.mime || ""))) return { ok: false, msg: "Le reçu doit être une image (JPG, PNG) ou un PDF." };
  var c = CacheService.getScriptCache(), kl = "EP2DECL_" + s.id, n = Number(c.get(kl) || 0);
  if (n >= 5) return { ok: false, msg: "Trop de déclarations en peu de temps. Réessayez dans une heure." };
  c.put(kl, String(n + 1), 3600);
  var refus = { ok: false, msg: "Déclaration impossible : vérifiez le numéro de commande et le prénom de la personne parrainée." };
  var e = etatPaiement_(num);
  if (!e || !e.cmd) return refus;
  var prenoms = [e.cmd["Prenom"], e.cmd["Prénom"], e.cmd["Nom"], e.cmd["Nom complet"]].map(function (x) { return String(x || ""); }).join(" ");
  if (!prenoms.split(/\s+/).some(function (x) { var k = normNom_(x); return k.length >= 2 && k === prenom; })) return refus;
  if (commissionExistante_(num)) return { ok: false, msg: "Une commission est déjà déclarée pour cette commande." };
  if (String(e.cmd["Email"] || "").toLowerCase() === String(s.email || "").toLowerCase()) return { ok: false, msg: "Vous ne pouvez pas vous parrainer vous-même." };
  if (typeof origineRecompensee_ === "function") { var deja = origineRecompensee_(e.cmd, e.chatId); if (deja) return { ok: false, msg: deja }; }
  var octets; try { octets = ep2Fichier_(fichier.b64, fichier.nom, EP2.PREUVE_MAX_KO); } catch (x) { return { ok: false, msg: x.message }; }
  var taux = Number((typeof cfg_ === "function" ? cfg_() : {}).COMMISSION_CLIENT) || 20;
  enregistrerCommission_("Client", ident, s.id, num, taux, "Espace client · " + s.email + " · reçu joint");
  var lc = commissionExistante_(num);
  if (lc) majCellule_(F_COMMISSIONS, lc._row, "Statut", "À valider");
  var nomF = "Reçu " + num + " — " + epTxt_(fichier.nom, 80);
  var f = epDossier_("EP2_DOSSIER_PREUVES", "AssistAcad — Reçus des commissions").createFile(Utilities.newBlob(octets, fichier.mime, nomF));
  var id = ep2Id_("COM");
  epFeuille_(EP2.F_COMPREUVES, EP2_ENT.COMPREUVES);
  epAjouter_(EP2.F_COMPREUVES, { "ID": id, "Date": new Date(), "Numero": num, "Client ID": s.id, "Client": s.nom, "Email": s.email, "Identifiant": ident,
    "Prenom filleul": epTxt_(d.prenom, 60), "Fichier": nomF, "Drive ID": f.getId(), "Mime": fichier.mime, "Statut": "À valider",
    "Paiement integral constate": e.complet ? "Oui" : "Non" });
  if (typeof audit_ === "function") { try { audit_(s.nom + " (client)", "Commission déclarée avec reçu", num, ident); } catch (x) {} }
  epAdminTg_("💼 <b>Commission déclarée avec reçu</b>\n👤 " + epEsc_(s.nom) + " · " + epEsc_(ident) + "\n🔖 " + num + " · " + taux + " %\n" +
    (e.complet ? "✅ Le système indique la commande intégralement payée." : "⚠️ Le système n’indique PAS encore le paiement intégral : vérifie le reçu.") + "\n<i>À valider : espace équipe › Commissions (reçus).</i>");
  return { ok: true, id: id, msg: "Déclaration reçue avec votre reçu. L’administration vérifie le paiement intégral ; une fois validée, votre commission de " + taux + " % est versée sur le compte enregistré dans « Mes coordonnées de versement »." };
}

function ep2ComLigne_(id) { return epLire_(EP2.F_COMPREUVES).filter(function (o) { return String(o["ID"]) === String(id); })[0] || null; }

function apiComAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var taux = Number((typeof cfg_ === "function" ? cfg_() : {}).COMMISSION_CLIENT) || 20;
  var cli = {};
  if (typeof lireTable_ === "function" && typeof F_CLIENTS !== "undefined") { try { lireTable_(F_CLIENTS).forEach(function (o) { cli[String(o["ID"])] = o; }); } catch (e) {} }
  var l = epLire_(EP2.F_COMPREUVES).reverse().slice(0, 150).map(function (o) {
    var e = null; try { e = typeof etatPaiement_ === "function" ? etatPaiement_(String(o["Numero"])) : null; } catch (x) {}
    var c = cli[String(o["Client ID"])] || {};
    return { id: String(o["ID"]), date: epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy HH:mm"), numero: String(o["Numero"]), client: String(o["Client"]), email: String(o["Email"]),
      identifiant: String(o["Identifiant"]), prenom: String(o["Prenom filleul"]), statut: String(o["Statut"]), motif: String(o["Motif"] || ""),
      complet: !!(e && e.complet), total: e && e.total ? Number(e.total) : 0, commission: e && e.total ? Math.round(Number(e.total) * taux / 100) : 0, taux: taux,
      banque: [c["Banque"], c["Titulaire"], c["Numero compte"]].filter(String).join(" · "), versee: o["Versee le"] ? epDate_(epParseDate_(o["Versee le"]) || new Date()) : "" };
  });
  return { ok: true, liste: l, attente: l.filter(function (x) { return x.statut === "À valider"; }).length };
}

function apiComPreuve(jeton, id) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = ep2ComLigne_(id); if (!o) return { ok: false, msg: "Déclaration introuvable." };
  var b = DriveApp.getFileById(String(o["Drive ID"])).getBlob();
  return { ok: true, nom: String(o["Fichier"]), mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}

function apiComDecider(jeton, id, decision, motif, force) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = ep2ComLigne_(id); if (!o) return { ok: false, msg: "Déclaration introuvable." };
  var num = String(o["Numero"]), st = String(o["Statut"]);
  var lc = typeof commissionExistante_ === "function" ? commissionExistante_(num) : null;
  var set = function (col, v) { if (lc && typeof majCellule_ === "function") { try { majCellule_(F_COMMISSIONS, lc._row, col, v); } catch (e) {} } };
  motif = epTxt_(motif, 300);
  var mail = String(o["Email"] || ""), taux = Number((typeof cfg_ === "function" ? cfg_() : {}).COMMISSION_CLIENT) || 20, e = null;
  try { e = etatPaiement_(num); } catch (x) {}
  var montant = e && e.total ? Math.round(Number(e.total) * taux / 100) : 0;
  if (decision === "valider") {
    if (st !== "À valider") return { ok: false, msg: "Déjà traitée (" + st + ")." };
    if (!(e && e.complet) && force !== true) return { ok: false, confirmer: true, msg: "Le système n’indique pas le paiement intégral de " + num + ". Vérifie le versement dans l’application bancaire : si tu l’as constaté, confirme la validation." };
    epMaj_(EP2.F_COMPREUVES, o._row, { "Statut": "Validée", "Traite par": a.nom || a.id, "Traite le": new Date(), "Paiement integral constate": e && e.complet ? "Oui" : "Non (validé sur reçu)" });
    set("Statut", "Validée");
    ep2Mail_(mail, "AssistAcad · Votre commission " + num + " est validée", ep2Gabarit_("Commission validée",
      "<p>Bonjour " + epEsc_(o["Client"]) + ",</p><p>Le reçu du paiement intégral de la commande <b>" + epEsc_(num) + "</b> a été vérifié : votre commission" + (montant ? " de <b>" + montant.toLocaleString("fr-FR") + " ₽</b>" : "") + " est <b>validée</b>.</p><p>Le versement est fait sur le compte enregistré dans votre espace client (« Mes coordonnées de versement »). Vous recevrez un e-mail dès qu’il est effectué.</p>"));
    return { ok: true, msg: "Commission " + num + " validée" + (e && e.complet ? "." : " (attention : le système n’indique pas encore le paiement intégral ; pense à l’enregistrer).") + " Client prévenu par e-mail." };
  }
  if (decision === "refuser") {
    if (st === "Versée") return { ok: false, msg: "Déjà versée." };
    if (!motif) return { ok: false, msg: "Indique le motif du refus : il est envoyé au client." };
    epMaj_(EP2.F_COMPREUVES, o._row, { "Statut": "Refusée", "Traite par": a.nom || a.id, "Traite le": new Date(), "Motif": motif });
    set("Statut", "Refusée");
    ep2Mail_(mail, "AssistAcad · Votre déclaration " + num, ep2Gabarit_("Commission non validée",
      "<p>Bonjour " + epEsc_(o["Client"]) + ",</p><p>Votre déclaration pour la commande <b>" + epEsc_(num) + "</b> n’a pas pu être validée.</p><p><b>Motif :</b> " + epEsc_(motif) + "</p><p>Vous pouvez nous écrire sur @acades_bot si vous pensez qu’il s’agit d’une erreur.</p>"));
    return { ok: true, msg: "Déclaration refusée. Motif envoyé au client." };
  }
  if (decision === "versee") {
    if (st !== "Validée") return { ok: false, msg: "Valide d’abord la commission (statut actuel : " + st + ")." };
    epMaj_(EP2.F_COMPREUVES, o._row, { "Statut": "Versée", "Versee le": new Date(), "Traite par": a.nom || a.id, "Traite le": new Date() });
    set("Versee le", new Date()); set("Statut", "Versée");
    ep2Mail_(mail, "AssistAcad · Commission versée", ep2Gabarit_("Commission versée",
      "<p>Bonjour " + epEsc_(o["Client"]) + ",</p><p>Votre commission pour la commande <b>" + epEsc_(num) + "</b>" + (montant ? " (<b>" + montant.toLocaleString("fr-FR") + " ₽</b>)" : "") + " a été <b>versée</b> sur votre compte. Merci de recommander AssistAcad !</p>"));
    return { ok: true, msg: "Versement enregistré. Client prévenu par e-mail." };
  }
  return { ok: false, msg: "Décision inconnue." };
}

// Statuts affichés au client dans « Mes commissions » (appelé par Securite.gs)
function ep2ComStatuts_(clientId) {
  var m = {};
  epLire_(EP2.F_COMPREUVES).forEach(function (o) {
    if (String(o["Client ID"]) !== String(clientId)) return;
    var st = String(o["Statut"]);
    m[String(o["Numero"])] = st === "À valider" ? "Reçu en vérification" : st === "Validée" ? "Validée · versement en cours"
      : st === "Refusée" ? "Refusée" + (o["Motif"] ? " : " + String(o["Motif"]) : "") : st === "Versée" ? "Versée le " + epDate_(epParseDate_(o["Versee le"]) || new Date()) : st;
  });
  return m;
}

// ════════════════════ 2. OUTILS DE TRAVAIL v2 ════════════════════

var EP2_CATEGORIES = {
  russe: { nom: "Universités russes", biblio: "gost",
    normes: [
      ["Norme de présentation", "ГОСТ 7.32-2017 pour la structure et la mise en page des travaux (ВКР, курсовые), complété par le guide (методичка) de la faculté."],
      ["Mise en page", "Times New Roman 14 pt, interligne 1,5, retrait de paragraphe 1,25 cm, texte justifié ; marges : gauche 30 mm, droite 10 à 15 mm, haut et bas 20 mm ; numéro de page en bas au centre, sans numéro sur la page de titre."],
      ["Structure", "Титульный лист · Содержание · Введение · Главы (разделы) · Заключение · Список использованных источников · Приложения."],
      ["Introduction (Введение)", "Актуальность, объект, предмет, цель, задачи, методы исследования, практическая значимость, структура работы."],
      ["Bibliographie", "Description selon ГОСТ Р 7.0.100-2018, renvois selon ГОСТ Р 7.0.5-2008 ; souvent sources russes d’abord, puis étrangères ; sources récentes (5 dernières années) demandées."],
      ["Originalité", "Vérification « Антиплагиат » obligatoire ; le seuil d’originalité est fixé par l’université et la filière (à demander au client)."],
      ["Documents joints", "Отзыв руководителя, рецензия, parfois справка о проверке на антиплагиат."]],
    controles: ["Page de titre (титульный лист) conforme au modèle de l’université", "Введение : актуальность, объект, предмет, цель, задачи, методы", "Marges 30/15/20/20 mm, Times New Roman 14, interligne 1,5, retrait 1,25 cm",
      "Titres des chapitres en majuscules ou selon la методичка, sans point final", "Liste des sources selon ГОСТ Р 7.0.100-2018, numérotée", "Seuil Антиплагиат demandé atteint"] },
  europe: { nom: "Universités européennes", biblio: "apa",
    normes: [
      ["Norme de présentation", "Chaque université publie son guide (France, Belgique, Suisse, Royaume-Uni…) : il prime toujours. Les règles ci-dessous sont les plus courantes."],
      ["Mise en page", "Police 12 pt (Times New Roman ou Arial), interligne 1,5, marges de 2,5 cm, texte justifié, pagination en chiffres arabes."],
      ["Structure", "Page de titre · Remerciements · Sommaire · Introduction · Développement en parties et chapitres · Conclusion · Bibliographie · Annexes · Table des matières."],
      ["Introduction", "Contexte, problématique, hypothèses ou question de recherche, méthodologie, annonce du plan."],
      ["Bibliographie", "APA 7 (sciences humaines et sociales, gestion), Harvard (Royaume-Uni), ISO 690 (souvent en France) ; un seul style, appliqué partout."],
      ["Originalité", "Contrôle par logiciel anti-plagiat selon l’université (Compilatio, Turnitin…) ; toute reprise doit être citée."],
      ["RGPD et éthique", "Données d’enquête anonymisées, consentement des personnes interrogées."]],
    controles: ["Page de titre au modèle de l’université (logo, intitulé, directeur, année)", "Problématique clairement formulée dans l’introduction", "Police 12, interligne 1,5, marges 2,5 cm",
      "Un seul style de citation (APA 7, Harvard ou ISO 690) du début à la fin", "Annexes numérotées et appelées dans le texte", "Table des matières automatique à jour"] },
  afrique: { nom: "Universités africaines", biblio: "apa",
    normes: [
      ["Norme de présentation", "Les universités francophones (Guinée, Sénégal, Côte d’Ivoire, Mali, Cameroun…) suivent en général le modèle français et les recommandations CAMES ; le guide de la faculté prime."],
      ["Page de garde", "En haut : nom de l’État et devise nationale (ex. Guinée : « Travail – Justice – Solidarité »), ministère de l’Enseignement supérieur, université, faculté, département ; puis titre, auteur, encadreur, année académique."],
      ["Mise en page", "Times New Roman 12 pt, interligne 1,5, marges de 2,5 cm (parfois 3 cm à gauche pour la reliure), titres numérotés."],
      ["Structure", "Dédicace · Remerciements · Sigles et abréviations · Sommaire · Introduction générale · Chapitres (cadre théorique, méthodologie, résultats) · Conclusion générale · Bibliographie · Annexes · Table des matières."],
      ["Introduction générale", "Contexte et justification, problématique, objectifs (général et spécifiques), hypothèses, méthodologie, plan."],
      ["Bibliographie", "APA ou ISO 690 selon la faculté ; classement alphabétique par auteur, ouvrages puis articles puis sites."],
      ["Soutenance", "Dépôt en plusieurs exemplaires reliés ; présentation orale de 15 à 20 minutes en général."]],
    controles: ["Page de garde : État, devise, ministère, université, faculté, encadreur, année", "Dédicace, remerciements, sigles et abréviations présents", "Introduction générale : justification, problématique, objectifs, hypothèses",
      "Times New Roman 12, interligne 1,5, titres numérotés", "Bibliographie classée par ordre alphabétique", "Table des matières en fin de document"] }
};

// Accès à une commande : tâche attribuée à la personne (ou administration)
function ep2Acces_(s, numero) {
  var num = ep2Num_(numero);
  if (!num || num.length < 4) return null;
  var admin = epEstAdmin_(s);
  if (!admin && !ep2CharteOk_(s)) return null;
  var taches = epLire_(epFTaches_()).filter(function (t) {
    if (ep2Num_(t["N° commande"]) !== num) return false;
    var a = String(t["Assigne a"] || "");
    return admin || a === String(s.id) || (a === String(s.nom) && ep2NomUnique_(s.nom));
  });
  if (!taches.length && !(admin && /^[A-Z]{2,6}-[0-9]{2}-[0-9]{2,6}$/.test(num))) return null;
  return { numero: num, taches: taches };
}
// Une tâche attribuée par le NOM (et non l'identifiant) ne compte que si ce nom est porté par une seule personne
function ep2NomUnique_(nom) { nom = String(nom || "").trim().toLowerCase(); return !!nom && epMembres_().filter(function (m) { return String(m.nom).trim().toLowerCase() === nom; }).length === 1; }
function ep2Ligne_(feuille, num, idEmp) {
  return epLire_(feuille).filter(function (o) { return ep2Num_(o["Commande"]) === num && (idEmp === null || String(o["Employe ID"]) === String(idEmp)); })[0] || null;
}
// Tant que la charte en vigueur n'est pas acceptée, les outils restent fermés (si le module charte est installé)
function ep2CharteOk_(s) { return !(typeof EP2_BASES !== "undefined" && EP2_BASES.apiCharte3) || epEstAdmin_(s) || ep2CharteAcceptee_(s); }
var EP2_CHARTE_REFUS = { ok: false, charte: true, msg: "Accepte d’abord la nouvelle charte (version 4.0) : Espace équipe › Confidentialité. Les outils s’ouvriront ensuite." };
var EP2_REFUS = { ok: false, msg: "Ce numéro de commande ne correspond à aucune de tes tâches. Vérifie-le (ex. CMD-26-0042) ou demande à l’administration de t’attribuer la tâche." };

function apiOutils2Ouvrir(jeton, numero) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var c = CacheService.getScriptCache(), k = "EP2ACC_" + s.id, n = Number(c.get(k) || 0);
  if (n >= 30) return { ok: false, msg: "Trop d’essais de numéros de commande. Réessaie dans 30 minutes." };
  if (!ep2CharteOk_(s)) return EP2_CHARTE_REFUS;
  var acc = ep2Acces_(s, numero);
  if (!acc) { c.put(k, String(n + 1), 1800); return EP2_REFUS; }
  var now = new Date(), cmd = ep2Ligne_(EP2.F_CMD, acc.numero, null), red = ep2Ligne_(EP2.F_REDAC, acc.numero, s.id), br = ep2Ligne_(EP2.F_BROUILLON, acc.numero, s.id);
  var taches = acc.taches.map(function (t) {
    var e = epParseDate_(t["Echeance"]), j = null;
    if (e) { var e0 = new Date(e.getTime()), n0 = new Date(now.getTime()); e0.setHours(0, 0, 0, 0); n0.setHours(0, 0, 0, 0); j = Math.round((e0 - n0) / 86400000); }
    return { id: String(t["ID"]), titre: String(t["Titre"] || ""), matiere: String(t["Matiere"] || ""), statut: String(t["Statut"] || ""), assigne: String(t["Assigne a"] || ""),
      echeance: e ? epDate_(e) : "", jours: j, type: typeof epOutilsTypeDe_ === "function" ? epOutilsTypeDe_(t) : "devoir" };
  });
  var coches = {}; try { coches = JSON.parse(cmd ? cmd["Coches categorie"] || "{}" : "{}"); } catch (e) {}
  return { ok: true, numero: acc.numero, admin: epEstAdmin_(s), taches: taches,
    categorie: cmd ? String(cmd["Categorie"] || "") : "", etablissement: cmd ? String(cmd["Etablissement"] || "") : "", cochesCategorie: coches,
    categories: Object.keys(EP2_CATEGORIES).map(function (k) { var x = EP2_CATEGORIES[k]; return { id: k, nom: x.nom, biblio: x.biblio, normes: x.normes, controles: x.controles }; }),
    redaction: red ? { mots: Number(red["Mots"]) || 0, maj: epDate_(epParseDate_(red["MAJ"]) || now, "dd/MM HH:mm") } : null,
    brouillon: br ? Number(br["Elements"]) || 0 : 0,
    soumissions: ep2MesSoumissions_(s, acc.numero), fichiers: ep2Fichiers_(s, acc.numero, false).length, formats: Object.keys(EP2_FORMATS).map(function (k) { return { id: k, nom: EP2_FORMATS[k].nom }; }),
    listes: typeof EP_OUTILS_LISTES !== "undefined" ? Object.keys(EP_OUTILS_LISTES).map(function (k) { return { id: k, nom: EP_OUTILS_LISTES[k].nom, items: EP_OUTILS_LISTES[k].items }; }) : [] };
}

function apiOutils2Categorie(jeton, numero, cat, d) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  if (cat && !EP2_CATEGORIES[cat]) return { ok: false, msg: "Catégorie inconnue." };
  d = d || {};
  epFeuille_(EP2.F_CMD, EP2_ENT.CMD);
  var o = ep2Ligne_(EP2.F_CMD, acc.numero, null), coches = {};
  Object.keys(d.coches || {}).forEach(function (k) { if (d.coches[k] && Number(k) >= 0 && Number(k) < 20) coches[k] = 1; });
  var champs = { "Commande": acc.numero, "MAJ": new Date(), "Par": s.nom || s.id };
  if (cat) champs["Categorie"] = cat;
  if (d.etablissement !== undefined) champs["Etablissement"] = epTxt_(d.etablissement, 160);
  if (d.coches) champs["Coches categorie"] = JSON.stringify(coches);
  if (o) epMaj_(EP2.F_CMD, o._row, champs); else epAjouter_(EP2.F_CMD, champs);
  return { ok: true, msg: cat ? "Catégorie enregistrée : " + EP2_CATEGORIES[cat].nom + "." : "Enregistré." };
}

function apiOutils2Redaction(jeton, numero) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  var o = ep2Ligne_(EP2.F_REDAC, acc.numero, s.id);
  return { ok: true, texte: o ? ep2Lire_(o["Drive ID"]) : "", objectif: o ? Number(o["Objectif"]) || 0 : 0, maj: o ? epDate_(epParseDate_(o["MAJ"]) || new Date(), "dd/MM HH:mm") : "" };
}

function apiOutils2RedactionEnregistrer(jeton, numero, texte, objectif) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  texte = String(texte == null ? "" : texte).slice(0, EP2.REDAC_MAX);
  var mots = (texte.match(/[0-9A-Za-zÀ-ÖØ-öø-ÿА-Яа-яЁё]+/g) || []).length;
  epFeuille_(EP2.F_REDAC, EP2_ENT.REDAC);
  var o = ep2Ligne_(EP2.F_REDAC, acc.numero, s.id);
  var id = ep2Ecrire_("EP2_DOSSIER_REDAC", "AssistAcad — Rédactions (privé)", "Rédaction " + acc.numero + " — " + s.id + ".txt", o ? String(o["Drive ID"]) : "", texte);
  var champs = { "Commande": acc.numero, "Employe ID": s.id, "Nom": s.nom || "", "Drive ID": id, "Mots": mots, "Objectif": Math.max(0, Math.min(200000, Number(objectif) || 0)), "MAJ": new Date() };
  if (o) epMaj_(EP2.F_REDAC, o._row, champs); else epAjouter_(EP2.F_REDAC, champs);
  return { ok: true, mots: mots, maj: epDate_(new Date(), "HH:mm") };
}

var EP2_TYPES_BR = { idee: 1, source: 1, citation: 1, plan: 1, question: 1, donnee: 1 };
function apiOutils2Brouillon(jeton, numero) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  var o = ep2Ligne_(EP2.F_BROUILLON, acc.numero, s.id), items = [];
  try { items = JSON.parse(o ? ep2Lire_(o["Drive ID"]) || "[]" : "[]"); } catch (e) { items = []; }
  return { ok: true, items: Array.isArray(items) ? items : [] };
}
function apiOutils2BrouillonEnregistrer(jeton, numero, items) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  var propres = (Array.isArray(items) ? items : []).slice(0, 600).map(function (x, i) {
    x = x || {};
    return { id: epTxt_(x.id, 20) || ("b" + i), type: EP2_TYPES_BR[x.type] ? x.type : "idee", texte: epTxt_(x.texte, 5000), lien: /^https?:\/\//i.test(String(x.lien || "")) ? epTxt_(x.lien, 500) : "",
      groupe: epTxt_(x.groupe, 80), fait: !!x.fait };
  }).filter(function (x) { return x.texte || x.lien; });
  epFeuille_(EP2.F_BROUILLON, EP2_ENT.BROUILLON);
  var o = ep2Ligne_(EP2.F_BROUILLON, acc.numero, s.id);
  var id = ep2Ecrire_("EP2_DOSSIER_REDAC", "AssistAcad — Rédactions (privé)", "Brouillon " + acc.numero + " — " + s.id + ".json", o ? String(o["Drive ID"]) : "", JSON.stringify(propres));
  var champs = { "Commande": acc.numero, "Employe ID": s.id, "Drive ID": id, "Elements": propres.length, "MAJ": new Date() };
  if (o) epMaj_(EP2.F_BROUILLON, o._row, champs); else epAjouter_(EP2.F_BROUILLON, champs);
  return { ok: true, n: propres.length };
}

function ep2MesSoumissions_(s, num) {
  var admin = epEstAdmin_(s);
  return epLire_(EP2.F_SOUMIS).filter(function (o) { return (!num || ep2Num_(o["Commande"]) === num) && (admin || String(o["Employe ID"]) === String(s.id)); }).reverse().slice(0, 50).map(function (o) {
    return { id: String(o["ID"]), date: epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM HH:mm"), commande: String(o["Commande"]), nom: String(o["Nom"]), fichier: String(o["Fichier"]),
      taille: Number(o["Taille (Ko)"]) || 0, statut: String(o["Statut"]), remarque: String(o["Remarque"] || ""), message: String(o["Message"] || "") };
  });
}

// ── Dossier de travail : les fichiers de la personne pour une commande ──
var EP2_FORMATS = {
  docx: { nom: "Word (.docx)", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pdf: { nom: "PDF (.pdf)", ext: "pdf", mime: "application/pdf" },
  odt: { nom: "OpenDocument (.odt)", ext: "odt", mime: "application/vnd.oasis.opendocument.text" },
  rtf: { nom: "Texte enrichi (.rtf)", ext: "rtf", mime: "application/rtf" },
  txt: { nom: "Texte brut (.txt)", ext: "txt", mime: "text/plain" },
  epub: { nom: "Livre numérique (.epub)", ext: "epub", mime: "application/epub+zip" }
};
// Mise en page appliquée à la conversion, selon la catégorie de la commande (points typographiques)
var EP2_MISE = {
  russe: { police: "Times New Roman", taille: 14, interligne: 1.5, retrait: 35.4, marges: [56.7, 42.5, 56.7, 85] },   // haut, droite, bas, gauche (20/15/20/30 mm)
  europe: { police: "Times New Roman", taille: 12, interligne: 1.5, retrait: 0, marges: [70.9, 70.9, 70.9, 70.9] },   // 2,5 cm
  afrique: { police: "Times New Roman", taille: 12, interligne: 1.5, retrait: 0, marges: [70.9, 70.9, 70.9, 85] },
  defaut: { police: "Times New Roman", taille: 12, interligne: 1.5, retrait: 0, marges: [70.9, 70.9, 70.9, 70.9] }
};
var EP2_TITRE_RE = /^(введение|заключение|содержание|список (использованных )?(источников|литературы)|приложени[ея]|глава\s|раздел\s|introduction( générale)?|conclusion( générale)?|bibliographie|sommaire|annexes?|chapitre\s|partie\s|remerciements|dédicace|résumé|abstract|references|chapter\s)/i;
function ep2Titre_(l) { l = String(l).trim(); return l.length > 0 && l.length <= 120 && !/[.;:,]$/.test(l) && (EP2_TITRE_RE.test(l) || /^[0-9]+(\.[0-9]+){0,3}\.?\s+\S/.test(l) && l.length <= 90); }
function ep2Dossier_() { return epDossier_("EP2_DOSSIER_TRAVAIL", "AssistAcad — Dossiers de travail (privé)"); }
function ep2Fichiers_(s, num, inclureTemp) {
  var admin = epEstAdmin_(s);
  return epLire_(EP2.F_FICHIERS).filter(function (o) {
    var st = String(o["Statut"]);
    return ep2Num_(o["Commande"]) === num && (st === "Dossier" || (inclureTemp && st === "Temporaire")) && (admin || String(o["Employe ID"]) === String(s.id));
  });
}
function ep2FichierVue_(o, soumis) {
  return { id: String(o["ID"]), date: epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM HH:mm"), nom: String(o["Fichier"]), ko: Number(o["Taille (Ko)"]) || 0,
    format: String(o["Format"] || ""), origine: String(o["Origine"] || ""), membre: String(o["Nom"] || ""), soumis: !!(soumis && soumis[String(o["ID"])]) };
}
function ep2DejaSoumis_(num) { var m = {}; epLire_(EP2.F_SOUMIS).forEach(function (o) { if (ep2Num_(o["Commande"]) === num && o["Fichier dossier"]) m[String(o["Fichier dossier"])] = 1; }); return m; }
function ep2FichierDe_(s, id) {
  var o = epLire_(EP2.F_FICHIERS).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o || !(epEstAdmin_(s) || String(o["Employe ID"]) === String(s.id))) return null;
  return o;
}
function ep2Quota_(cle, max, sec) { var c = CacheService.getScriptCache(), n = Number(c.get(cle) || 0); if (n >= max) return false; c.put(cle, String(n + 1), sec); return true; }

// Google Doc mis en forme à partir de la rédaction (titres reconnus, normes de la catégorie)
function ep2DocDepuisTexte_(nom, texte, cat, miseEnPage) {
  var m = EP2_MISE[cat] || EP2_MISE.defaut, doc = DocumentApp.create(nom), body = doc.getBody();
  var lignes = String(texte).replace(/\r/g, "").split("\n");
  if (miseEnPage) { try { body.setMarginTop(m.marges[0]); body.setMarginRight(m.marges[1]); body.setMarginBottom(m.marges[2]); body.setMarginLeft(m.marges[3]); } catch (e) {} }
  lignes.forEach(function (l, i) {
    var p = i === 0 ? body.getParagraphs()[0].setText(l) : body.appendParagraph(l);
    if (!miseEnPage) return;
    try {
      var titre = ep2Titre_(l);
      if (titre) { p.setHeading(/^[0-9]+\.[0-9]/.test(String(l).trim()) ? DocumentApp.ParagraphHeading.HEADING2 : DocumentApp.ParagraphHeading.HEADING1); p.setAlignment(cat === "russe" ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.LEFT); }
      else { p.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY); if (m.retrait) p.setIndentFirstLine(m.retrait); }
      p.setLineSpacing(m.interligne); p.setFontFamily(m.police); p.setFontSize(titre ? m.taille + 2 : m.taille); p.setBold(!!titre); p.setForegroundColor("#000000");
    } catch (e) {}
  });
  doc.saveAndClose();
  return doc.getId();
}
function ep2Exporter_(docId, fmt, nom) {
  var F = EP2_FORMATS[fmt];
  if (fmt === "pdf") return DriveApp.getFileById(docId).getAs("application/pdf").setName(nom + ".pdf");
  var r = UrlFetchApp.fetch("https://docs.google.com/document/d/" + docId + "/export?format=" + fmt, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("Conversion impossible pour le moment (" + r.getResponseCode() + "). Réessaie dans une minute.");
  return r.getBlob().setName(nom + "." + F.ext);
}

// « Convertir » : la rédaction devient un fichier (Word, PDF, ODT, RTF, TXT, EPUB), en attente d'enregistrement
function apiOutils2Convertir(jeton, numero, format, d) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  var F = EP2_FORMATS[format]; if (!F) return { ok: false, msg: "Format inconnu." };
  if (!ep2Quota_("EP2CONV_" + s.id, 40, 3600)) return { ok: false, msg: "Trop de conversions en une heure : réessaie plus tard." };
  d = d || {};
  var red = ep2Ligne_(EP2.F_REDAC, acc.numero, s.id), texte = red ? ep2Lire_(red["Drive ID"]) : "";
  if (String(texte).trim().length < 20) return { ok: false, msg: "La rédaction est vide : écris et enregistre d’abord ton texte." };
  var cmd = ep2Ligne_(EP2.F_CMD, acc.numero, null), cat = cmd ? String(cmd["Categorie"] || "") : "";
  var base = epTxt_(d.nom, 90).replace(/[\\/:*?"<>|#%]+/g, " ").trim() || (acc.numero + " — rédaction " + epDate_(new Date(), "dd-MM HH'h'mm"));
  var blob;
  try {
    if (format === "txt") blob = Utilities.newBlob(String(texte), F.mime, base + ".txt");
    else {
      var docId = ep2DocDepuisTexte_(base, texte, cat, d.miseEnPage !== false);
      try { blob = ep2Exporter_(docId, format, base); } finally { try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) {} }
    }
  } catch (e) { return { ok: false, msg: String(e.message || e) }; }
  var f = ep2Dossier_().createFile(blob), ko = Math.max(1, Math.round(blob.getBytes().length / 1024)), id = ep2Id_("FIC");
  epFeuille_(EP2.F_FICHIERS, EP2_ENT.FICHIERS);
  epAjouter_(EP2.F_FICHIERS, { "ID": id, "Date": new Date(), "Commande": acc.numero, "Employe ID": s.id, "Nom": s.nom || "", "Fichier": blob.getName(), "Drive ID": f.getId(),
    "Mime": F.mime, "Taille (Ko)": ko, "Format": format, "Origine": "Rédaction", "Statut": "Temporaire", "MAJ": new Date() });
  return { ok: true, id: id, nom: blob.getName(), ko: ko, format: F.nom, miseEnPage: d.miseEnPage !== false, categorie: cat,
    msg: "Fichier prêt : " + blob.getName() + " (" + ko + " Ko). Clique « Enregistrer dans mon dossier » pour le garder." };
}

// « Enregistrer » : le fichier converti rejoint le dossier de la commande
function apiOutils2FichierEnregistrer(jeton, id, nom) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var o = ep2FichierDe_(s, id); if (!o || String(o["Statut"]) !== "Temporaire") return { ok: false, msg: "Fichier introuvable ou déjà enregistré." };
  if (!ep2Acces_(s, o["Commande"])) return EP2_REFUS;
  var champs = { "Statut": "Dossier", "MAJ": new Date() }, n = epTxt_(nom, 120).replace(/[\\/:*?"<>|#%]+/g, " ").trim();
  if (n) { var ext = String(o["Fichier"]).split(".").pop(); if (n.toLowerCase().slice(-ext.length - 1) !== "." + ext.toLowerCase()) n += "." + ext; champs["Fichier"] = n; try { DriveApp.getFileById(String(o["Drive ID"])).setName(n); } catch (e) {} }
  epMaj_(EP2.F_FICHIERS, o._row, champs);
  return { ok: true, msg: "Enregistré dans ton dossier (" + ep2Num_(o["Commande"]) + ")." };
}

function apiOutils2Fichiers(jeton, numero) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  var soumis = ep2DejaSoumis_(acc.numero);
  return { ok: true, admin: epEstAdmin_(s), fichiers: ep2Fichiers_(s, acc.numero, false).reverse().map(function (o) { return ep2FichierVue_(o, soumis); }),
    formats: Object.keys(EP2_FORMATS).map(function (k) { return { id: k, nom: EP2_FORMATS[k].nom }; }) };
}

// Ajouter au dossier un fichier de l'ordinateur (autorisé : c'est le dossier qui sert ensuite à soumettre)
function apiOutils2DossierImporter(jeton, numero, fichier) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  if (!fichier || !fichier.b64) return { ok: false, msg: "Choisis le fichier à ajouter." };
  if (/\.(exe|bat|cmd|com|scr|js|vbs|ps1|msi|jar|apk|sh)$/i.test(String(fichier.nom || ""))) return { ok: false, msg: "Ce type de fichier (programme) n’est pas accepté." };
  if (!ep2Quota_("EP2IMP_" + s.id, 60, 3600)) return { ok: false, msg: "Trop d’ajouts en une heure : réessaie plus tard." };
  var octets; try { octets = ep2Fichier_(fichier.b64, fichier.nom, EP2.SOUMIS_MAX_KO); } catch (x) { return { ok: false, msg: x.message }; }
  var nom = epTxt_(fichier.nom, 120).replace(/[\\/:*?"<>|#%]+/g, " ").trim() || "fichier", mime = epTxt_(fichier.mime, 120) || "application/octet-stream";
  var f = ep2Dossier_().createFile(Utilities.newBlob(octets, mime, nom)), id = ep2Id_("FIC");
  epFeuille_(EP2.F_FICHIERS, EP2_ENT.FICHIERS);
  epAjouter_(EP2.F_FICHIERS, { "ID": id, "Date": new Date(), "Commande": acc.numero, "Employe ID": s.id, "Nom": s.nom || "", "Fichier": nom, "Drive ID": f.getId(),
    "Mime": mime, "Taille (Ko)": Math.max(1, Math.round(octets.length / 1024)), "Format": (nom.split(".").length > 1 ? nom.split(".").pop() : "").toLowerCase().slice(0, 8), "Origine": "Import", "Statut": "Dossier", "MAJ": new Date() });
  return { ok: true, id: id, msg: "Ajouté à ton dossier : " + nom + "." };
}

function apiOutils2FichierSupprimer(jeton, id) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var o = ep2FichierDe_(s, id); if (!o || String(o["Statut"]) !== "Dossier") return { ok: false, msg: "Fichier introuvable." };
  if (ep2DejaSoumis_(ep2Num_(o["Commande"]))[String(o["ID"])]) return { ok: false, msg: "Ce fichier a été soumis à l’administration : il est conservé." };
  epMaj_(EP2.F_FICHIERS, o._row, { "Statut": "Supprimé", "MAJ": new Date() });
  try { DriveApp.getFileById(String(o["Drive ID"])).setTrashed(true); } catch (e) {}
  return { ok: true, msg: "Fichier retiré du dossier." };
}

// Administration : ouvrir un fichier du dossier d'un membre
function apiOutils2FichierAdmin(jeton, id) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = epLire_(EP2.F_FICHIERS).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o) return { ok: false, msg: "Fichier introuvable." };
  return { ok: true, url: DriveApp.getFileById(String(o["Drive ID"])).getUrl(), nom: String(o["Fichier"]) };
}

// Fichiers convertis jamais enregistrés : supprimés après 24 h (appelé par epOrchestre)
function ep2NettoyerTemp_() {
  var limite = Date.now() - 86400000, n = 0;
  epLire_(EP2.F_FICHIERS).forEach(function (o) {
    if (String(o["Statut"]) !== "Temporaire") return;
    var d = epParseDate_(o["Date"]); if (!d || d.getTime() > limite) return;
    try { DriveApp.getFileById(String(o["Drive ID"])).setTrashed(true); } catch (e) {}
    epMaj_(EP2.F_FICHIERS, o._row, { "Statut": "Expiré", "MAJ": new Date() }); n++;
  });
  return n;
}

// Le travail fini part à l'administration : un ou plusieurs fichiers CHOISIS DANS LE DOSSIER, ou la rédaction elle-même
function apiOutils2Soumettre(jeton, numero, d, fichier) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var acc = ep2Acces_(s, numero); if (!acc) return EP2_REFUS;
  d = d || {};
  if (fichier && fichier.b64) return { ok: false, msg: "Dans les outils de travail, on soumet uniquement depuis « Mon dossier ». Ajoute d’abord le fichier à ton dossier (onglet Dossier), puis choisis-le ici." };
  if (!ep2Quota_("EP2SOU_" + s.id, 30, 3600)) return { ok: false, msg: "Trop de soumissions en une heure : réessaie plus tard." };
  var dos = epDossier_("EP2_DOSSIER_SOUMIS", "AssistAcad — Travaux soumis"), envois = [];
  if (d.depuisRedaction) {
    var red = ep2Ligne_(EP2.F_REDAC, acc.numero, s.id), texte = red ? ep2Lire_(red["Drive ID"]) : "";
    if (String(texte).trim().length < 50) return { ok: false, msg: "La rédaction est vide ou trop courte : enregistre-la d’abord." };
    var cmd = ep2Ligne_(EP2.F_CMD, acc.numero, null);
    var nomD = acc.numero + " — " + (s.nom || s.id) + " — rédaction " + epDate_(new Date(), "dd-MM HH'h'mm");
    var docId = ep2DocDepuisTexte_(nomD, texte, cmd ? String(cmd["Categorie"] || "") : "", true), fd = DriveApp.getFileById(docId);
    try { fd.moveTo(dos); } catch (e) { try { dos.addFile(fd); } catch (x) {} }
    envois.push({ nom: nomD, driveId: docId, mime: "Document Google", ko: Math.max(1, Math.round(texte.length / 1024)), origine: "Rédaction", source: "" });
  } else {
    var ids = (Array.isArray(d.fichiers) ? d.fichiers : []).map(String).slice(0, 10);
    if (!ids.length) return { ok: false, msg: "Choisis le ou les fichiers dans ton dossier." };
    var mien = {}; ep2Fichiers_(s, acc.numero, false).forEach(function (o) { mien[String(o["ID"])] = o; });
    for (var i = 0; i < ids.length; i++) if (!mien[ids[i]]) return { ok: false, msg: "Un des fichiers choisis n’est pas dans ton dossier pour cette commande." };
    ids.forEach(function (fid) {
      var o = mien[fid], src = DriveApp.getFileById(String(o["Drive ID"])), copie = src.makeCopy(acc.numero + " — " + String(o["Fichier"]), dos);
      envois.push({ nom: acc.numero + " — " + String(o["Fichier"]), driveId: copie.getId(), mime: String(o["Mime"]), ko: Number(o["Taille (Ko)"]) || 0, origine: String(o["Origine"]), source: fid });
    });
  }
  epFeuille_(EP2.F_SOUMIS, EP2_ENT.SOUMIS);
  var faits = envois.map(function (e) {
    var id = ep2Id_("SOU");
    epAjouter_(EP2.F_SOUMIS, { "ID": id, "Date": new Date(), "Commande": acc.numero, "Employe ID": s.id, "Nom": s.nom || "", "Fichier": e.nom, "Drive ID": e.driveId, "Mime": e.mime,
      "Taille (Ko)": e.ko, "Message": epTxt_(d.message, 1500), "Statut": "Reçu", "Origine": e.origine, "Fichier dossier": e.source });
    return id;
  });
  epAdminTg_("📤 <b>Travail soumis</b>\n🔖 " + acc.numero + "\n👤 " + epEsc_(s.nom || s.id) + (String(s.role) === "partenaire" ? " (partenaire)" : "") + "\n📎 " +
    envois.map(function (e) { return epEsc_(e.nom) + " · " + e.ko + " Ko"; }).join("\n📎 ") + (d.message ? "\n💬 " + epEsc_(epTxt_(d.message, 300)) : "") + "\n<i>Espace équipe › Soumissions reçues.</i>");
  return { ok: true, id: faits[0], ids: faits, msg: (faits.length > 1 ? faits.length + " fichiers soumis" : "Travail soumis") + " à l’administration (" + faits.join(", ") + "). Tu seras prévenu(e) de la validation.", soumissions: ep2MesSoumissions_(s, acc.numero) };
}

// Le membre ne télécharge pas ce qui vient de la rédaction : le travail reste dans l'intranet.
function apiOutils2SoumissionFichier(jeton, id) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var o = epLire_(EP2.F_SOUMIS).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o || !(epEstAdmin_(s) || String(o["Employe ID"]) === String(s.id))) return { ok: false, msg: "Soumission introuvable." };
  var f = DriveApp.getFileById(String(o["Drive ID"]));
  if (epEstAdmin_(s)) return { ok: true, url: f.getUrl(), nom: String(o["Fichier"]) };
  if (String(o["Origine"] || "Rédaction") !== "Import") return { ok: false, msg: "Ce travail vient de la rédaction protégée : il reste dans l’intranet. L’administration le consulte directement." };
  var b = f.getBlob();
  return { ok: true, nom: String(o["Fichier"]), mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}

function apiOutils2SoumissionsAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var l = ep2MesSoumissions_(a, "");
  return { ok: true, liste: l, attente: l.filter(function (x) { return x.statut === "Reçu"; }).length };
}

function apiOutils2SoumissionDecider(jeton, id, statut, remarque) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  if (["Validé", "À reprendre"].indexOf(statut) === -1) return { ok: false, msg: "Statut inconnu." };
  remarque = epTxt_(remarque, 1500);
  if (statut === "À reprendre" && !remarque) return { ok: false, msg: "Explique ce qu’il faut reprendre : la remarque est envoyée au membre." };
  var o = epLire_(EP2.F_SOUMIS).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o) return { ok: false, msg: "Soumission introuvable." };
  epMaj_(EP2.F_SOUMIS, o._row, { "Statut": statut, "Traite par": a.nom || a.id, "Traite le": new Date(), "Remarque": remarque });
  var m = ep2Membre_(o["Employe ID"]);
  if (m && m.email) ep2Mail_(m.email, "AssistAcad · " + o["Commande"] + " : travail " + (statut === "Validé" ? "validé" : "à reprendre"), ep2Gabarit_("Ton travail " + o["Commande"],
    "<p>Bonjour " + epEsc_(m.nom) + ",</p><p>Ton travail <b>" + epEsc_(o["Fichier"]) + "</b> est <b>" + (statut === "Validé" ? "validé ✅" : "à reprendre") + "</b>.</p>" + (remarque ? "<p><b>Remarque de l’administration :</b><br>" + epEsc_(remarque).replace(/\n/g, "<br>") + "</p>" : "")));
  return { ok: true, msg: "Soumission " + id + " : " + statut + (m && m.email ? " · membre prévenu par e-mail." : " · (pas d’e-mail enregistré pour ce membre)") };
}

// « Mon dossier » : toutes les commandes sur lesquelles la personne travaille
function apiOutils2Dossier(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  if (!ep2CharteOk_(s)) return EP2_CHARTE_REFUS;
  var admin = epEstAdmin_(s), now = new Date(), cmds = {};
  var ajout = function (num) { num = ep2Num_(num); if (!num) return null; return cmds[num] = cmds[num] || { numero: num, taches: [], mots: 0, brouillon: 0, fichiers: 0, soumissions: 0, dernier: "", activite: 0, statutSoumission: "", qualite: null }; };
  var fini = /^(Terminée|Acceptée|Livrée|Annulée)$/i, limite = now.getTime() - 60 * 86400000;
  epLire_(epFTaches_()).forEach(function (t) {
    var a = String(t["Assigne a"] || "");
    if (!(a === String(s.id) || (a === String(s.nom) && ep2NomUnique_(s.nom)))) return;
    var fin = epParseDate_(t["Terminee le"]);
    if (fini.test(String(t["Statut"] || "")) && fin && fin.getTime() < limite) return;
    var c = ajout(t["N° commande"]); if (!c) return;
    c.taches.push({ id: String(t["ID"]), titre: String(t["Titre"] || ""), statut: String(t["Statut"] || ""), echeance: epParseDate_(t["Echeance"]) ? epDate_(epParseDate_(t["Echeance"])) : "" });
  });
  var act = function (c, d) { var x = epParseDate_(d); if (x && x.getTime() > c.activite) { c.activite = x.getTime(); c.dernier = epDate_(x, "dd/MM HH:mm"); } };
  epLire_(EP2.F_REDAC).forEach(function (o) { if (String(o["Employe ID"]) !== String(s.id)) return; var c = ajout(o["Commande"]); if (c) { c.mots = Number(o["Mots"]) || 0; act(c, o["MAJ"]); } });
  epLire_(EP2.F_BROUILLON).forEach(function (o) { if (String(o["Employe ID"]) !== String(s.id)) return; var c = ajout(o["Commande"]); if (c) { c.brouillon = Number(o["Elements"]) || 0; act(c, o["MAJ"]); } });
  epLire_(EP2.F_SOUMIS).forEach(function (o) { if (String(o["Employe ID"]) !== String(s.id)) return; var c = ajout(o["Commande"]); if (c) { c.soumissions++; c.statutSoumission = String(o["Statut"]); act(c, o["Date"]); } });
  epLire_(EP2.F_FICHIERS).forEach(function (o) { if (String(o["Employe ID"]) !== String(s.id) || String(o["Statut"]) !== "Dossier") return; var c = ajout(o["Commande"]); if (c) { c.fichiers++; act(c, o["MAJ"]); } });
  var outils = typeof EP !== "undefined" && EP.F_OUTILS ? epLire_(EP.F_OUTILS) : [];
  Object.keys(cmds).forEach(function (k) {
    var c = cmds[k], f = 0, n = 0;
    c.taches.forEach(function (t) {
      var o = outils.filter(function (x) { return String(x["Tache"]) === t.id; })[0];
      if (!o) return;
      var co = {}; try { co = JSON.parse(o["Coches"] || "{}"); } catch (e) {}
      var l = typeof EP_OUTILS_LISTES !== "undefined" ? EP_OUTILS_LISTES[o["Liste"]] : null;
      if (l) { f += Object.keys(co).length; n += l.items.length; }
    });
    c.qualite = n ? Math.round(f / n * 100) : null;
  });
  var liste = Object.keys(cmds).map(function (k) { return cmds[k]; }).sort(function (a, b) { return b.activite - a.activite || (a.numero < b.numero ? 1 : -1); });
  return { ok: true, nom: String(s.nom || ""), role: String(s.role || ""), admin: admin, commandes: liste };
}

// ════════════════════ 3. RÉVISION v2 ════════════════════

var EP2_NIVEAUX = {
  debutant: { nom: "Débutant", partOuvertes: 0.1, secParQ: 90, indices: 3 },
  intermediaire: { nom: "Intermédiaire", partOuvertes: 0.2, secParQ: 60, indices: 1 },
  avance: { nom: "Avancé", partOuvertes: 0.35, secParQ: 45, indices: 0 }
};
function ep2Profil_(clientId) {
  var o = epLire_(EP2.F_PROFILS).filter(function (x) { return String(x["Client ID"]) === String(clientId); })[0] || null;
  var d = o ? epParseDate_(o["Date examen"]) : null;
  return { _row: o ? o._row : 0, dateExamen: d ? epJour_(d) : "", noteVisee: o ? Number(o["Note visee"]) || 0 : 0,
    niveau: o && EP2_NIVEAUX[o["Niveau"]] ? String(o["Niveau"]) : "intermediaire", rappels: o ? String(o["Rappels"]) === "Oui" : false, dernierRappel: o ? String(o["Dernier rappel"] || "") : "" };
}
function ep2Mention_(n) { return n >= 16 ? "Très bien" : n >= 14 ? "Bien" : n >= 12 ? "Assez bien" : n >= 10 ? "Passable" : "Insuffisant"; }
function ep2NoteRusse_(n) { return n >= 17 ? "5 · отлично" : n >= 13 ? "4 · хорошо" : n >= 10 ? "3 · удовлетворительно" : "2 · неудовлетворительно"; }
var EP2_JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
function ep2Jour_(d) { return EP2_JOURS[Number(epDate_(d, "u")) % 7] + " " + epDate_(d, "dd/MM"); }
function ep2Melange_(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function ep2ModulesClient_(s) {
  return epLire_(EP.F_REV).filter(function (o) { return String(o["Client ID"]) === s.id && String(o["Statut"]) !== "Supprimé"; });
}
function ep2Examens_(s) {
  return epLire_(EP2.F_EXAMENS).filter(function (o) { return String(o["Client ID"]) === s.id && String(o["Statut"]) === "Rendu"; })
    .map(function (o) { return { id: String(o["ID"]), date: epParseDate_(o["Rendu le"]) || epParseDate_(o["Cree le"]) || new Date(), note: Number(o["Note /20"]) || 0, modules: String(o["Modules"] || ""), detail: o["Detail"] }; })
    .sort(function (a, b) { return a.date - b.date; });
}

// Plan des 7 prochains jours, construit à partir de l'objectif et de ce qui est dû
function ep2Plan_(profil, mods, dues, examens) {
  var plan = [], auj = new Date(); auj.setHours(12, 0, 0, 0);
  var dEx = profil.dateExamen ? new Date(profil.dateExamen + "T12:00:00") : null;
  var dernierEx = examens.length ? examens[examens.length - 1].date : null;
  var joursDepuisEx = dernierEx ? Math.floor((auj - dernierEx) / 86400000) : 99;
  for (var i = 0; i < 7; i++) {
    var j = new Date(auj.getTime() + i * 86400000), t = [], reste = dEx ? Math.round((dEx - j) / 86400000) : null;
    if (reste !== null && reste < 0) break;
    if (reste === 0) { t.push("Jour de l’examen : relis seulement ta fiche, mange, arrive en avance."); plan.push({ jour: ep2Jour_(j), taches: t }); break; }
    if (reste === 1) t.push("Veille d’examen : 20 minutes de cartes, puis repos. Le sommeil fixe ce que tu as appris.");
    else {
      if (i === 0 && dues) t.push("Revoir tes " + dues + " carte(s) dues (10 à 15 min).");
      else t.push("Cartes du jour (10 min) : la répétition espacée fait le gros du travail.");
      if (mods.length) t.push("QCM : « " + String(mods[i % mods.length]["Titre"]) + " », puis relire les explications des erreurs.");
      if ((joursDepuisEx + i) % 7 === 0 || reste === 3 || (i === 0 && joursDepuisEx >= 7)) t.push("Examen blanc chronométré (dans les conditions réelles).");
      if (i % 2 === 1) t.push("« Expliquer simplement » : explique une notion à voix haute ou par écrit, sans regarder le cours.");
    }
    plan.push({ jour: ep2Jour_(j), reste: reste, taches: t });
  }
  return plan;
}

function apiRev2Profil(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var p = ep2Profil_(s.id), mods = ep2ModulesClient_(s), ex = ep2Examens_(s), now = Date.now(), dues = 0;
  var scores = epLire_(EP.F_REV_SCORES).filter(function (o) { return String(o["Client ID"]) === s.id; });
  var modules = mods.map(function (o) {
    var k = []; try { k = JSON.parse(o["Cartes"] || "[]"); } catch (e) {}
    var d = k.filter(function (c) { return !c.d || c.d <= now; }).length; dues += d;
    var boite = k.length ? k.reduce(function (a, c) { return a + (c.b || 1); }, 0) / k.length : 1;
    var sc = scores.filter(function (x) { return String(x["Module"]) === String(o["ID"]); }).slice(-5).map(function (x) { return Number(x["Score"]) / Math.max(1, Number(x["Total"])) * 100; });
    var q = sc.length ? sc.reduce(function (a, b) { return a + b; }, 0) / sc.length : null;
    var maitrise = Math.round(q === null ? (boite - 1) / 4 * 100 : ((boite - 1) / 4 * 100) * 0.4 + q * 0.6);
    return { id: String(o["ID"]), titre: String(o["Titre"]), matiere: String(o["Matiere"]), maitrise: Math.max(0, Math.min(100, maitrise)), dues: d };
  });
  var jours = {}; scores.forEach(function (x) { var d = epParseDate_(x["Horodatage"]); if (d) jours[epJour_(d)] = 1; });
  var serie = 0, j = new Date(); if (!jours[epJour_(j)]) j.setDate(j.getDate() - 1);
  while (jours[epJour_(j)] && serie < 400) { serie++; j.setDate(j.getDate() - 1); }
  var dEx = p.dateExamen ? new Date(p.dateExamen + "T12:00:00") : null, a0 = new Date(); a0.setHours(12, 0, 0, 0);
  return { ok: true, profil: { dateExamen: p.dateExamen, noteVisee: p.noteVisee, niveau: p.niveau, rappels: p.rappels }, niveaux: Object.keys(EP2_NIVEAUX).map(function (k) { return { id: k, nom: EP2_NIVEAUX[k].nom }; }),
    joursRestants: dEx ? Math.round((dEx - a0) / 86400000) : null, serie: serie, dues: dues, modules: modules,
    examens: ex.slice(-12).map(function (e) { return { date: epDate_(e.date, "dd/MM"), note: e.note }; }),
    plan: ep2Plan_(p, mods, dues, ex), email: s.email || "", droits: ep3Droits_(s, true) };
}

function apiRev2ProfilEnregistrer(jeton, d) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  d = d || {};
  var dr = ep3Droits_(s, true);
  if (dr.niveau === "expire") return ep3Refus_("Ton essai gratuit est terminé : passe à Premium pour continuer.");
  var rappelBloque = d.rappels && !dr.premium; if (rappelBloque) d.rappels = false;
  var date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.dateExamen || "")) ? String(d.dateExamen) : "";
  var note = Math.max(0, Math.min(20, Number(d.noteVisee) || 0));
  epFeuille_(EP2.F_PROFILS, EP2_ENT.PROFILS);
  var p = ep2Profil_(s.id), champs = { "Client ID": s.id, "Date examen": date, "Note visee": note, "Niveau": EP2_NIVEAUX[d.niveau] ? d.niveau : "intermediaire", "Rappels": d.rappels ? "Oui" : "Non", "MAJ": new Date() };
  if (p._row) epMaj_(EP2.F_PROFILS, p._row, champs); else epAjouter_(EP2.F_PROFILS, champs);
  return { ok: true, msg: "Objectifs enregistrés" + (d.rappels ? " · rappel quotidien par e-mail activé" : "") + (rappelBloque ? " · le rappel quotidien par e-mail fait partie de Premium" : "") + "." };
}

// Examen blanc : questions tirées des modules choisis, réponses gardées côté serveur
function apiRev2Examen(jeton, d) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  d = d || {};
  var refus = ep3Autorise_(s, "examen"); if (refus) return refus;
  var essai = !ep3Droits_(s, true).premium;
  var p = ep2Profil_(s.id), niv = EP2_NIVEAUX[d.niveau] ? d.niveau : p.niveau, N = EP2_NIVEAUX[niv];
  var ids = (Array.isArray(d.modules) ? d.modules : []).map(String);
  var mods = ep2ModulesClient_(s).filter(function (o) { return !ids.length || ids.indexOf(String(o["ID"])) !== -1; });
  if (!mods.length) return { ok: false, msg: "Choisis au moins un module (ou crée-en un d’abord)." };
  if (!ep2Quota_("EP2EXA_" + s.id + "_" + epJour_(), 15, 86400)) return { ok: false, msg: "15 examens blancs aujourd’hui : c’est le maximum. Repose-toi, la mémoire se consolide pendant le sommeil. Reprends demain !" };
  var qcm = [], ouv = [];
  mods.forEach(function (o) {
    var c = {}; try { c = JSON.parse(o["Contenu"] || "{}"); } catch (e) {}
    (c.qcm || []).forEach(function (q) { qcm.push({ type: "qcm", module: String(o["ID"]), titre: String(o["Titre"]), q: q.q, choix: q.choix, bonne: q.bonne, explication: q.explication || "" }); });
    var cartes = c.cartes || [];
    cartes.forEach(function (k, i) {            // une carte devient un QCM : 3 mauvaises réponses prises dans les autres cartes
      if (cartes.length < 4 || String(k.verso).length > 220) return;
      var autres = ep2Melange_(cartes.filter(function (x, j) { return j !== i && x.verso !== k.verso && String(x.verso).length <= 220; })).slice(0, 3).map(function (x) { return x.verso; });
      if (autres.length < 3) return;
      var ch = ep2Melange_([k.verso].concat(autres));
      qcm.push({ type: "qcm", module: String(o["ID"]), titre: String(o["Titre"]), q: k.recto, choix: ch, bonne: ch.indexOf(k.verso), explication: "Réponse attendue : " + k.verso, carte: true });
    });
    (c.ouvertes || []).forEach(function (q) { ouv.push({ type: "ouverte", module: String(o["ID"]), titre: String(o["Titre"]), q: q.q, attendus: q.attendus || [], corrige: q.corrige || "" }); });
  });
  var nb = Math.max(5, Math.min(essai ? EP3_ESSAI.questionsExamen : 40, Number(d.nb) || 20));
  var nO = Math.min(ouv.length, Math.max(ouv.length ? 1 : 0, Math.round(nb * N.partOuvertes))), nQ = Math.min(qcm.length, nb - nO);
  if (nQ + nO < 3) return { ok: false, msg: "Pas assez de questions dans ces modules : ajoute un module ou un cours plus complet." };
  // on préfère les questions de QCM « vraies » aux cartes transformées, puis on mélange
  var vrais = ep2Melange_(qcm.filter(function (q) { return !q.carte; })), cartesQ = ep2Melange_(qcm.filter(function (q) { return q.carte; }));
  var tirage = vrais.slice(0, nQ).concat(cartesQ.slice(0, Math.max(0, nQ - vrais.length)));
  var qs = ep2Melange_(tirage).concat(ep2Melange_(ouv).slice(0, nO)).map(function (q, i) {
    if (q.type === "qcm") { var ord = ep2Melange_(q.choix.map(function (c, j) { return j; })); q.choix = ord.map(function (j) { return q.choix[j]; }); q.bonne = ord.indexOf(q.bonne); }
    q.n = i; return q;
  });
  var duree = Math.max(5, Math.min(180, Number(d.duree) || Math.ceil(qs.reduce(function (a, q) { return a + (q.type === "ouverte" ? 240 : N.secParQ); }, 0) / 60)));
  var id = ep2Id_("EXA");
  epFeuille_(EP2.F_EXAMENS, EP2_ENT.EXAMENS);
  epAjouter_(EP2.F_EXAMENS, { "ID": id, "Client ID": s.id, "Cree le": new Date(), "Modules": mods.map(function (o) { return String(o["Titre"]); }).join(" · "), "Niveau": niv,
    "Questions": JSON.stringify(qs), "Duree (min)": duree, "Statut": "En cours" });
  return { ok: true, id: id, duree: duree, niveau: N.nom, indices: N.indices,
    questions: qs.map(function (q) { return q.type === "qcm" ? { n: q.n, type: "qcm", q: q.q, choix: q.choix, titre: q.titre } : { n: q.n, type: "ouverte", q: q.q, titre: q.titre }; }) };
}

function ep2Examen_(s, id) {
  return epLire_(EP2.F_EXAMENS).filter(function (o) { return String(o["ID"]) === String(id) && String(o["Client ID"]) === s.id; })[0] || null;
}

// Indice 50/50 (niveaux débutant et intermédiaire) : retire deux mauvaises réponses
function apiRev2Indice(jeton, id, n) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep2Examen_(s, id); if (!o || String(o["Statut"]) !== "En cours") return { ok: false, msg: "Examen introuvable ou déjà rendu." };
  var max = (EP2_NIVEAUX[o["Niveau"]] || EP2_NIVEAUX.intermediaire).indices, c = CacheService.getScriptCache(), k = "EP2IND_" + id, u = Number(c.get(k) || 0);
  if (u >= max) return { ok: false, msg: max ? "Tu as utilisé tes " + max + " indice(s)." : "Pas d’indice au niveau avancé." };
  var qs = JSON.parse(o["Questions"]), q = qs.filter(function (x) { return x.n === Number(n); })[0];
  if (!q || q.type !== "qcm" || q.choix.length < 3) return { ok: false, msg: "Pas d’indice pour cette question." };
  c.put(k, String(u + 1), 21600);
  var faux = ep2Melange_(q.choix.map(function (x, j) { return j; }).filter(function (j) { return j !== q.bonne; })).slice(0, Math.min(2, q.choix.length - 2));
  return { ok: true, retirer: faux, reste: max - u - 1 };
}

// La copie est rendue : correction, note sur 20, évolution, rapport par e-mail
function apiRev2Rendre(jeton, id, rep, dureeSec) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep2Examen_(s, id); if (!o) return { ok: false, msg: "Examen introuvable." };
  if (String(o["Statut"]) === "Rendu") return { ok: false, msg: "Cette copie est déjà rendue : ouvre « Ma progression »." };
  rep = rep || {};
  var qs = JSON.parse(o["Questions"]), langues = {}, pts = 0, tot = 0, parMod = {}, detail = [];
  ep2ModulesClient_(s).forEach(function (m) { langues[String(m["ID"])] = String(m["Langue"] || "fr"); });
  qs.forEach(function (q) {
    var m = parMod[q.module] = parMod[q.module] || { titre: q.titre, pts: 0, tot: 0 };
    if (q.type === "qcm") {
      var r = rep.qcm && rep.qcm[q.n] !== undefined && rep.qcm[q.n] !== null ? Number(rep.qcm[q.n]) : -1, ok = r === q.bonne;
      tot += 1; m.tot += 1; if (ok) { pts += 1; m.pts += 1; }
      detail.push({ n: q.n, type: "qcm", q: q.q, ok: ok, ta: r >= 0 ? q.choix[r] : "(sans réponse)", bonne: q.choix[q.bonne], explication: q.explication, module: q.titre, choix: q.choix, ib: q.bonne });
    } else {
      var t = epTxt_(rep.ouvertes && rep.ouvertes[q.n], 6000), c = t.length >= 15 ? epLocCorriger_(q, t, langues[q.module] || "fr") : { note: 0, forts: [], ameliorer: ["Pas de réponse."], conseil: "" };
      var p = Math.round(c.note / 10 * 3 * 2) / 2;
      tot += 3; m.tot += 3; pts += p; m.pts += p;
      detail.push({ n: q.n, type: "ouverte", q: q.q, ok: c.note >= 6, note: c.note, points: p, forts: c.forts, ameliorer: c.ameliorer, corrige: q.corrige, module: q.titre });
    }
  });
  var note = tot ? Math.round(pts / tot * 20 * 2) / 2 : 0, duree = Number(o["Duree (min)"]) || 0;
  var horsTemps = Number(dureeSec) > duree * 60 + 120;
  var precedents = ep2Examens_(s), avant = precedents.length ? precedents[precedents.length - 1].note : null;
  var modules = Object.keys(parMod).map(function (k) { return { titre: parMod[k].titre, pct: parMod[k].tot ? Math.round(parMod[k].pts / parMod[k].tot * 100) : 0 }; }).sort(function (a, b) { return a.pct - b.pct; });
  var p = ep2Profil_(s.id);
  epMaj_(EP2.F_EXAMENS, o._row, { "Statut": "Rendu", "Rendu le": new Date(), "Note /20": note, "Points": pts, "Total": tot, "Detail": JSON.stringify(detail).slice(0, 48000) });
  epAjouter_(EP.F_REV_SCORES, { "Horodatage": new Date(), "Client ID": s.id, "Module": "Examen " + id, "Type": "Examen", "Score": note, "Total": 20, "Duree (s)": Number(dureeSec) || "" });
  // chaque module reçoit aussi son score : la « maîtrise » suit les examens blancs
  Object.keys(parMod).forEach(function (k) { if (parMod[k].tot) epAjouter_(EP.F_REV_SCORES, { "Horodatage": new Date(), "Client ID": s.id, "Module": k, "Type": "Examen blanc", "Score": parMod[k].pts, "Total": parMod[k].tot }); });
  var evolution = precedents.slice(-5).map(function (e) { return { date: epDate_(e.date, "dd/MM"), note: e.note }; }).concat([{ date: epDate_(new Date(), "dd/MM"), note: note }]);
  var conseils = [];
  if (modules.length && modules[0].pct < 60) conseils.push("Priorité : « " + modules[0].titre + " » (" + modules[0].pct + " %). Refais ses cartes et son QCM chaque jour cette semaine.");
  var fauxQ = detail.filter(function (x) { return !x.ok; });
  if (fauxQ.length) conseils.push("Refais tes " + fauxQ.length + " erreur(s) dans « Mes erreurs » demain, puis dans 3 jours : c’est la répétition espacée qui les fixe.");
  if (detail.some(function (x) { return x.type === "ouverte" && x.note < 6; })) conseils.push("Questions ouvertes : apprends le plan du corrigé (3 ou 4 idées clés), puis réécris ta réponse sans le regarder.");
  if (p.noteVisee && note < p.noteVisee) conseils.push("Objectif " + p.noteVisee + "/20 : il te manque " + (Math.round((p.noteVisee - note) * 2) / 2) + " point(s). Un examen blanc tous les 7 jours te montrera la progression.");
  if (note >= 16) conseils.push("Excellent niveau : passe au niveau « Avancé » (plus de questions ouvertes, moins de temps) pour te préparer au pire scénario.");
  var res = { ok: true, id: id, note: note, mention: ep2Mention_(note), noteRusse: ep2NoteRusse_(note), points: pts, total: tot, horsTemps: horsTemps, avant: avant,
    evolution: evolution, modules: modules, detail: detail, conseils: conseils, email: "" };
  var html = ep2RapportExamen_(s, o, res);
  if (ep2Mail_(s.email, "AssistAcad · Examen blanc : " + note.toString().replace(".", ",") + "/20 (" + res.mention + ")", html)) { res.email = s.email; epMaj_(EP2.F_EXAMENS, o._row, { "Email": s.email }); }
  return res;
}

function ep2RapportExamen_(s, o, r) {
  var barre = function (pct) { var c = pct >= 70 ? "#3E8E3A" : pct >= 50 ? "#C9A227" : "#B3261E"; return '<div style="background:#E3F0DC;border-radius:6px;height:10px;width:100%"><div style="background:' + c + ';height:10px;border-radius:6px;width:' + pct + '%"></div></div>'; };
  var evo = r.evolution.map(function (e, i) { return "<td style=\"padding:4px 8px;text-align:center;border:1px solid #DCE5D8\"><div style=\"font-size:12px;color:#4D6157\">" + e.date + "</div><b>" + String(e.note).replace(".", ",") + "</b></td>"; }).join("");
  var diff = r.avant === null ? "" : (r.note - r.avant >= 0 ? "▲ +" : "▼ ") + String(Math.round((r.note - r.avant) * 2) / 2).replace(".", ",") + " point(s) depuis le dernier examen";
  var erreurs = r.detail.filter(function (x) { return !x.ok; }).slice(0, 8).map(function (x) {
    return "<li style=\"margin:8px 0\"><b>" + epEsc_(x.q) + "</b><br>" + (x.type === "qcm" ? "Ta réponse : " + epEsc_(x.ta) + "<br>Bonne réponse : <b>" + epEsc_(x.bonne) + "</b>" + (x.explication ? "<br><span style=\"color:#4D6157\">" + epEsc_(x.explication) + "</span>" : "") : "Note : " + x.note + "/10" + (x.ameliorer && x.ameliorer.length ? "<br><span style=\"color:#4D6157\">" + epEsc_(x.ameliorer[0]) + "</span>" : "")) + "</li>";
  }).join("");
  return ep2Gabarit_("Ton examen blanc du " + epDate_(new Date()),
    "<p>Bonjour " + epEsc_(String(s.nom || "").split(" ")[0]) + ",</p>" +
    "<div style=\"text-align:center;margin:14px 0\"><div style=\"font-size:44px;font-weight:800;color:#0E2A1F\">" + String(r.note).replace(".", ",") + "<span style=\"font-size:22px\">/20</span></div>" +
    "<div style=\"font-size:17px\"><b>" + r.mention + "</b> · échelle russe : " + r.noteRusse + "</div><div style=\"color:#4D6157;margin-top:4px\">" + r.points + " / " + r.total + " points · modules : " + epEsc_(o["Modules"]) + (r.horsTemps ? " · rendu hors temps" : "") + "</div>" +
    (diff ? "<div style=\"margin-top:6px;font-weight:700;color:" + (r.note >= r.avant ? "#2C6B29" : "#B3261E") + "\">" + diff + "</div>" : "") + "</div>" +
    "<h3 style=\"font-size:16px\">Ton évolution</h3><table style=\"border-collapse:collapse\"><tr>" + evo + "</tr></table>" +
    "<h3 style=\"font-size:16px;margin-top:18px\">Par module</h3>" + r.modules.map(function (m) { return "<div style=\"margin:8px 0\"><div style=\"display:flex;justify-content:space-between\"><span>" + epEsc_(m.titre) + "</span><b>" + m.pct + " %</b></div>" + barre(m.pct) + "</div>"; }).join("") +
    (erreurs ? "<h3 style=\"font-size:16px;margin-top:18px\">À retravailler</h3><ol style=\"padding-left:18px\">" + erreurs + "</ol>" : "<p><b>Aucune erreur : bravo !</b></p>") +
    (r.conseils.length ? "<h3 style=\"font-size:16px;margin-top:18px\">Ton plan pour progresser</h3><ul>" + r.conseils.map(function (c) { return "<li style=\"margin:6px 0\">" + epEsc_(c) + "</li>"; }).join("") + "</ul>" : "") +
    "<p style=\"margin-top:18px\">Retrouve ta progression complète dans ton espace client, rubrique <b>Réviser mes cours › Ma progression</b>.</p>");
}

// « Mes erreurs » : les QCM ratés aux derniers examens, à refaire jusqu'à les réussir
function apiRev2Erreurs(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var refus = ep3Autorise_(s, "erreurs"); if (refus) return refus;
  var vus = {}, l = [];
  ep2Examens_(s).slice(-6).reverse().forEach(function (e) {
    var d = []; try { d = JSON.parse(e.detail || "[]"); } catch (x) {}
    d.forEach(function (q) {
      if (q.ok || q.type !== "qcm" || !q.choix || vus[q.q]) return;
      vus[q.q] = 1; l.push({ q: q.q, choix: q.choix, bonne: q.ib, explication: q.explication || "", module: q.module });
    });
  });
  return { ok: true, qcm: l.slice(0, 40) };
}

// « Expliquer simplement » (méthode Feynman) : la réponse est comparée à la carte
function apiRev2Expliquer(jeton, idModule, i, texte) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var refus = ep3Autorise_(s, "expliquer"); if (refus) return refus;
  var o = epRevModuleClient_(s, idModule); if (!o) return { ok: false, msg: "Module introuvable." };
  var c = JSON.parse(o["Contenu"] || "{}"), k = (c.cartes || [])[Number(i)];
  if (!k) return { ok: false, msg: "Notion introuvable." };
  texte = epTxt_(texte, 4000);
  if (texte.split(/\s+/).length < 8) return { ok: false, msg: "Explique avec au moins une ou deux phrases, comme à quelqu’un qui ne connaît pas le sujet." };
  var r = epLocCorriger_({ attendus: [k.verso], corrige: k.verso }, texte, String(o["Langue"] || "fr"));
  var simple = texte.split(/[.!?]+/).filter(function (p) { return p.trim(); }), longueur = simple.length ? texte.split(/\s+/).length / simple.length : 0;
  var conseil = longueur > 28 ? "Tes phrases sont longues (" + Math.round(longueur) + " mots en moyenne) : coupe-les. Si tu ne peux pas l’expliquer simplement, c’est qu’une partie reste floue." : r.conseil;
  epAjouter_(EP.F_REV_SCORES, { "Horodatage": new Date(), "Client ID": s.id, "Module": String(o["ID"]), "Type": "Expliquer", "Score": r.note, "Total": 10 });
  return { ok: true, note: r.note, forts: r.forts, ameliorer: r.ameliorer, conseil: conseil, reference: k.verso };
}

// Rappel quotidien (appelé par epOrchestre, une fois par jour après 18 h)
function ep2RevRappels_() {
  var jour = epJour_(), h = Number(epDate_(new Date(), "H"));
  if (h < 18 || epProp_("EP2_RAPPEL_JOUR") === jour) return 0;
  try { if (MailApp.getRemainingDailyQuota() < 25) return 0; } catch (e) {}   // on garde des e-mails pour les paiements et les commandes
  epProps_().setProperty("EP2_RAPPEL_JOUR", jour);
  var clients = {};
  if (typeof lireTable_ === "function" && typeof F_CLIENTS !== "undefined") { try { lireTable_(F_CLIENTS).forEach(function (o) { clients[String(o["ID"])] = o; }); } catch (e) {} }
  var n = 0;
  epLire_(EP2.F_PROFILS).forEach(function (pr) {
    if (String(pr["Rappels"]) !== "Oui" || String(pr["Dernier rappel"]) === jour) return;
    var c = clients[String(pr["Client ID"])]; if (!c || !c["Email"]) return;
    var s = { id: String(pr["Client ID"]), nom: String(c["Nom"] || ""), email: String(c["Email"]) };
    if (!ep3Droits_(s, false).premium) return;
    var mods = ep2ModulesClient_(s), now = Date.now(), dues = 0;
    mods.forEach(function (o) { var k = []; try { k = JSON.parse(o["Cartes"] || "[]"); } catch (e) {} dues += k.filter(function (x) { return !x.d || x.d <= now; }).length; });
    var p = ep2Profil_(s.id), plan = ep2Plan_(p, mods, dues, ep2Examens_(s));
    if (!mods.length || !plan.length) return;
    var dEx = p.dateExamen ? Math.round((new Date(p.dateExamen + "T12:00:00") - new Date()) / 86400000) : null;
    if (ep2Mail_(s.email, "AssistAcad · Ta séance du jour" + (dEx !== null && dEx >= 0 ? " (J−" + dEx + ")" : ""), ep2Gabarit_("Ta séance de révision du jour",
      "<p>Bonjour " + epEsc_(s.nom.split(" ")[0]) + ",</p>" + (dues ? "<p><b>" + dues + " carte(s)</b> t’attendent aujourd’hui.</p>" : "") +
      "<ul>" + plan[0].taches.map(function (t) { return "<li>" + epEsc_(t) + "</li>"; }).join("") + "</ul><p>20 minutes suffisent. Ouvre ton espace client › Réviser mes cours.</p>" +
      "<p style=\"font-size:12px;color:#4D6157\">Pour ne plus recevoir ce rappel : Réviser mes cours › Objectifs › décocher « rappel quotidien ».</p>"))) {
      epMaj_(EP2.F_PROFILS, pr._row, { "Dernier rappel": jour }); n++;
      try { if (MailApp.getRemainingDailyQuota() < 25) { pr = null; } } catch (e) {}
    }
  });
  return n;
}

// ════════════════════ 4. CHARTE 4.0 ET AVENANT AUX CONTRATS ════════════════════
//  La charte (servie avant par MiseAJour3.gs, version 3.1) est remplacée par la
//  version 4.0, conforme aux mises à jour 17-19. Chacun doit l'accepter à nouveau
//  avant d'entrer dans son espace. Les contrats déjà signés ne sont pas modifiés :
//  un AVENANT (n° 1) est proposé à la signature de chaque membre sous contrat.

var EP2_CHARTE_VERSION = "4.0";
var EP2_CHARTE_COMMUNS = [
  ["1. Objet et champ d’application", "Cette charte fixe les règles de confidentialité, de sécurité et de travail de toute personne qui accède à l’intranet, au bot @acades_bot, au canal @assisacad ou aux outils d’AssistAcad : employés, partenaires (spécialistes indépendants) et administration. Elle complète le contrat de chacun ; en cas de contradiction sur la confidentialité ou la sécurité, la règle la plus protectrice pour le client s’applique."],
  ["2. Confidentialité des clients", "Tout ce qui concerne un client est confidentiel : identité, contacts, établissement, sujet, consignes, fichiers, travaux, messages et paiements. Il est interdit de le copier, de le photographier, de le transmettre ou d’en parler en dehors d’AssistAcad, pendant et après la collaboration, sans limite de durée."],
  ["3. Contact avec les clients", "On échange avec un client uniquement par les canaux officiels : l’Assistance client de l’intranet et le bot @acades_bot. Il est interdit de donner son numéro, son compte personnel ou ses réseaux, de proposer un travail en dehors d’AssistAcad, ou d’orienter un client vers une autre personne ou un autre service."],
  ["4. Paiements : personne n’encaisse à la place d’AssistAcad", "Un membre ne reçoit jamais d’argent d’un client, ni directement ni par un proche. Les clients paient uniquement sur les coordonnées officielles d’AssistAcad, et seule l’administration valide un paiement, après vérification dans l’application bancaire. Toute demande d’un client de payer « à côté » doit être signalée à l’administration le jour même."],
  ["5. Accès aux outils par numéro de commande", "Les outils de travail s’ouvrent uniquement avec le numéro d’une commande qui vous est attribuée. Essayer des numéros au hasard ou ouvrir la commande d’un autre est interdit : les essais sont limités et enregistrés. Votre accès est personnel : vous ne le prêtez à personne."],
  ["6. Rédaction protégée et « Mon dossier »", "Le texte écrit dans la Rédaction, le Brouillon et les notes de travail reste dans l’intranet : ce qui y est copié ne se colle que dans l’espace AssistAcad. La conversion en Word, PDF ou autre format range le fichier dans « Mon dossier » de la commande. Il est interdit de contourner cette protection (recopier le texte ailleurs, le photographier, le capturer à l’écran, l’envoyer sur un compte personnel). Les travaux appartiennent à AssistAcad et au client."],
  ["7. Soumission et contrôle qualité", "Le travail fini est soumis à l’administration par l’onglet « Soumettre », en choisissant le fichier dans « Mon dossier » (ou la rédaction elle-même). Avant de soumettre, vous remplissez le contrôle qualité et respectez les normes de la catégorie de la commande (universités russes : ГОСТ ; européennes ; africaines). Seule l’administration livre le travail au client, après validation. Une demande de reprise se traite dans les délais indiqués."],
  ["8. Originalité et honnêteté académique", "Chaque travail est original et rédigé pour le client concerné. Les sources citées existent réellement et sont vérifiables ; inventer une référence, une donnée ou une citation est une faute grave. Le seuil d’originalité demandé (Антиплагиат ou autre logiciel) doit être atteint sans procédé de contournement. Un texte produit par un outil automatique n’est jamais livré sans être relu, vérifié et corrigé par vous."],
  ["9. Délais et disponibilité", "Vous respectez l’échéance de chaque tâche. Au moindre risque de retard, vous prévenez l’administration au plus tôt, et au plus tard 24 heures avant l’échéance, avec l’état d’avancement. Votre statut (Disponible, Occupé, En pause) et votre pointage reflètent la réalité."],
  ["10. Sécurité des comptes", "Votre compte est strictement personnel. Vous utilisez un mot de passe solide que vous ne communiquez à personne, vous ne partagez jamais un code de connexion (y compris le code de vérification envoyé par Telegram ou par e-mail) et vous fermez votre session sur un appareil partagé. Toute activité suspecte (connexion inconnue, message étrange, demande de code) est signalée immédiatement à l’administration."],
  ["11. Données personnelles", "Vous ne gardez sur vos appareils que ce qui est indispensable à la tâche en cours, et vous l’effacez dès la tâche terminée. Les coordonnées bancaires des clients ne sont visibles que de l’administration. Les données sont traitées avec les services de Google et de Telegram, dans le respect de la politique de confidentialité d’AssistAcad."],
  ["12. Traçabilité", "Pour la sécurité de tous, l’intranet enregistre les connexions, les ouvertures de commandes, les conversions, les fichiers ajoutés et les soumissions. Ces journaux servent à protéger les clients, à résoudre les litiges et à calculer la rémunération ; ils ne sont consultés que par l’administration."],
  ["13. Manquements", "Selon sa gravité, un manquement entraîne un avertissement, la suspension de l’accès ou la fin de la collaboration, dans les conditions prévues par le contrat. Une fuite de données, un encaissement direct ou un détournement de client peut en outre donner lieu à des poursuites."],
  ["14. Acceptation et nouvelles versions", "Votre acceptation est horodatée et conservée avec l’empreinte du texte accepté. Toute nouvelle version de la charte doit être acceptée avant d’accéder de nouveau à votre espace."]
];
var EP2_CHARTE_PARTENAIRE = [
  ["15. Règles propres aux partenaires", "Les clients venus par votre lien personnel vous sont confiés en priorité, mais restent des clients d’AssistAcad. Vous ne voyez et ne traitez que vos propres clients et les tâches qui vous sont attribuées. Vous ne sous-traitez aucun travail sans l’accord écrit de l’administration. Vos points et commissions sont calculés selon votre contrat de partenariat, après paiement réel et validation par l’administration."]
];
var EP2_CHARTE_EQUIPE = [
  ["15. Règles propres à l’équipe", "Vous traitez les tâches qui vous sont attribuées et les conversations de l’Assistance client qui vous sont confiées. Vous utilisez les réponses rapides et le ton AssistAcad : poli, clair, chaleureux. Les formations proposées dans l’intranet font partie du travail."]
];
var EP2_CHARTE_FAQ = [
  ["Pourquoi accepter à nouveau ?", "La version 4.0 ajoute les règles des nouveaux outils : accès par numéro de commande, rédaction protégée, « Mon dossier », soumission à l’administration, normes par catégorie d’université et paiements validés uniquement par l’administration."],
  ["Puis-je télécharger mon travail ?", "Les fichiers issus de la rédaction restent dans « Mon dossier » : l’administration les consulte et les livre. Les fichiers que vous avez ajoutés vous-même depuis votre ordinateur restent récupérables."],
  ["Un client veut me payer directement. Que faire ?", "Refusez poliment, rappelez-lui les coordonnées officielles du bot, et prévenez l’administration le jour même."],
  ["J’ai copié un texte de la rédaction et il ne se colle pas dans Word. Est-ce normal ?", "Oui. La protection empêche le texte de sortir de l’intranet. Utilisez « Convertir » : le fichier Word ou PDF est rangé dans votre dossier."]
];
function ep2Charte_(role) {
  var arts = EP2_CHARTE_COMMUNS.concat(String(role) === "partenaire" ? EP2_CHARTE_PARTENAIRE : String(role) === "admin" ? [] : EP2_CHARTE_EQUIPE);
  return { titre: "Charte de confidentialité et de travail AssistAcad", version: EP2_CHARTE_VERSION + " · octobre 2026",
    intro: "Les étudiants nous confient leurs études, leurs données et leur argent. Cette charte dit, en clair, ce que chacun s’engage à faire pour mériter cette confiance. Lisez-la entièrement : elle s’applique dès votre acceptation.",
    articles: arts, faq: EP2_CHARTE_FAQ };
}
function ep2Empreinte_(obj) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(obj), Utilities.Charset.UTF_8);
  return d.map(function (b) { var h = (b & 255).toString(16); return h.length < 2 ? "0" + h : h; }).join("").slice(0, 32);
}
function ep2CharteAcceptee_(s) {
  var c = CacheService.getScriptCache(), k = "EP2CH_" + EP2_CHARTE_VERSION + "_" + s.id;
  if (c.get(k)) return true;
  var ok = epLire_(EP2.F_CHARTE).some(function (o) { return String(o["ID"]) === String(s.id) && String(o["Version"]) === EP2_CHARTE_VERSION; });
  if (ok) c.put(k, "1", 21600);
  return ok;
}

// Avenant n° 1 : mêmes règles, en termes contractuels, signé par chaque membre sous contrat
var EP2_AVENANT_VERSION = "Avenant n° 1 — octobre 2026";
function ep2AvenantHtml_(s, contrats, signature, date, sigAdmin) {
  var e = epEsc_, part = String(s.role) === "partenaire";
  var refs = contrats.map(function (c) { return e(c.id + " (" + c.type + ")"); }).join(", ") || "le contrat en vigueur";
  var art = [
    ["Article 1 — Objet", "Le présent avenant complète " + refs + " conclu entre AssistAcad et " + e(s.nom) + ". Il intègre au contrat les nouveaux outils de travail et les règles de la Charte de confidentialité et de travail, version " + EP2_CHARTE_VERSION + ". Toutes les autres clauses du contrat restent inchangées."],
    ["Article 2 — Outils de travail et accès", "Le membre utilise les outils de l’intranet (Rédaction, Brouillon, Mon dossier, Normes, Contrôle qualité, Soumettre) pour les seules commandes qui lui sont attribuées. L’accès s’ouvre par le numéro de commande ; il est personnel et ne peut être prêté."],
    ["Article 3 — Propriété et confidentialité des travaux", "Les textes, fichiers et documents produits dans le cadre du contrat appartiennent à AssistAcad et au client concerné. Ils restent dans l’intranet : le membre s’interdit de les copier, de les exporter ou de les transmettre en dehors des outils d’AssistAcad, et de contourner les protections mises en place. Cette obligation survit à la fin du contrat sans limite de durée."],
    ["Article 4 — Remise du travail", "Le travail est remis exclusivement par l’onglet « Soumettre », à partir de « Mon dossier ». Il n’est réputé remis qu’à la réception par l’administration, qui le valide ou en demande la reprise. La livraison au client relève de la seule administration."],
    ["Article 5 — Paiements", "Le membre ne perçoit aucune somme d’un client, directement ou indirectement. Les paiements des clients sont reçus et validés exclusivement par l’administration d’AssistAcad. La rémunération du membre" + (part ? ", ses points et ses commissions" : "") + " sont dus selon le contrat, après validation du travail" + (part ? " et paiement réel du client" : "") + "."],
    ["Article 6 — Qualité et honnêteté académique", "Le membre remet un travail original, conforme aux normes de la catégorie de la commande, avec des sources réelles et vérifiables. L’invention de références ou de données et tout procédé de contournement des logiciels d’originalité constituent une faute grave."],
    ["Article 7 — Données et traçabilité", "Le membre accepte l’enregistrement des journaux d’activité décrits par la charte et s’engage à n’utiliser les données des clients que pour la tâche confiée."]
  ];
  if (part) art.push(["Article 8 — Clients rattachés", "Les clients venus par le lien personnel du partenaire restent des clients d’AssistAcad. Le partenaire ne traite que ses propres clients et les tâches attribuées, et ne sous-traite aucun travail sans accord écrit de l’administration."]);
  art.push([(part ? "Article 9" : "Article 8") + " — Entrée en vigueur", "Le présent avenant prend effet à sa signature électronique par le membre. Il est établi dans l’intranet, horodaté et conservé avec l’empreinte de son texte ; chaque partie peut en obtenir un exemplaire PDF."]);
  return '<div style="font-family:Georgia,serif;line-height:1.6;color:#111">'
    + '<h2 style="text-align:center;margin:0 0 4px">' + e(EP2_AVENANT_VERSION) + '</h2><p style="text-align:center;margin:0 0 18px">au contrat conclu avec AssistAcad</p>'
    + '<p><b>Entre</b> AssistAcad, représentée par son administration, <b>et</b> ' + e(s.nom) + ' (identifiant ' + e(s.id) + ', ' + (part ? "partenaire" : "membre de l’équipe") + ').</p>'
    + art.map(function (a) { return '<h4 style="margin:16px 0 4px">' + e(a[0]) + '</h4><p style="margin:0">' + a[1] + '</p>'; }).join("")
    + '<table style="width:100%;margin-top:26px;border-collapse:collapse"><tr><td style="width:50%;vertical-align:top;padding-right:10px"><b>Pour AssistAcad</b><br>' + (sigAdmin ? '<img src="' + sigAdmin + '" style="max-width:220px;max-height:80px">' : '<i>L’administration</i>') + '</td>'
    + '<td style="width:50%;vertical-align:top"><b>Le membre : ' + e(s.nom) + '</b><br>' + (signature ? '<img src="' + signature + '" style="max-width:220px;max-height:80px"><br>Signé électroniquement le ' + e(date) : '<i>Signature en attente</i>') + '</td></tr></table></div>';
}
function ep2AvenantDe_(id) { return epLire_(EP2.F_AVENANTS).filter(function (o) { return String(o["Employe ID"]) === String(id) && String(o["Version"]) === EP2_AVENANT_VERSION && String(o["Statut"]) === "Signé"; })[0] || null; }
function ep2Image_(driveId) { if (!driveId) return ""; try { var b = DriveApp.getFileById(String(driveId)).getBlob(); return "data:" + b.getContentType() + ";base64," + Utilities.base64Encode(b.getBytes()); } catch (e) { return ""; } }
function ep2SigAdmin_() { return ep2Image_(epProp_("EP2_AVENANT_SIG_ADMIN")); }

// Signature de l'avenant par le membre (image PNG dessinée)
function apiAvenantSigner(jeton, image) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  if (epEstAdmin_(s)) return { ok: false, msg: "L’administration signe l’avenant pour AssistAcad avec « Ma signature pour l’avenant »." };
  if (ep2AvenantDe_(s.id)) return { ok: false, msg: "Vous avez déjà signé cet avenant." };
  var m = /^data:image\/png;base64,([A-Za-z0-9+\/=]+)$/.exec(String(image || ""));
  if (!m || m[1].length < 200 || m[1].length > 600000) return { ok: false, msg: "Dessinez votre signature avant de signer." };
  var f = epDossier_("EP2_DOSSIER_SIGNATURES", "AssistAcad — Signatures (privé)").createFile(Utilities.newBlob(Utilities.base64Decode(m[1]), "image/png", "Signature avenant " + s.id + ".png"));
  var contrats = typeof apiContrats === "function" ? ((ep2ContratsBase_(jeton) || {}).contrats || []) : [];
  var texte = ep2AvenantHtml_(s, contrats, "", "", "");
  epFeuille_(EP2.F_AVENANTS, EP2_ENT.AVENANTS);
  epAjouter_(EP2.F_AVENANTS, { "ID": ep2Id_("AVE"), "Date": new Date(), "Employe ID": s.id, "Nom": s.nom || "", "Role": String(s.role || ""), "Version": EP2_AVENANT_VERSION,
    "Contrat": contrats.map(function (c) { return c.id; }).join(", "), "Signature Drive ID": f.getId(), "Empreinte": ep2Empreinte_(texte), "Statut": "Signé" });
  epAdminTg_("✍️ <b>Avenant signé</b>\n👤 " + epEsc_(s.nom || s.id) + (String(s.role) === "partenaire" ? " (partenaire)" : "") + "\n" + epEsc_(EP2_AVENANT_VERSION));
  return { ok: true, msg: "Avenant signé. Merci ! Vous pouvez en télécharger le PDF." };
}
function apiAvenantSignatureAdmin(jeton, image) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var m = /^data:image\/png;base64,([A-Za-z0-9+\/=]+)$/.exec(String(image || ""));
  if (!m || m[1].length < 200 || m[1].length > 600000) return { ok: false, msg: "Dessinez d’abord la signature." };
  var f = epDossier_("EP2_DOSSIER_SIGNATURES", "AssistAcad — Signatures (privé)").createFile(Utilities.newBlob(Utilities.base64Decode(m[1]), "image/png", "Signature AssistAcad avenant.png"));
  epProps_().setProperty("EP2_AVENANT_SIG_ADMIN", f.getId());
  return { ok: true, msg: "Signature d’AssistAcad enregistrée : elle figure sur tous les avenants." };
}
function apiAvenantPdf(jeton, idMembre) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var cible = s;
  if (idMembre && String(idMembre) !== String(s.id)) { if (!epEstAdmin_(s)) return { ok: false, msg: "Réservé à l’administration." }; cible = ep2Membre_(idMembre); if (!cible) return { ok: false, msg: "Membre introuvable." }; }
  var o = ep2AvenantDe_(cible.id); if (!o) return { ok: false, msg: "Avenant pas encore signé." };
  var contrats = String(o["Contrat"] || "").split(", ").filter(String).map(function (id) { return { id: id, type: "contrat" }; });
  var html = '<html><body style="margin:36px">' + ep2AvenantHtml_(cible, contrats, ep2Image_(o["Signature Drive ID"]), epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy HH:mm"), ep2SigAdmin_())
    + '<p style="font-size:10px;color:#555;margin-top:24px">Empreinte du texte : ' + epEsc_(o["Empreinte"]) + '</p></body></html>';
  var b = HtmlService.createHtmlOutput(html).getAs("application/pdf").setName(EP2_AVENANT_VERSION.replace(/[^0-9A-Za-zÀ-ÿ ]+/g, " ").trim() + " — " + cible.nom + ".pdf");
  return { ok: true, nom: b.getName(), mime: "application/pdf", b64: Utilities.base64Encode(b.getBytes()) };
}
var EP2_BASES = {};
function ep2ContratsBase_(jeton) { try { return (EP2_BASES.apiContrats || apiContrats)(jeton); } catch (e) { return null; } }

// Surcouches : la charte servie, l'acceptation, la version annoncée, l'avenant dans « Contrat »
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  var sess = function (j) { return typeof epMembre_ === "function" ? epMembre_(j) : null; };
  var enrober = function (nom, fn) {
    var cur = g[nom]; if (typeof cur !== "function" || cur.__ep2) return;
    EP2_BASES[nom] = cur;
    var w = function () { return fn.call(this, cur, Array.prototype.slice.call(arguments)); };
    Object.keys(cur).forEach(function (k) { w[k] = cur[k]; });
    w.__ep2 = true; g[nom] = w;
  };
  enrober("apiCharte3", function (base, a) {
    var r = base.apply(this, a), s = sess(a[0]);
    if (!r || !r.ok || !s) return r;
    r.charte = ep2Charte_(s.role); r.accepte = ep2CharteAcceptee_(s); r.version = EP2_CHARTE_VERSION;
    return r;
  });
  enrober("apiAccepterCharte3", function (base, a) {
    var s = sess(a[0]); if (!s) return base.apply(this, a);
    var r = null; try { r = base.apply(this, a); } catch (e) {}
    if (r && r.deconnecte) return r;
    if (!ep2CharteAcceptee_(s)) {
      epFeuille_(EP2.F_CHARTE, EP2_ENT.CHARTE);
      epAjouter_(EP2.F_CHARTE, { "Date": new Date(), "ID": s.id, "Nom": s.nom || "", "Role": String(s.role || ""), "Version": EP2_CHARTE_VERSION, "Empreinte": ep2Empreinte_(ep2Charte_(s.role)) });
      CacheService.getScriptCache().put("EP2CH_" + EP2_CHARTE_VERSION + "_" + s.id, "1", 21600);
    }
    return { ok: true, msg: "Charte " + EP2_CHARTE_VERSION + " acceptée." };
  });
  ["apiOutilsAccueil", "apiOutilsTache", "apiOutilsEnregistrer", "apiRapport"].forEach(function (nom) {
    enrober(nom, function (base, a) { var s = sess(a[0]); if (s && !ep2CharteOk_(s)) return EP2_CHARTE_REFUS; return base.apply(this, a); });
  });
  ["apiCrmFil2", "apiCrmRepondre2", "apiCrmPrendre", "apiRepondreDirect", "apiPrendreDirect"].forEach(function (nom) {
    enrober(nom, function (base, a) { var s = sess(a[0]); if (s && String(s.role) === "partenaire" && !ep2CharteOk_(s)) return EP2_CHARTE_REFUS; return base.apply(this, a); });
  });
  enrober("apiVersions", function (base, a) { var r = base.apply(this, a); if (r && r.ok) r.charte = EP2_CHARTE_VERSION; return r; });
  enrober("apiContrats", function (base, a) {
    var r = base.apply(this, a), s = sess(a[0]);
    if (!r || !r.ok || !s) return r;
    if (epEstAdmin_(s)) {
      var sig = {}; epLire_(EP2.F_AVENANTS).forEach(function (o) { if (String(o["Version"]) === EP2_AVENANT_VERSION && String(o["Statut"]) === "Signé") sig[String(o["Employe ID"])] = epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy"); });
      var vus = {};
      r.avenants = { version: EP2_AVENANT_VERSION, signatureAdmin: !!epProp_("EP2_AVENANT_SIG_ADMIN"),
        membres: (r.contrats || []).filter(function (c) { var k = String(c.employe || ""); if (!k || vus[k]) return false; vus[k] = 1; return true; })
          .map(function (c) { return { id: String(c.employe), nom: String(c.nom || c.employe), signe: sig[String(c.employe)] || "" }; }) };
    } else if ((r.contrats || []).length) {
      var o = ep2AvenantDe_(s.id);
      r.avenant = { version: EP2_AVENANT_VERSION, signe: o ? epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy HH:mm") : "",
        html: ep2AvenantHtml_(s, r.contrats, o ? ep2Image_(o["Signature Drive ID"]) : "", o ? epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy HH:mm") : "", ep2SigAdmin_()) };
    }
    return r;
  });
})();

// ════════════════════ 6. COMPTES CLIENTS : identifiant + mot de passe, Google, Telegram ════════════════════
//  L'espace client n'est plus ouvert par « nom + e-mail + code » : chaque client a
//  un compte personnel (identifiant + mot de passe), ou se connecte avec Google ou
//  avec Telegram (@acades_bot). L'e-mail est vérifié une fois, à la création.
//  Le compte est relié à la fiche client existante (même e-mail, ou même Telegram) :
//  commandes, commissions et révisions sont retrouvées automatiquement.

var EP3 = { F_COMPTES: "ClientsComptes", F_ABO: "RevisionAbonnements", F_ORG: "RevisionOrganisation", SESSION_JOURS: 30 };
var EP3_ENT = {
  COMPTES: ["Login", "Email", "Client ID", "Prenom", "Hash", "Sel", "Fournisseur", "Google ID", "Chat ID", "Cree le", "Derniere connexion", "Sessions depuis", "Statut"],
  ABO: ["ID", "Client ID", "Client", "Email", "Offre", "Mois", "Montant", "Statut", "Demande le", "Preuve Drive ID", "Preuve le", "Traite par", "Debut", "Fin", "Motif", "Rappel"],
  ORG: ["ID", "Client ID", "Type", "Categorie", "Titre", "Date", "Heure", "Recurrence", "Rappels", "Notes", "Statut", "Cree le", "MAJ"]
};
var EP3_REFUS_CONNEXION = { ok: false, msg: "Identifiant ou mot de passe incorrect." };

function ep3Alea_(n) { var s = ""; while (s.length < n) s += Utilities.getUuid().replace(/-/g, ""); return s.slice(0, n); }
function ep3Code_() { var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now()), s = ""; for (var i = 0; i < 6; i++) s += String((d[i] & 255) % 10); return s; }
function ep3Sha_(t) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8).map(function (b) { var h = (b & 255).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
function ep3Poivre_() { var p = epProp_("EP3_POIVRE"); if (!p) { p = ep3Alea_(48); epProps_().setProperty("EP3_POIVRE", p); } return p; }
// Mot de passe : HMAC-SHA256 répété, avec un sel par compte et un « poivre » secret du projet
function ep3Hash_(mdp, sel) {
  var p = ep3Poivre_(), h = sel + "|" + String(mdp);
  for (var i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h, p));
  return h;
}
function ep3MdpFaible_(m) {
  m = String(m || "");
  if (m.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
  if (!/[A-Za-zÀ-ÿА-Яа-я]/.test(m) || !/[0-9]/.test(m)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  if (/^(12345678|password|motdepasse|azerty|qwerty)/i.test(m)) return "Ce mot de passe est trop facile à deviner.";
  return "";
}
function ep3Login_(l) { return String(l || "").trim().toLowerCase(); }
function ep3EmailOk_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim()); }
function ep3Comptes_() { return epLire_(EP3.F_COMPTES); }
function ep3Compte_(cle) {
  cle = ep3Login_(cle); if (!cle) return null;
  return ep3Comptes_().filter(function (o) { return String(o["Statut"]) !== "Supprimé" && (ep3Login_(o["Login"]) === cle || ep3Login_(o["Email"]) === cle); })[0] || null;
}
function ep3ComptePar_(col, v) { v = String(v || ""); if (!v) return null; return ep3Comptes_().filter(function (o) { return String(o["Statut"]) !== "Supprimé" && String(o[col]) === v; })[0] || null; }

// Fiche client : on retrouve celle qui existe (même e-mail ou même Telegram), sinon on la crée
function ep3FicheClient_(email, prenom, chatId) {
  var F = typeof F_CLIENTS !== "undefined" ? F_CLIENTS : "Clients", ss = epSS_(), f = ss.getSheetByName(F);
  if (!f) { epFeuille_(F, ["ID", "Nom", "Email", "Chat ID", "Cree le", "Source"]); f = ss.getSheetByName(F); }
  var l = epLire_(F), em = ep3Login_(email);
  var o = l.filter(function (x) { return (em && ep3Login_(x["Email"]) === em) || (chatId && String(x["Chat ID"] || x["ChatID"] || x["Chat"] || "") === String(chatId)); })[0];
  if (o) return { id: String(o["ID"]), nom: String(o["Nom"] || prenom || ""), chatId: String(o["Chat ID"] || chatId || "") };
  // nouvel identifiant dans le même format que les fiches existantes (ex. CLI-0042)
  var pre = "CLI-", max = 0;
  l.forEach(function (x) { var m = /^([A-Z]{2,5}-)(\d+)$/.exec(String(x["ID"])); if (m) { pre = m[1]; max = Math.max(max, Number(m[2])); } });
  var id, lk = LockService.getScriptLock(), pris = false;
  try { lk.waitLock(5000); pris = true; } catch (e) {}
  try {
    var n = Math.max(max, Number(epProp_("EP3_CPT_CLIENT", 0))) + 1; epProps_().setProperty("EP3_CPT_CLIENT", String(n));
    id = pre + ("0000" + n).slice(-4);
    epAjouter_(F, { "ID": id, "Nom": epTxt_(prenom, 80), "Email": String(email || "").trim(), "Chat ID": chatId || "", "Cree le": new Date(), "Source": "Compte web" });
  } finally { if (pris) { try { lk.releaseLock(); } catch (e) {} } }
  return { id: id, nom: epTxt_(prenom, 80), chatId: chatId || "" };
}

// ---- Sessions des comptes (30 jours) ----
function ep3SessionCreer_(c) {
  var j = "cw" + ep3Alea_(46), now = Date.now();
  var v = { l: ep3Login_(c["Login"]), id: String(c["Client ID"]), nom: String(c["Prenom"] || ""), email: String(c["Email"] || ""), chat: String(c["Chat ID"] || ""), t: now, e: now + EP3.SESSION_JOURS * 86400000 };
  epProps_().setProperty("EP3S_" + ep3Sha_(j).slice(0, 40), JSON.stringify(v));
  epMaj_(EP3.F_COMPTES, c._row, { "Derniere connexion": new Date() });
  return { ok: true, jeton: j, nom: v.nom || v.l, id: v.id, email: v.email, login: v.l };
}
function ep3Session_(j) {
  if (typeof j !== "string" || !/^cw[0-9a-f]{46}$/.test(j)) return null;
  var k = "EP3S_" + ep3Sha_(j).slice(0, 40), c = CacheService.getScriptCache(), brut = c.get(k) || epProp_(k);
  if (!brut) return null;
  var v; try { v = JSON.parse(brut); } catch (e) { return null; }
  if (!v || v.e < Date.now()) { epProps_().deleteProperty(k); c.remove(k); return null; }
  // le compte doit exister et ne pas avoir fermé ses sessions (mot de passe changé…)
  var etat = c.get("EP3C_" + v.l);
  if (!etat) { var o = ep3Compte_(v.l); etat = o ? JSON.stringify({ s: String(o["Statut"]), d: Number(o["Sessions depuis"]) || 0, e: String(o["Email"] || ""), n: String(o["Prenom"] || "") }) : JSON.stringify({ s: "Supprimé", d: 0 }); c.put("EP3C_" + v.l, etat, 600); }
  etat = JSON.parse(etat);
  if (etat.s !== "Actif" || v.t < etat.d) return null;
  c.put(k, brut, 21600);
  return { id: v.id, nom: etat.n || v.nom || v.l, email: etat.e || v.email, chatId: v.chat, login: v.l, compte: true };
}
function ep3SessionFin_(j) { if (typeof j !== "string") return; var k = "EP3S_" + ep3Sha_(j).slice(0, 40); epProps_().deleteProperty(k); CacheService.getScriptCache().remove(k); }
function ep3FermerSessions_(c) { epMaj_(EP3.F_COMPTES, c._row, { "Sessions depuis": Date.now() }); CacheService.getScriptCache().remove("EP3C_" + ep3Login_(c["Login"])); }
function ep3NettoyerSessionsJour_() { var j = epJour_(); if (epProp_("EP3_NETTOYAGE") === j) return 0; epProps_().setProperty("EP3_NETTOYAGE", j); return ep3NettoyerSessions_(); }
function ep3NettoyerSessions_() {
  var p = epProps_().getProperties(), now = Date.now(), n = 0;
  Object.keys(p).forEach(function (k) { if (k.indexOf("EP3S_") !== 0) return; try { if (JSON.parse(p[k]).e < now) { epProps_().deleteProperty(k); n++; } } catch (e) { epProps_().deleteProperty(k); } });
  return n;
}

function ep3CreerCompte_(d) {
  epFeuille_(EP3.F_COMPTES, EP3_ENT.COMPTES);
  var fiche = ep3FicheClient_(d.email, d.prenom, d.chatId);
  var row = epAjouter_(EP3.F_COMPTES, { "Login": d.login, "Email": d.email || "", "Client ID": fiche.id, "Prenom": d.prenom || fiche.nom || "", "Hash": d.hash || "", "Sel": d.sel || "",
    "Fournisseur": d.fournisseur, "Google ID": d.google || "", "Chat ID": d.chatId || fiche.chatId || "", "Cree le": new Date(), "Sessions depuis": 0, "Statut": "Actif" });
  if (typeof audit_ === "function") { try { audit_(d.login + " (client)", "Compte client créé (" + d.fournisseur + ")", fiche.id, d.email || ""); } catch (e) {} }
  return ep3Compte_(d.login) || ep3ComptePar_("Client ID", fiche.id);
}
function ep3LoginLibre_(base) {
  base = String(base || "client").toLowerCase().replace(/[^a-z0-9._-]+/g, "").slice(0, 24) || "client";
  if (base.length < 3) base = base + "123".slice(0, 3 - base.length);
  var l = base, i = 1; while (ep3Compte_(l)) { i++; l = base + i; }
  return l;
}

// Quels moyens de connexion sont disponibles ?
function apiCompteFournisseurs() {
  var tg = !!(epProp_("TELEGRAM_TOKEN") || epProp_("BOT_TOKEN") || epProp_("TOKEN")) && ep3TelegramSur_();
  return { ok: true, google: !!(epProp_("GOOGLE_CLIENT_ID") && epProp_("GOOGLE_CLIENT_SECRET")), telegram: tg, bot: epProp_("BOT_USERNAME", "acades_bot") };
}

// 1. Créer un compte : identifiant + e-mail + mot de passe → code envoyé à l'e-mail
function apiCompteCreer(d) {
  d = d || {};
  var login = ep3Login_(d.login), email = String(d.email || "").trim(), prenom = epTxt_(d.prenom, 60);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) return { ok: false, msg: "Identifiant : 3 à 30 caractères (lettres, chiffres, point, tiret), sans espace." };
  if (!ep3EmailOk_(email)) return { ok: false, msg: "Cette adresse e-mail n’est pas valide." };
  var faible = ep3MdpFaible_(d.mdp); if (faible) return { ok: false, msg: faible };
  if (!d.accord) return { ok: false, msg: "Cochez la case d’accord sur le traitement de vos données." };
  if (!ep2Quota_("EP3INSC_" + ep3Login_(email), 4, 3600) || !ep2Quota_("EP3INSC_TOUS", 200, 3600)) return { ok: false, msg: "Trop de demandes. Réessayez dans une heure." };
  if (ep3Compte_(login)) return { ok: false, msg: "Cet identifiant est déjà pris : choisissez-en un autre." };
  if (ep3Compte_(email)) return { ok: false, msg: "Un compte existe déjà avec cet e-mail : connectez-vous, ou utilisez « Mot de passe oublié »." };
  var sel = ep3Alea_(24), code = ep3Code_(), ticket = ep3Alea_(32);
  CacheService.getScriptCache().put("EP3I_" + ticket, JSON.stringify({ login: login, email: email, prenom: prenom, sel: sel, hash: ep3Hash_(d.mdp, sel), code: ep3Sha_(code + ticket), essais: 0 }), 1800);
  var envoye = ep2Mail_(email, "AssistAcad · Votre code de création de compte : " + code, ep2Gabarit_("Créer votre compte AssistAcad",
    "<p>Bonjour" + (prenom ? " " + epEsc_(prenom) : "") + ",</p><p>Voici votre code pour terminer la création de votre compte <b>" + epEsc_(login) + "</b> :</p>" +
    "<p style=\"font-size:30px;font-weight:800;letter-spacing:6px;text-align:center;color:#0E2A1F\">" + code + "</p><p>Il est valable 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>"));
  if (!envoye) return { ok: false, msg: "Impossible d’envoyer l’e-mail pour le moment. Réessayez plus tard." };
  return { ok: true, ticket: ticket, msg: "Un code à 6 chiffres vient d’être envoyé à " + email + "." };
}
// 2. Confirmer avec le code → compte créé, session ouverte
function apiCompteConfirmer(ticket, code) {
  var c = CacheService.getScriptCache(), k = "EP3I_" + String(ticket || "").replace(/[^A-Za-z0-9]/g, ""), brut = c.get(k);
  if (!brut) return { ok: false, msg: "Demande expirée : recommencez la création du compte." };
  var d = JSON.parse(brut);
  if (d.essais >= 5) { c.remove(k); return { ok: false, msg: "Trop d’essais : recommencez la création du compte." }; }
  if (ep3Sha_(String(code || "").replace(/[^0-9]/g, "") + ticket) !== d.code) { d.essais++; c.put(k, JSON.stringify(d), 1800); return { ok: false, msg: "Code incorrect (" + (5 - d.essais) + " essai(s) restant(s))." }; }
  c.remove(k);
  if (ep3Compte_(d.login) || ep3Compte_(d.email)) return { ok: false, msg: "Ce compte vient d’être créé : connectez-vous." };
  var compte = ep3CreerCompte_({ login: d.login, email: d.email, prenom: d.prenom, hash: d.hash, sel: d.sel, fournisseur: "Mot de passe" });
  ep2Mail_(d.email, "AssistAcad · Bienvenue dans votre espace", ep2Gabarit_("Votre compte est prêt", "<p>Bonjour" + (d.prenom ? " " + epEsc_(d.prenom) : "") + ",</p><p>Votre compte <b>" + epEsc_(d.login) + "</b> est créé. Vous pouvez désormais vous connecter avec votre identifiant (ou votre e-mail) et votre mot de passe.</p><p>Bonne découverte : commencez par « Réviser mes cours », votre essai gratuit vous attend.</p>"));
  return ep3SessionCreer_(compte);
}
// Connexion : identifiant (ou e-mail) + mot de passe
function apiCompteConnexion(identifiant, mdp) {
  var cle = ep3Login_(identifiant), c = CacheService.getScriptCache(), kb = "EP3ECH_" + ep3Sha_(cle).slice(0, 20), n = Number(c.get(kb) || 0);
  if (!cle || !mdp) return EP3_REFUS_CONNEXION;
  if (n >= 8) return { ok: false, msg: "Trop d’essais : compte bloqué 15 minutes. Utilisez « Mot de passe oublié » si besoin." };
  if (!ep2Quota_("EP3CNX_TOUS", 600, 600)) return { ok: false, msg: "Service momentanément saturé. Réessayez dans quelques minutes." };
  var o = ep3Compte_(cle);
  if (!o || String(o["Statut"]) !== "Actif" || !o["Hash"] || ep3Hash_(mdp, String(o["Sel"])) !== String(o["Hash"])) {
    c.put(kb, String(n + 1), 900);
    if (n + 1 === 8 && o && o["Email"]) ep2Mail_(String(o["Email"]), "AssistAcad · Tentatives de connexion", ep2Gabarit_("Votre compte est protégé", "<p>Plusieurs mots de passe faux ont été saisis pour votre compte <b>" + epEsc_(o["Login"]) + "</b>. Il est bloqué 15 minutes. Si ce n’était pas vous, changez votre mot de passe dans « Mon compte ».</p>"));
    if (o && !o["Hash"]) return { ok: false, msg: "Ce compte se connecte avec " + (String(o["Fournisseur"]) || "Google ou Telegram") + " : utilisez le bouton correspondant, ou « Mot de passe oublié » pour créer un mot de passe." };
    return EP3_REFUS_CONNEXION;
  }
  c.remove(kb);
  return ep3SessionCreer_(o);
}
// Mot de passe oublié : code envoyé à l'e-mail du compte (réponse identique si le compte n'existe pas)
function apiCompteOubli(identifiant) {
  var o = ep3Compte_(identifiant), ticket = ep3Alea_(32), generique = { ok: true, ticket: ticket, msg: "Si un compte correspond, un code vient d’être envoyé à son adresse e-mail." };
  if (!o || !o["Email"] || !ep2Quota_("EP3OUBLI_" + ep3Login_(o["Login"]), 4, 3600)) return generique;
  var code = ep3Code_();
  CacheService.getScriptCache().put("EP3R_" + ticket, JSON.stringify({ login: ep3Login_(o["Login"]), code: ep3Sha_(code + ticket), essais: 0 }), 1800);
  ep2Mail_(String(o["Email"]), "AssistAcad · Code pour changer votre mot de passe : " + code, ep2Gabarit_("Mot de passe oublié", "<p>Voici votre code pour choisir un nouveau mot de passe (compte <b>" + epEsc_(o["Login"]) + "</b>) :</p><p style=\"font-size:30px;font-weight:800;letter-spacing:6px;text-align:center\">" + code + "</p><p>Valable 30 minutes. Si vous n’avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.</p>"));
  return generique;
}
function apiCompteReinit(ticket, code, mdp) {
  var c = CacheService.getScriptCache(), k = "EP3R_" + String(ticket || "").replace(/[^A-Za-z0-9]/g, ""), brut = c.get(k);
  if (!brut) return { ok: false, msg: "Code incorrect ou expiré." };
  var d = JSON.parse(brut);
  if (d.essais >= 5) { c.remove(k); return { ok: false, msg: "Trop d’essais : redemandez un code." }; }
  if (ep3Sha_(String(code || "").replace(/[^0-9]/g, "") + ticket) !== d.code) { d.essais++; c.put(k, JSON.stringify(d), 1800); return { ok: false, msg: "Code incorrect ou expiré." }; }
  var faible = ep3MdpFaible_(mdp); if (faible) return { ok: false, msg: faible };
  var o = ep3Compte_(d.login); if (!o) return { ok: false, msg: "Compte introuvable." };
  c.remove(k);
  var sel = ep3Alea_(24);
  epMaj_(EP3.F_COMPTES, o._row, { "Hash": ep3Hash_(mdp, sel), "Sel": sel });
  ep3FermerSessions_(o);
  c.remove("EP3ECH_" + ep3Sha_(ep3Login_(o["Login"])).slice(0, 20));
  return ep3SessionCreer_(ep3Compte_(d.login));
}

// « Mon compte » (dans l'espace client)
function apiCompteInfos(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep3ComptePar_("Client ID", s.id);
  if (!o) return { ok: true, compte: false, email: s.email || "", msg: "Vous êtes connecté par code e-mail. Créez un mot de passe pour vous connecter plus vite." };
  return { ok: true, compte: true, login: String(o["Login"]), email: String(o["Email"] || ""), prenom: String(o["Prenom"] || ""), motDePasse: !!o["Hash"], google: !!o["Google ID"], telegram: !!o["Chat ID"],
    cree: epDate_(epParseDate_(o["Cree le"]) || new Date()), fournisseurs: apiCompteFournisseurs() };
}
function apiCompteMdp(jeton, ancien, nouveau) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep3ComptePar_("Client ID", s.id);
  if (!o) {   // client venu par l'ancien code e-mail : il crée son compte depuis son espace
    if (!ep3EmailOk_(s.email)) return { ok: false, msg: "Adresse e-mail manquante sur votre fiche : écrivez au bot." };
    var f0 = ep3MdpFaible_(nouveau); if (f0) return { ok: false, msg: f0 };
    var sel0 = ep3Alea_(24);
    ep3CreerCompte_({ login: ep3LoginLibre_(String(s.email).split("@")[0]), email: s.email, prenom: String(s.nom || "").split(" ")[0], hash: ep3Hash_(nouveau, sel0), sel: sel0, fournisseur: "Mot de passe" });
    var c0 = ep3ComptePar_("Client ID", s.id) || ep3Compte_(s.email);
    return { ok: true, msg: "Compte créé. Votre identifiant : " + (c0 ? c0["Login"] : s.email) + " (ou votre e-mail)." };
  }
  if (o["Hash"] && ep3Hash_(ancien, String(o["Sel"])) !== String(o["Hash"])) return { ok: false, msg: "Mot de passe actuel incorrect." };
  var f = ep3MdpFaible_(nouveau); if (f) return { ok: false, msg: f };
  var sel = ep3Alea_(24);
  epMaj_(EP3.F_COMPTES, o._row, { "Hash": ep3Hash_(nouveau, sel), "Sel": sel });
  ep3FermerSessions_(o);
  var nv = ep3SessionCreer_(ep3ComptePar_("Client ID", s.id));
  if (o["Email"]) ep2Mail_(String(o["Email"]), "AssistAcad · Mot de passe modifié", ep2Gabarit_("Mot de passe modifié", "<p>Le mot de passe de votre compte <b>" + epEsc_(o["Login"]) + "</b> vient d’être modifié. Les autres appareils ont été déconnectés. Si ce n’était pas vous, utilisez « Mot de passe oublié » tout de suite.</p>"));
  return { ok: true, msg: "Mot de passe modifié. Les autres appareils sont déconnectés.", jeton: nv.jeton };
}

// Ajouter ou changer l'e-mail du compte (vérifié par un code)
function apiCompteEmail(jeton, email) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep3ComptePar_("Client ID", s.id); if (!o) return { ok: false, msg: "Créez d’abord votre mot de passe dans « Mon compte »." };
  email = String(email || "").trim();
  if (!ep3EmailOk_(email)) return { ok: false, msg: "Cette adresse e-mail n’est pas valide." };
  var autre = ep3Compte_(email); if (autre && String(autre["Login"]) !== String(o["Login"])) return { ok: false, msg: "Cette adresse est déjà utilisée par un autre compte." };
  if (!ep2Quota_("EP3MAIL_" + s.id, 4, 3600)) return { ok: false, msg: "Trop de demandes : réessayez dans une heure." };
  var code = ep3Code_(), t = ep3Alea_(32);
  CacheService.getScriptCache().put("EP3M_" + t, JSON.stringify({ login: ep3Login_(o["Login"]), email: email, code: ep3Sha_(code + t), essais: 0 }), 1800);
  if (!ep2Mail_(email, "AssistAcad · Code de vérification : " + code, ep2Gabarit_("Vérifier votre adresse e-mail", "<p>Votre code pour relier cette adresse à votre compte <b>" + epEsc_(o["Login"]) + "</b> :</p><p style=\"font-size:30px;font-weight:800;letter-spacing:6px;text-align:center\">" + code + "</p>"))) return { ok: false, msg: "Impossible d’envoyer l’e-mail pour le moment." };
  return { ok: true, ticket: t, msg: "Code envoyé à " + email + "." };
}
function apiCompteEmailConfirmer(jeton, t, code) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var c = CacheService.getScriptCache(), k = "EP3M_" + String(t || "").replace(/[^A-Za-z0-9]/g, ""), brut = c.get(k);
  if (!brut) return { ok: false, msg: "Code expiré : redemandez-en un." };
  var d = JSON.parse(brut), o = ep3Compte_(d.login);
  if (!o || String(o["Client ID"]) !== String(s.id)) return { ok: false, msg: "Compte introuvable." };
  if (d.essais >= 5) { c.remove(k); return { ok: false, msg: "Trop d’essais." }; }
  if (ep3Sha_(String(code || "").replace(/[^0-9]/g, "") + t) !== d.code) { d.essais++; c.put(k, JSON.stringify(d), 1800); return { ok: false, msg: "Code incorrect." }; }
  c.remove(k);
  epMaj_(EP3.F_COMPTES, o._row, { "Email": d.email });
  c.remove("EP3C_" + d.login);
  return { ok: true, msg: "Adresse e-mail enregistrée : " + d.email + "." };
}

// ---- Google (OAuth 2, redirection vers l'adresse /exec) ----
function ep3UrlApp_() { return epProp_("WEBAPP_URL") || ScriptApp.getService().getUrl(); }
function apiCompteGoogleDebut() {
  var id = epProp_("GOOGLE_CLIENT_ID"); if (!id || !epProp_("GOOGLE_CLIENT_SECRET")) return { ok: false, msg: "La connexion Google n’est pas encore activée." };
  if (!ep2Quota_("EP3G_TOUS", 300, 600)) return { ok: false, msg: "Réessayez dans quelques minutes." };
  var t = ep3Alea_(32);
  CacheService.getScriptCache().put("EP3G_" + t, JSON.stringify({ etat: "attente" }), 900);
  var url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + encodeURIComponent(id) + "&redirect_uri=" + encodeURIComponent(ep3UrlApp_()) +
    "&response_type=code&scope=" + encodeURIComponent("openid email profile") + "&prompt=select_account&state=G" + t;
  return { ok: true, url: url, ticket: t };
}
function ep3B64url_(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString("UTF-8"); }
// Appelé par doGet au retour de Google (?code=…&state=G…)
function ep3GoogleRetour_(code, t) {
  var c = CacheService.getScriptCache(), k = "EP3G_" + t, brut = c.get(k);
  if (!brut || JSON.parse(brut).etat !== "attente") return;
  var res = { etat: "erreur", msg: "Connexion Google refusée." };
  try {
    var r = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", { method: "post", muteHttpExceptions: true,
      payload: { code: code, client_id: epProp_("GOOGLE_CLIENT_ID"), client_secret: epProp_("GOOGLE_CLIENT_SECRET"), redirect_uri: ep3UrlApp_(), grant_type: "authorization_code" } });
    var j = JSON.parse(r.getContentText() || "{}");
    if (r.getResponseCode() === 200 && j.id_token) {
      var p = JSON.parse(ep3B64url_(String(j.id_token).split(".")[1]));
      var iss = String(p.iss || "");
      if (p.aud === epProp_("GOOGLE_CLIENT_ID") && (iss === "https://accounts.google.com" || iss === "accounts.google.com") && p.email && (p.email_verified === true || p.email_verified === "true") && Number(p.exp) * 1000 > Date.now())
        res = { etat: "ok", email: String(p.email), nom: String(p.given_name || p.name || ""), sub: String(p.sub) };
    }
  } catch (e) { res = { etat: "erreur", msg: "Google ne répond pas : réessayez." }; }
  c.put(k, JSON.stringify(res), 600);
}
function apiCompteGoogleFin(t) {
  var c = CacheService.getScriptCache(), k = "EP3G_" + String(t || "").replace(/[^A-Za-z0-9]/g, ""), brut = c.get(k);
  if (!brut) return { ok: false, msg: "Connexion Google expirée : recommencez." };
  var r = JSON.parse(brut);
  if (r.etat === "attente") return { ok: false, attente: true, msg: "En attente de Google…" };
  c.remove(k);
  if (r.etat !== "ok") return { ok: false, msg: r.msg };
  var o = ep3ComptePar_("Google ID", r.sub) || ep3Compte_(r.email);
  if (o && String(o["Statut"]) !== "Actif") return { ok: false, msg: "Ce compte est désactivé." };
  if (!o) o = ep3CreerCompte_({ login: ep3LoginLibre_(r.email.split("@")[0]), email: r.email, prenom: r.nom, fournisseur: "Google", google: r.sub });
  else if (!o["Google ID"]) epMaj_(EP3.F_COMPTES, o._row, { "Google ID": r.sub });
  return ep3SessionCreer_(o);
}

// ---- Telegram : le client confirme sa connexion dans @acades_bot ----
function ep3TelegramSur_() {
  // sans la protection du webhook (Securite.gs), un faux message pourrait confirmer une connexion : on refuse
  if (typeof cleWebhook_ !== "function") return false;
  return !!cleWebhook_() && epProp_("WEBHOOK_PROTEGE") === "OUI";
}
function apiCompteTgDebut() {
  if (!apiCompteFournisseurs().telegram) return { ok: false, msg: "La connexion par Telegram n’est pas disponible pour le moment." };
  if (!ep2Quota_("EP3T_TOUS", 300, 600)) return { ok: false, msg: "Réessayez dans quelques minutes." };
  var t = ep3Alea_(24);
  CacheService.getScriptCache().put("EP3T_" + t, JSON.stringify({ etat: "attente" }), 600);
  return { ok: true, ticket: t, lien: "https://t.me/" + epProp_("BOT_USERNAME", "acades_bot") + "?start=LG" + t };
}
function apiCompteTgEtat(t) {
  var c = CacheService.getScriptCache(), k = "EP3T_" + String(t || "").replace(/[^A-Za-z0-9]/g, ""), brut = c.get(k);
  if (!brut) return { ok: false, msg: "Demande expirée : recommencez." };
  var r = JSON.parse(brut);
  if (r.etat !== "ok") return { ok: false, attente: true };
  c.remove(k);
  var o = ep3ComptePar_("Chat ID", r.chat);
  if (o && String(o["Statut"]) !== "Actif") return { ok: false, msg: "Ce compte est désactivé." };
  if (!o) o = ep3CreerCompte_({ login: ep3LoginLibre_(r.pseudo || ("tg" + String(r.chat).slice(-6))), email: "", prenom: r.prenom, fournisseur: "Telegram", chatId: r.chat });
  return ep3SessionCreer_(o);
}
function ep3TgApi_(methode, donnees) {
  var token = epProp_("TELEGRAM_TOKEN") || epProp_("BOT_TOKEN") || epProp_("TOKEN"); if (!token) return;
  try { UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/" + methode, { method: "post", contentType: "application/json", muteHttpExceptions: true, payload: JSON.stringify(donnees) }); } catch (e) {}
}
// Lu par doPost : renvoie true si le message concernait une connexion (il n'est alors pas transmis au bot)
function ep3TgMessage_(e) {
  var b; try { b = JSON.parse(e.postData.contents); } catch (x) { return false; }
  var m = b && b.message, q = b && b.callback_query;
  if (m && typeof m.text === "string" && /^\/start LG[A-Za-z0-9]{24}$/.test(m.text.trim())) {
    if (!ep3TelegramSur_() || (typeof webhookAutorise_ === "function" && !webhookAutorise_(e))) return true;
    var t = m.text.trim().slice(9), c = CacheService.getScriptCache(), brut = c.get("EP3T_" + t);
    if (!brut || JSON.parse(brut).etat !== "attente") { ep3TgApi_("sendMessage", { chat_id: m.chat.id, text: "Ce lien de connexion a expiré. Recommencez depuis la page AssistAcad." }); return true; }
    c.put("EP3T_" + t, JSON.stringify({ etat: "confirmer", chat: String(m.chat.id) }), 600);
    ep3TgApi_("sendMessage", { chat_id: m.chat.id, parse_mode: "HTML", text: "🔐 <b>Connexion à votre espace client AssistAcad</b>\nQuelqu’un demande à ouvrir votre espace sur une page web. Si c’est bien vous, confirmez. Sinon, ignorez ce message.",
      reply_markup: { inline_keyboard: [[{ text: "✅ Oui, c’est moi", callback_data: "LGOK:" + t }]] } });
    return true;
  }
  if (q && typeof q.data === "string" && /^LGOK:[A-Za-z0-9]{24}$/.test(q.data)) {
    if (!ep3TelegramSur_() || (typeof webhookAutorise_ === "function" && !webhookAutorise_(e))) return true;
    var t2 = q.data.slice(5), c2 = CacheService.getScriptCache(), b2 = c2.get("EP3T_" + t2), chat = String(q.message && q.message.chat ? q.message.chat.id : (q.from || {}).id);
    var r2 = b2 ? JSON.parse(b2) : null;
    if (!r2 || r2.etat !== "confirmer" || r2.chat !== chat) { ep3TgApi_("answerCallbackQuery", { callback_query_id: q.id, text: "Lien expiré : recommencez depuis la page." }); return true; }
    c2.put("EP3T_" + t2, JSON.stringify({ etat: "ok", chat: chat, prenom: String((q.from || {}).first_name || ""), pseudo: String((q.from || {}).username || "") }), 600);
    ep3TgApi_("answerCallbackQuery", { callback_query_id: q.id, text: "Connexion autorisée ✅" });
    if (q.message) ep3TgApi_("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text: "✅ Connexion autorisée. Retournez sur la page AssistAcad : votre espace s’ouvre." });
    return true;
  }
  return false;
}

// ════════════════════ 7. RÉVISION : ESSAI GRATUIT ET PREMIUM ════════════════════
//  Prix calculés sur le salaire minimum russe (МРОТ) : 27 093 ₽ par mois depuis le
//  1er janvier 2026 (loi fédérale du 28/11/2025). À mettre à jour chaque janvier
//  dans « Abonnements Premium » (administration).
var EP3_MROT_DEFAUT = 27093;
var EP3_OFFRES = {
  mois: { nom: "1 mois", mois: 1, pct: 2 },
  trimestre: { nom: "3 mois (un semestre de révisions)", mois: 3, pct: 5 },
  annee: { nom: "Année universitaire (10 mois)", mois: 10, pct: 15 }
};
var EP3_ESSAI = { modules: 2, examens: 1, questionsExamen: 10, organisation: 5 };
var EP3_PREMIUM_SEUL = { ouvertes: "les questions ouvertes corrigées", expliquer: "« Expliquer simplement »", erreurs: "« Mes erreurs »", packs: "les packs AssistAcad", rappels: "le rappel quotidien par e-mail" };

function ep3Mrot_() { return Math.max(5000, Number(epProp_("EP3_MROT", EP3_MROT_DEFAUT)) || EP3_MROT_DEFAUT); }
function ep3EssaiJours_() { return Math.max(0, Math.min(30, Number(epProp_("EP3_ESSAI_JOURS", 7)))); }
function ep3Prix_(k) {
  var o = EP3_OFFRES[k]; if (!o) return 0;
  var fixe = Number(epProp_("EP3_PRIX_" + k, 0)); if (fixe > 0) return Math.round(fixe);
  return Math.ceil(ep3Mrot_() * o.pct / 100 / 10) * 10 - 1;
}
function ep3Offres_() {
  return Object.keys(EP3_OFFRES).map(function (k) { var p = ep3Prix_(k), o = EP3_OFFRES[k]; return { id: k, nom: o.nom, mois: o.mois, montant: p, parMois: Math.round(p / o.mois), parJour: Math.round(p / (o.mois * 30.4) * 10) / 10 }; });
}
function ep3AboActif_(clientId) {
  var now = Date.now(), best = null;
  epLire_(EP3.F_ABO).forEach(function (o) {
    if (String(o["Client ID"]) !== String(clientId) || String(o["Statut"]) !== "Actif") return;
    var f = epParseDate_(o["Fin"]); if (f && f.getTime() > now && (!best || f > best.fin)) best = { id: String(o["ID"]), fin: f, offre: String(o["Offre"]) };
  });
  return best;
}
function ep3EssaiDebut_(clientId, demarrer) {
  var o = epLire_(EP2.F_PROFILS).filter(function (x) { return String(x["Client ID"]) === String(clientId); })[0];
  var d = o ? epParseDate_(o["Essai debut"]) : null;
  if (d || !demarrer) return d;
  d = new Date();
  epFeuille_(EP2.F_PROFILS, EP2_ENT.PROFILS);
  if (o) epMaj_(EP2.F_PROFILS, o._row, { "Essai debut": epJour_(d) });
  else epAjouter_(EP2.F_PROFILS, { "Client ID": clientId, "Niveau": "intermediaire", "Rappels": "Non", "Essai debut": epJour_(d), "MAJ": new Date() });
  return d;
}
// Les droits du client : premium, essai en cours, ou essai terminé
function ep3Droits_(s, demarrer) {
  var abo = ep3AboActif_(s.id), now = new Date();
  var att = epLire_(EP3.F_ABO).filter(function (o) { return String(o["Client ID"]) === s.id && /^(En attente de paiement|Preuve reçue)$/.test(String(o["Statut"])); }).map(function (o) { return { id: String(o["ID"]), statut: String(o["Statut"]), offre: String(o["Offre"]), montant: Number(o["Montant"]) || 0 }; });
  if (abo) return { niveau: "premium", premium: true, fin: epDate_(abo.fin), joursRestants: Math.ceil((abo.fin - now) / 86400000), attente: att };
  var deb = ep3EssaiDebut_(s.id, demarrer !== false), jours = ep3EssaiJours_();
  var fin = new Date((deb || now).getTime() + Math.max(0, jours - 1) * 86400000);   // le jour du début compte : 7 jours = aujourd'hui + 6
  fin.setHours(23, 59, 59, 0);
  if (!jours) fin = new Date(now.getTime() - 1000);
  var actif = fin.getTime() > now.getTime();
  return { niveau: actif ? "essai" : "expire", premium: false, essai: { debut: deb ? epDate_(deb) : epDate_(now), fin: epDate_(fin), joursRestants: Math.max(0, Math.ceil((fin - now) / 86400000)), jours: jours },
    limites: EP3_ESSAI, attente: att };
}
function ep3Refus_(msg) { return { ok: false, premium: true, msg: msg }; }
// Contrôle d'accès, côté serveur, pour chaque fonction de révision
function ep3Autorise_(s, action, d) {
  var dr = ep3Droits_(s, true);
  if (dr.premium) return null;
  if (dr.niveau === "expire") return ep3Refus_("Ton essai gratuit de " + dr.essai.jours + " jours est terminé. Passe à Premium pour retrouver tes modules, tes examens blancs, ta progression et l’organisation de tes cours.");
  if (EP3_PREMIUM_SEUL[action]) return ep3Refus_("Pendant l’essai, " + EP3_PREMIUM_SEUL[action] + " " + (action === "ouvertes" || action === "erreurs" || action === "packs" ? "sont réservés" : "est réservé") + " à Premium. Passe à Premium pour tout débloquer.");
  if (action === "module.creer") {
    var n = epLire_(EP.F_REV).filter(function (o) { return String(o["Client ID"]) === s.id; }).length;
    if (n >= EP3_ESSAI.modules) return ep3Refus_("L’essai gratuit permet " + EP3_ESSAI.modules + " modules de révision. Passe à Premium pour en créer autant que tu veux.");
  }
  if (action === "examen") {
    var x = epLire_(EP2.F_EXAMENS).filter(function (o) { return String(o["Client ID"]) === s.id; }).length;
    if (x >= EP3_ESSAI.examens) return ep3Refus_("L’essai gratuit comprend " + EP3_ESSAI.examens + " examen blanc. Passe à Premium pour t’entraîner autant que nécessaire, avec ton évolution et le rapport par e-mail.");
  }
  if (action === "org.ajouter") {
    var k = epLire_(EP3.F_ORG).filter(function (o) { return String(o["Client ID"]) === s.id && String(o["Statut"]) !== "Supprimé"; }).length;
    if (k >= EP3_ESSAI.organisation && !(d && d.id)) return ep3Refus_("L’essai gratuit permet " + EP3_ESSAI.organisation + " éléments dans l’organisation. Passe à Premium pour organiser tous tes cours, devoirs et examens.");
  }
  return null;
}

function apiPremiumEtat(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var dr = ep3Droits_(s, true);
  var mes = epLire_(EP3.F_ABO).filter(function (o) { return String(o["Client ID"]) === s.id; }).reverse().slice(0, 10).map(function (o) {
    return { id: String(o["ID"]), offre: String(o["Offre"]), montant: Number(o["Montant"]) || 0, statut: String(o["Statut"]), date: epDate_(epParseDate_(o["Demande le"]) || new Date()),
      fin: o["Fin"] ? epDate_(epParseDate_(o["Fin"]) || new Date()) : "", motif: String(o["Motif"] || "") };
  });
  var enAttente = mes.some(function (x) { return x.statut === "En attente de paiement"; }), c = ep3Coord_();
  return { ok: true, droits: dr, offres: ep3Offres_(), mrot: ep3Mrot_(), demandes: mes, email: s.email || "", paiement: ep3Paiement_(),
    coord: enAttente ? { numero: ep3NumFormat_(c.numero), titulaire: c.titulaire, banque: c.banque } : null };
}
function ep3Paiement_() { return epProp_("EP3_PAIEMENT") || epProp_("CV_PAIEMENT") || ""; }
// Coordonnées où le client envoie l'argent (Propriétés du script, saisies par l'administration — jamais dans le code)
function ep3Coord_() { return { banque: epProp_("PAY_BANQUE"), numero: epProp_("PAY_NUMERO"), titulaire: epProp_("PAY_TITULAIRE"), note: ep3Paiement_() }; }
function ep3NumFormat_(n) { var d = String(n || "").replace(/[\s-]+/g, ""); return /^\d{16,19}$/.test(d) ? d.replace(/(\d{4})(?=\d)/g, "$1 ") : String(n || "").trim(); }
function ep3BlocPaiementHtml_(montant, ref) {
  var c = ep3Coord_(), m = Number(montant || 0).toLocaleString("fr-FR"), td = "padding:8px 12px;border-bottom:1px solid #DCE5D8;vertical-align:top", l = [];
  if (c.numero) l.push(["Carte / compte", "<b style=\"font-size:19px;letter-spacing:1px;font-family:Consolas,monospace\">" + epEsc_(ep3NumFormat_(c.numero)) + "</b>"]);
  if (c.titulaire) l.push(["Titulaire", "<b>" + epEsc_(c.titulaire) + "</b>"]);
  if (c.banque) l.push(["Banque", epEsc_(c.banque)]);
  l.push(["Montant exact", "<b>" + m + " ₽</b>"]); l.push(["Commentaire du virement", "<b>" + epEsc_(ref) + "</b>"]);
  return "<div style=\"background:#F3F6F1;border:2px solid #3E8E3A;border-radius:12px;padding:6px 6px 10px;margin:14px 0\"><div style=\"font-weight:800;color:#0E2A1F;padding:8px 12px\">💳 Où envoyer le paiement</div>" +
    "<table style=\"border-collapse:collapse;width:100%\">" + l.map(function (x) { return "<tr><td style=\"" + td + ";color:#4D6157;width:42%\">" + x[0] + "</td><td style=\"" + td + "\">" + x[1] + "</td></tr>"; }).join("") + "</table>" +
    (c.numero ? "" : "<p style=\"padding:6px 12px;margin:0;color:#B3261E\">Les coordonnées de paiement vous sont envoyées par @acades_bot.</p>") +
    (c.note ? "<p style=\"padding:6px 12px 0;margin:0;white-space:pre-line\">" + epEsc_(c.note) + "</p>" : "") + "</div>";
}
function ep3TextePaiement_() { var c = ep3Coord_(); return [c.numero ? "Carte / compte : " + ep3NumFormat_(c.numero) : "", c.titulaire ? "Titulaire : " + c.titulaire : "", c.banque ? "Banque : " + c.banque : "", c.note || ""].filter(String).join(" · "); }
// « S'abonner » : la demande est enregistrée et les instructions de paiement partent par e-mail
function apiPremiumSouscrire(jeton, offre) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var O = EP3_OFFRES[offre]; if (!O) return { ok: false, msg: "Choisis une offre." };
  if (!ep3EmailOk_(s.email)) return { ok: false, msg: "Ajoute d’abord ton adresse e-mail dans « Mon compte » : les instructions de paiement y sont envoyées." };
  if (!ep2Quota_("EP3SOUS_" + s.id, 6, 3600)) return { ok: false, msg: "Trop de demandes : réessaie dans une heure." };
  epFeuille_(EP3.F_ABO, EP3_ENT.ABO);
  var montant = ep3Prix_(offre);
  var att = epLire_(EP3.F_ABO).filter(function (o) { return String(o["Client ID"]) === s.id && String(o["Statut"]) === "En attente de paiement"; })[0], id;
  if (att) { id = String(att["ID"]); epMaj_(EP3.F_ABO, att._row, { "Offre": O.nom, "Mois": O.mois, "Montant": montant, "Demande le": new Date() }); }
  else { id = ep2Id_("ABO"); epAjouter_(EP3.F_ABO, { "ID": id, "Client ID": s.id, "Client": s.nom || "", "Email": s.email, "Offre": O.nom, "Mois": O.mois, "Montant": montant, "Statut": "En attente de paiement", "Demande le": new Date() }); }
  var m = montant.toLocaleString("fr-FR");
  var envoye = ep2Mail_(s.email, "AssistAcad Premium · Instructions de paiement (" + id + ")", ep2Gabarit_("Votre abonnement Premium",
    "<p>Bonjour " + epEsc_(String(s.nom || "").split(" ")[0]) + ",</p><p>Merci pour votre choix ! Voici votre demande :</p>" +
    "<table style=\"border-collapse:collapse;margin:10px 0\"><tr><td style=\"padding:6px 12px;border:1px solid #DCE5D8\">Numéro</td><td style=\"padding:6px 12px;border:1px solid #DCE5D8\"><b>" + id + "</b></td></tr>" +
    "<tr><td style=\"padding:6px 12px;border:1px solid #DCE5D8\">Offre</td><td style=\"padding:6px 12px;border:1px solid #DCE5D8\">Premium · " + epEsc_(O.nom) + "</td></tr>" +
    "<tr><td style=\"padding:6px 12px;border:1px solid #DCE5D8\">Montant</td><td style=\"padding:6px 12px;border:1px solid #DCE5D8\"><b>" + m + " ₽</b></td></tr></table>" +
    ep3BlocPaiementHtml_(montant, id) +
    "<h3 style=\"font-size:16px\">Comment payer</h3><ol><li>Envoyez <b>" + m + " ₽</b> sur la carte (ou le compte) ci-dessus.</li><li>Indiquez en commentaire du paiement : <b>" + id + "</b>.</li>" +
    "<li>Envoyez la capture du paiement dans votre espace : <b>Réviser mes cours › Premium › Envoyer la preuve</b>.</li>" +
    "<li>L’administration vérifie le paiement et active votre Premium. Vous recevez un e-mail de confirmation.</li></ol>" +
    "<p style=\"color:#4D6157\">Payez uniquement sur les coordonnées officielles d’AssistAcad. Aucun membre de l’équipe ne reçoit d’argent à titre personnel.</p>"));
  epAdminTg_("⭐ <b>Demande Premium</b>\n👤 " + epEsc_(s.nom || s.id) + "\n🔖 " + id + " · " + epEsc_(O.nom) + " · " + m + " ₽\n<i>En attente du paiement.</i>");
  return { ok: true, id: id, montant: montant, email: envoye ? s.email : "", msg: envoye ? "Les instructions de paiement viennent d’être envoyées à " + s.email + " (pensez à regarder les courriers indésirables)." : "Demande enregistrée (" + id + "). L’e-mail n’a pas pu partir : les coordonnées s’affichent ci-dessous.", paiement: ep3Paiement_() };
}
function apiPremiumPreuve(jeton, id, fichier) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = epLire_(EP3.F_ABO).filter(function (x) { return String(x["ID"]) === String(id) && String(x["Client ID"]) === s.id; })[0];
  if (!o || !/^(En attente de paiement|Preuve reçue)$/.test(String(o["Statut"]))) return { ok: false, msg: "Demande introuvable ou déjà traitée." };
  if (!fichier || !fichier.b64 || !/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/i.test(String(fichier.mime || ""))) return { ok: false, msg: "Joins une capture (JPG, PNG) ou un PDF du paiement." };
  var oc; try { oc = ep2Fichier_(fichier.b64, fichier.nom, EP2.PREUVE_MAX_KO); } catch (x) { return { ok: false, msg: x.message }; }
  var f = epDossier_("EP3_DOSSIER_PREUVES", "AssistAcad — Preuves Premium").createFile(Utilities.newBlob(oc, fichier.mime, "Premium " + id + " — " + epTxt_(fichier.nom, 80)));
  epMaj_(EP3.F_ABO, o._row, { "Statut": "Preuve reçue", "Preuve Drive ID": f.getId(), "Preuve le": new Date() });
  epAdminTg_("⭐ <b>Preuve de paiement Premium</b>\n👤 " + epEsc_(s.nom || s.id) + "\n🔖 " + id + " · " + (Number(o["Montant"]) || 0) + " ₽\n<i>À vérifier dans l’application bancaire, puis à activer : Outils › Abonnements Premium.</i>");
  return { ok: true, msg: "Preuve reçue. L’administration vérifie le paiement et active ton Premium : tu seras prévenu(e) par e-mail." };
}
function apiPremiumAnnuler(jeton, id) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = epLire_(EP3.F_ABO).filter(function (x) { return String(x["ID"]) === String(id) && String(x["Client ID"]) === s.id; })[0];
  if (!o || String(o["Statut"]) !== "En attente de paiement") return { ok: false, msg: "Seule une demande pas encore payée peut être annulée." };
  epMaj_(EP3.F_ABO, o._row, { "Statut": "Annulé" });
  return { ok: true, msg: "Demande annulée." };
}
// Administration
function apiPremiumAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var l = epLire_(EP3.F_ABO).reverse().slice(0, 200).map(function (o) {
    return { id: String(o["ID"]), client: String(o["Client"]), email: String(o["Email"]), offre: String(o["Offre"]), mois: Number(o["Mois"]) || 0, montant: Number(o["Montant"]) || 0, statut: String(o["Statut"]),
      date: epDate_(epParseDate_(o["Demande le"]) || new Date(), "dd/MM/yyyy HH:mm"), preuve: !!o["Preuve Drive ID"], fin: o["Fin"] ? epDate_(epParseDate_(o["Fin"]) || new Date()) : "", motif: String(o["Motif"] || "") };
  });
  var actifs = l.filter(function (x) { return x.statut === "Actif"; });
  return { ok: true, liste: l, attente: l.filter(function (x) { return x.statut === "Preuve reçue"; }).length, actifs: actifs.length,
    reglages: { mrot: ep3Mrot_(), essaiJours: ep3EssaiJours_(), paiement: epProp_("EP3_PAIEMENT", ""), banque: epProp_("PAY_BANQUE"), numero: epProp_("PAY_NUMERO"), titulaire: epProp_("PAY_TITULAIRE"), offres: Object.keys(EP3_OFFRES).map(function (k) { return { id: k, nom: EP3_OFFRES[k].nom, pct: EP3_OFFRES[k].pct, fixe: Number(epProp_("EP3_PRIX_" + k, 0)) || 0, montant: ep3Prix_(k) }; }) } };
}
function apiPremiumPreuveVoir(jeton, id) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = epLire_(EP3.F_ABO).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o || !o["Preuve Drive ID"]) return { ok: false, msg: "Pas de preuve pour cette demande." };
  var b = DriveApp.getFileById(String(o["Preuve Drive ID"])).getBlob();
  return { ok: true, nom: b.getName(), mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}
function apiPremiumDecider(jeton, id, decision, motif) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = epLire_(EP3.F_ABO).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o) return { ok: false, msg: "Demande introuvable." };
  var st = String(o["Statut"]);
  if (decision === "valider") {
    if (!/^(En attente de paiement|Preuve reçue)$/.test(st)) return { ok: false, msg: "Déjà traitée (" + st + ")." };
    var act = ep3AboActif_(o["Client ID"]), debut = act ? act.fin : new Date(), fin = new Date(debut.getTime());
    fin.setMonth(fin.getMonth() + (Number(o["Mois"]) || 1));
    epMaj_(EP3.F_ABO, o._row, { "Statut": "Actif", "Traite par": a.nom || a.id, "Debut": debut, "Fin": fin });
    ep2Mail_(String(o["Email"]), "AssistAcad · Premium activé jusqu’au " + epDate_(fin), ep2Gabarit_("Bienvenue dans Premium ⭐",
      "<p>Bonjour " + epEsc_(String(o["Client"]).split(" ")[0]) + ",</p><p>Votre paiement (" + epEsc_(id) + ") est vérifié : <b>Premium est actif jusqu’au " + epDate_(fin) + "</b>.</p><p>Tout est débloqué : modules illimités, examens blancs, questions ouvertes corrigées, « Expliquer simplement », « Mes erreurs », packs AssistAcad, organisation complète et rappels par e-mail.</p>"));
    return { ok: true, msg: "Premium activé jusqu’au " + epDate_(fin) + ". Client prévenu par e-mail." };
  }
  if (decision === "refuser") {
    motif = epTxt_(motif, 300); if (!motif) return { ok: false, msg: "Indique le motif : il est envoyé au client." };
    if (st === "Actif") return { ok: false, msg: "Déjà actif." };
    epMaj_(EP3.F_ABO, o._row, { "Statut": "Refusé", "Traite par": a.nom || a.id, "Motif": motif });
    ep2Mail_(String(o["Email"]), "AssistAcad · Votre demande Premium " + id, ep2Gabarit_("Paiement non confirmé", "<p>Nous n’avons pas pu confirmer le paiement de votre demande <b>" + epEsc_(id) + "</b>.</p><p><b>Motif :</b> " + epEsc_(motif) + "</p><p>Vous pouvez renvoyer une preuve ou nous écrire sur @acades_bot.</p>"));
    return { ok: true, msg: "Demande refusée, motif envoyé au client." };
  }
  return { ok: false, msg: "Décision inconnue." };
}
function apiPremiumReglages(jeton, d) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  d = d || {}; var P = epProps_();
  if (d.mrot !== undefined) { var m = Number(d.mrot); if (!(m >= 5000 && m <= 300000)) return { ok: false, msg: "МРОТ : indique un montant mensuel en roubles (ex. 27093)." }; P.setProperty("EP3_MROT", String(Math.round(m))); }
  if (d.essaiJours !== undefined) P.setProperty("EP3_ESSAI_JOURS", String(Math.max(0, Math.min(30, Math.round(Number(d.essaiJours) || 0)))));
  if (d.paiement !== undefined) P.setProperty("EP3_PAIEMENT", epTxt_(d.paiement, 600));
  if (d.numero !== undefined) {
    var nu = String(d.numero || "").replace(/[^0-9A-Za-z ]+/g, "").replace(/\s+/g, " ").trim(), chiffres = nu.replace(/\s/g, "");
    if (nu && !(/^\d{16,19}$/.test(chiffres) || /^\d{20}$/.test(chiffres) || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(chiffres))) return { ok: false, msg: "Numéro : une carte (16 à 19 chiffres), un compte russe (20 chiffres) ou un IBAN." };
    if (nu) P.setProperty("PAY_NUMERO", nu); else P.deleteProperty("PAY_NUMERO");
    if (typeof audit_ === "function") { try { audit_(a.nom || a.id, "Coordonnées de paiement modifiées", "", ""); } catch (e) {} }
  }
  if (d.titulaire !== undefined) P.setProperty("PAY_TITULAIRE", epTxt_(d.titulaire, 80));
  if (d.banque !== undefined) P.setProperty("PAY_BANQUE", epTxt_(d.banque, 80));
  Object.keys(EP3_OFFRES).forEach(function (k) { if (d["prix_" + k] !== undefined) { var v = Math.round(Number(d["prix_" + k]) || 0); if (v > 0) P.setProperty("EP3_PRIX_" + k, String(v)); else P.deleteProperty("EP3_PRIX_" + k); } });
  return { ok: true, msg: "Réglages Premium enregistrés.", reglages: apiPremiumAdmin(jeton).reglages };
}
// L'administration s'envoie l'e-mail tel que le client le reçoit
function apiPremiumTestMail(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var m = ep2Membre_(a.id), to = (m && m.email) || epProp_("CONTACT_EMAIL");
  if (!ep3EmailOk_(to)) return { ok: false, msg: "Ajoute ton adresse e-mail dans la feuille des membres." };
  var ok = ep2Mail_(to, "TEST · AssistAcad Premium · Instructions de paiement (ABO-TEST)", ep2Gabarit_("Votre abonnement Premium (exemple)", "<p>Exemple de l’e-mail reçu par un client après « S’abonner » :</p>" + ep3BlocPaiementHtml_(ep3Prix_("mois"), "ABO-TEST")));
  return ok ? { ok: true, msg: "E-mail de test envoyé à " + to + "." } : { ok: false, msg: "Envoi impossible (quota d’e-mails ?)." };
}

// Rappels de fin d'abonnement (appelé par epOrchestre, au plus une fois par heure)
function ep3PremiumRappels_() {
  var hh = epDate_(new Date(), "yyyy-MM-dd HH"); if (epProp_("EP3_ABO_HEURE") === hh) return 0; epProps_().setProperty("EP3_ABO_HEURE", hh);
  var now = Date.now(), n = 0;
  epLire_(EP3.F_ABO).forEach(function (o) {
    if (String(o["Statut"]) !== "Actif") return;
    var f = epParseDate_(o["Fin"]); if (!f) return;
    var j = Math.ceil((f.getTime() - now) / 86400000);
    if (j <= 0) {
      epMaj_(EP3.F_ABO, o._row, { "Statut": "Expiré" });
      if (!ep3AboActif_(o["Client ID"])) ep2Mail_(String(o["Email"]), "AssistAcad · Votre Premium est terminé", ep2Gabarit_("Premium terminé", "<p>Votre abonnement Premium est arrivé à son terme. Vos modules, vos examens et votre organisation sont conservés : renouvelez dans <b>Réviser mes cours › Premium</b> pour les retrouver.</p>"));
      n++;
    } else if (j <= 3 && String(o["Rappel"]) !== "J-3") {
      epMaj_(EP3.F_ABO, o._row, { "Rappel": "J-3" });
      ep2Mail_(String(o["Email"]), "AssistAcad · Votre Premium se termine le " + epDate_(f), ep2Gabarit_("Plus que " + j + " jour(s) de Premium", "<p>Votre abonnement se termine le <b>" + epDate_(f) + "</b>. Pour ne pas interrompre vos révisions, renouvelez dans <b>Réviser mes cours › Premium</b> : la nouvelle période commence à la fin de l’actuelle.</p>"));
      n++;
    }
  });
  return n;
}

// ════════════════════ 8. ORGANISATION : cours, devoirs, examens, programme ════════════════════
var EP3_TYPES_ORG = {
  examen: { nom: "Examen", ico: "📝", rappels: [7, 3, 1, 0] }, devoir: { nom: "Devoir à rendre", ico: "📚", rappels: [3, 1, 0] },
  cours: { nom: "Cours", ico: "🎓", rappels: [] }, revision: { nom: "Séance de révision", ico: "🔁", rappels: [0] },
  programme: { nom: "Programme / événement", ico: "🗓️", rappels: [7, 1] }
};
var EP3_HEURES = [7, 12, 18, 20];
function ep3OrgReglages_(clientId) {
  var o = epLire_(EP2.F_PROFILS).filter(function (x) { return String(x["Client ID"]) === String(clientId); })[0] || {};
  var h = Number(o["Org heure"]);
  return { _row: o._row || 0, alertes: String(o["Org alertes"] || "Oui") !== "Non", heure: EP3_HEURES.indexOf(h) !== -1 ? h : 18, hebdo: String(o["Org hebdo"] || "Oui") !== "Non", dernier: String(o["Org dernier envoi"] || ""), hebdoFait: String(o["Org hebdo fait"] || "") };
}
function ep3OrgVue_(o) {
  var r = []; try { r = JSON.parse(o["Rappels"] || "[]"); } catch (e) {}
  return { id: String(o["ID"]), type: String(o["Type"]), categorie: String(o["Categorie"] || ""), titre: String(o["Titre"]), date: String(o["Date"] || ""), heure: String(o["Heure"] || ""),
    recurrence: String(o["Recurrence"] || ""), rappels: r, notes: String(o["Notes"] || ""), fait: String(o["Statut"]) === "Fait" };
}
function ep3OrgItems_(s) { return epLire_(EP3.F_ORG).filter(function (o) { return String(o["Client ID"]) === s.id && String(o["Statut"]) !== "Supprimé"; }); }
function apiOrgListe(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var items = ep3OrgItems_(s).map(ep3OrgVue_).sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : (a.date || "9") > (b.date || "9") ? 1 : (a.heure < b.heure ? -1 : 1); });
  var cats = {}; items.forEach(function (i) { if (i.categorie) cats[i.categorie] = (cats[i.categorie] || 0) + 1; });
  var r = ep3OrgReglages_(s.id);
  return { ok: true, items: items, categories: Object.keys(cats).sort(), types: Object.keys(EP3_TYPES_ORG).map(function (k) { return { id: k, nom: EP3_TYPES_ORG[k].nom, ico: EP3_TYPES_ORG[k].ico, rappels: EP3_TYPES_ORG[k].rappels }; }),
    reglages: { alertes: r.alertes, heure: r.heure, hebdo: r.hebdo }, heures: EP3_HEURES, aujourdhui: epJour_(), droits: ep3Droits_(s, true), email: s.email || "" };
}
function apiOrgEnregistrer(jeton, d) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  d = d || {};
  var refus = ep3Autorise_(s, "org.ajouter", d); if (refus) return refus;
  var type = EP3_TYPES_ORG[d.type] ? d.type : "devoir", titre = epTxt_(d.titre, 140);
  if (!titre) return { ok: false, msg: "Donne un titre (ex. « Partiel de macroéconomie »)." };
  var date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || "")) ? String(d.date) : "";
  if (!date && type !== "programme") return { ok: false, msg: "Indique la date." };
  var heure = /^\d{2}:\d{2}$/.test(String(d.heure || "")) ? String(d.heure) : "";
  var rap = (Array.isArray(d.rappels) ? d.rappels : []).map(Number).filter(function (x) { return [0, 1, 2, 3, 7, 14].indexOf(x) !== -1; });
  var champs = { "Type": type, "Categorie": epTxt_(d.categorie, 60), "Titre": titre, "Date": date, "Heure": heure, "Recurrence": d.recurrence === "hebdo" && type === "cours" ? "hebdo" : "",
    "Rappels": JSON.stringify(rap.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return b - a; })), "Notes": epTxt_(d.notes, 1000), "MAJ": new Date() };
  epFeuille_(EP3.F_ORG, EP3_ENT.ORG);
  if (d.id) {
    var o = ep3OrgItems_(s).filter(function (x) { return String(x["ID"]) === String(d.id); })[0];
    if (!o) return { ok: false, msg: "Élément introuvable." };
    epMaj_(EP3.F_ORG, o._row, champs);
    return { ok: true, id: String(d.id), msg: "Modifié." };
  }
  var id = ep2Id_("ORG"); champs["ID"] = id; champs["Client ID"] = s.id; champs["Statut"] = "À faire"; champs["Cree le"] = new Date();
  epAjouter_(EP3.F_ORG, champs);
  return { ok: true, id: id, msg: EP3_TYPES_ORG[type].ico + " Ajouté" + (rap.length ? " · rappels par e-mail : " + rap.map(function (x) { return x === 0 ? "le jour même" : "J-" + x; }).join(", ") : "") + "." };
}
function apiOrgFait(jeton, id, fait) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep3OrgItems_(s).filter(function (x) { return String(x["ID"]) === String(id); })[0]; if (!o) return { ok: false, msg: "Élément introuvable." };
  epMaj_(EP3.F_ORG, o._row, { "Statut": fait ? "Fait" : "À faire", "MAJ": new Date() });
  return { ok: true };
}
function apiOrgSupprimer(jeton, id) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var o = ep3OrgItems_(s).filter(function (x) { return String(x["ID"]) === String(id); })[0]; if (!o) return { ok: false, msg: "Élément introuvable." };
  epMaj_(EP3.F_ORG, o._row, { "Statut": "Supprimé", "MAJ": new Date() });
  return { ok: true, msg: "Supprimé." };
}
function apiOrgReglages(jeton, d) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  d = d || {};
  epFeuille_(EP2.F_PROFILS, EP2_ENT.PROFILS);
  ep3EssaiDebut_(s.id, true);
  var r = ep3OrgReglages_(s.id), h = EP3_HEURES.indexOf(Number(d.heure)) !== -1 ? Number(d.heure) : 18;
  epMaj_(EP2.F_PROFILS, r._row || ep3OrgReglages_(s.id)._row, { "Org alertes": d.alertes ? "Oui" : "Non", "Org heure": h, "Org hebdo": d.hebdo ? "Oui" : "Non", "MAJ": new Date() });
  return { ok: true, msg: d.alertes ? "Alertes activées : un e-mail à " + h + " h les jours où tu as quelque chose à préparer." : "Alertes par e-mail désactivées." };
}
// Prochaine date d'un élément (les cours « chaque semaine » se répètent)
function ep3OrgProchaine_(i, aujourdhui) {
  if (!i.date) return "";
  if (i.recurrence !== "hebdo" || i.date >= aujourdhui) return i.date;
  var d = new Date(i.date + "T12:00:00"), a = new Date(aujourdhui + "T12:00:00");
  var diff = Math.ceil((a - d) / 86400000 / 7) * 7; d.setDate(d.getDate() + diff);
  return epJour_(d);
}
function ep3Ecart_(date, aujourdhui) { return Math.round((new Date(date + "T12:00:00") - new Date(aujourdhui + "T12:00:00")) / 86400000); }
// Alertes par e-mail : un seul message par jour et par étudiant, à l'heure qu'il a choisie (appelé par epOrchestre)
function ep3OrgAlertes_() {
  var h = Number(epDate_(new Date(), "H")), jour = epJour_(), dimanche = epDate_(new Date(), "u") === "7", n = 0;
  var cle = jour + " " + h; if (h < EP3_HEURES[0] || epProp_("EP3_ORG_PASSAGE") === cle) return 0; epProps_().setProperty("EP3_ORG_PASSAGE", cle);
  try { if (MailApp.getRemainingDailyQuota() < 25) return 0; } catch (e) {}
  var parClient = {};
  epLire_(EP3.F_ORG).forEach(function (o) { if (String(o["Statut"]) === "Supprimé") return; (parClient[String(o["Client ID"])] = parClient[String(o["Client ID"])] || []).push(ep3OrgVue_(o)); });
  var fiches = {}; if (typeof lireTable_ === "function" && typeof F_CLIENTS !== "undefined") { try { lireTable_(F_CLIENTS).forEach(function (o) { fiches[String(o["ID"])] = o; }); } catch (e) {} }
  var comptes = {}; ep3Comptes_().forEach(function (o) { comptes[String(o["Client ID"])] = o; });
  Object.keys(parClient).forEach(function (cid) {
    var r = ep3OrgReglages_(cid); if (!r.alertes || h < r.heure || r.dernier === jour || !r._row) return;
    var email = String((comptes[cid] || {})["Email"] || (fiches[cid] || {})["Email"] || ""); if (!ep3EmailOk_(email)) return;
    var s = { id: cid, nom: String((comptes[cid] || {})["Prenom"] || (fiches[cid] || {})["Nom"] || ""), email: email };
    if (ep3Droits_(s, false).niveau === "expire") return;
    var lignes = [], retard = [], semaine = [];
    parClient[cid].forEach(function (i) {
      if (i.fait) return;
      var d = ep3OrgProchaine_(i, jour); if (!d) return;
      var e = ep3Ecart_(d, jour), T = EP3_TYPES_ORG[i.type] || EP3_TYPES_ORG.devoir;
      var lib = T.ico + " <b>" + epEsc_(i.titre) + "</b>" + (i.categorie ? " · " + epEsc_(i.categorie) : "") + (i.heure ? " · " + i.heure : "");
      if (i.rappels.indexOf(e) !== -1) lignes.push((e === 0 ? "Aujourd’hui" : e === 1 ? "Demain" : "Dans " + e + " jours") + " — " + lib + (i.type === "examen" && e > 0 ? "<br><span style=\"color:#4D6157\">Conseil : un examen blanc chronométré et 15 minutes de cartes aujourd’hui.</span>" : ""));
      if (i.type === "devoir" && e < 0 && e >= -7) retard.push(lib + " (prévu le " + epDate_(new Date(d + "T12:00:00")) + ")");
      if (dimanche && r.hebdo && e >= 1 && e <= 7 && i.type !== "cours") semaine.push(epDate_(new Date(d + "T12:00:00"), "dd/MM") + " — " + lib);
    });
    var hebdo = dimanche && r.hebdo && semaine.length && r.hebdoFait !== jour;
    if (!lignes.length && !retard.length && !hebdo) return;
    var corps = "<p>Bonjour " + epEsc_(String(s.nom).split(" ")[0]) + ",</p>" +
      (lignes.length ? "<h3 style=\"font-size:16px\">À préparer</h3><ul>" + lignes.map(function (x) { return "<li style=\"margin:6px 0\">" + x + "</li>"; }).join("") + "</ul>" : "") +
      (retard.length ? "<h3 style=\"font-size:16px;color:#B3261E\">En retard</h3><ul>" + retard.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "") +
      (hebdo ? "<h3 style=\"font-size:16px\">Ta semaine</h3><ul>" + semaine.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "") +
      "<p>Ouvre ton espace client › <b>Organisation</b> pour cocher ce qui est fait, ou › <b>Réviser mes cours</b> pour t’entraîner.</p><p style=\"font-size:12px;color:#4D6157\">Ces alertes se règlent dans Organisation › Paramètres.</p>";
    if (ep2Mail_(email, "AssistAcad · " + (lignes.length ? lignes.length + " rappel(s) pour tes études" : hebdo ? "Ta semaine d’études" : "Devoir en retard"), ep2Gabarit_("Ton organisation", corps))) {
      var ch = { "Org dernier envoi": jour }; if (hebdo) ch["Org hebdo fait"] = jour;
      epMaj_(EP2.F_PROFILS, r._row, ch); n++;
      try { if (MailApp.getRemainingDailyQuota() < 25) return; } catch (e) {}
    }
  });
  return n;
}

// Surcouches : sessions des comptes, connexion Google/Telegram, droits Premium sur la révision
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  // 1. Les jetons des comptes sont reconnus partout où l'espace client est vérifié
  if (typeof g.sessCli_ === "function" && !g.sessCli_.__ep3) {
    var sc = g.sessCli_;
    g.sessCli_ = function (j) { var r = null; try { r = sc.apply(this, arguments); } catch (e) {} if (r && r.id) return r; return ep3Session_(j); };
    g.sessCli_.__ep3 = true;
  } else if (typeof g.sessCli_ !== "function") { g.sessCli_ = function (j) { return ep3Session_(j); }; g.sessCli_.__ep3 = true; }
  var env = function (nom, fn) {
    var cur = g[nom]; if (typeof cur !== "function" || cur.__ep3) return;
    var w = function () { return fn.call(this, cur, Array.prototype.slice.call(arguments)); };
    Object.keys(cur).forEach(function (k) { w[k] = cur[k]; }); w.__ep3 = true; g[nom] = w;
  };
  env("apiCliReprendre", function (base, a) { var s = ep3Session_(a[0]); if (s) return { ok: true, jeton: a[0], nom: s.nom, id: s.id, email: s.email, login: s.login }; return base.apply(this, a); });
  env("apiCliQuitter", function (base, a) { if (ep3Session_(a[0])) { ep3SessionFin_(a[0]); return { ok: true }; } return base.apply(this, a); });
  // 2. Google revient sur l'adresse /exec avec ?code=…&state=G…
  env("doGet", function (base, a) {
    var e = a[0] || {}, p = e.parameter || {};
    if (p.code && /^G[A-Za-z0-9]{32}$/.test(String(p.state || ""))) { try { ep3GoogleRetour_(String(p.code), String(p.state).slice(1)); } catch (x) {} }
    return base.apply(this, a);
  });
  // 3. Telegram : « /start LG… » et la confirmation sont traités ici, le reste va au bot
  env("doPost", function (base, a) {
    var e = a[0];
    try { if (e && e.postData && ep3TgMessage_(e)) return ContentService.createTextOutput("ok"); } catch (x) {}
    return base.apply(this, a);
  });
  // 4. Droits Premium sur les fonctions de révision d'EspacePlus.gs
  var garde = function (nom, action, extra) {
    env(nom, function (base, a) {
      var s = epClient_(a[0]); if (!s) return base.apply(this, a);
      var refus = ep3Autorise_(s, action); if (refus) return refus;
      var r = base.apply(this, a);
      if (extra) r = extra(r, s, a);
      return r;
    });
  };
  garde("apiRevCreer", "module.creer"); garde("apiRevModule", "module.ouvrir"); garde("apiRevResultat", "module.ouvrir");
  garde("apiRevCorriger", "ouvertes"); garde("apiRevAjouterPack", "packs");
  env("apiRevAccueil", function (base, a) {
    var r = base.apply(this, a), s = epClient_(a[0]);
    if (r && r.ok && s) {
      r.droits = ep3Droits_(s, true); r.offres = ep3Offres_();
      if (!r.droits.premium) { var faits = epLire_(EP.F_REV).filter(function (o) { return String(o["Client ID"]) === s.id; }).length; r.quotaMax = EP3_ESSAI.modules; r.quota = Math.max(0, EP3_ESSAI.modules - faits); }
    }
    return r;
  });
})();

// ════════════════════ 10. LOGICIEL AssistAcad : accès de l'équipe et des partenaires ════════════════════
//  Le lien web reste ouvert aux CLIENTS. Quand l'obligation est activée (réglage de
//  l'administration), l'espace équipe et l'espace partenaire ne s'ouvrent plus que
//  dans le logiciel AssistAcad installé sur un appareil activé avec un code fourni
//  par l'administration. Chaque appareil a un secret (jamais visible par la page) :
//  à chaque connexion, le logiciel signe un défi envoyé par le serveur. L'administration
//  voit les appareils, leur dernière activité, et peut les désactiver à distance :
//  les sessions ouvertes sur cet appareil se ferment aussitôt.

var EP4 = { F_APP: "AppareilsAssistAcad", F_TESTS: "FormationTests", F_LECT: "FormationLectures" };
var EP4_ENT = {
  APP: ["ID", "Membre ID", "Membre", "Role", "Nom appareil", "Systeme", "Version", "Active le", "Derniere activite", "Statut", "Motif"],
  TESTS: ["ID", "Membre ID", "Nom", "Debut", "Fin", "Score", "Statut", "Questions", "Reponses"],
  LECT: ["Membre ID", "Nom", "Debut lecture", "Fin lecture", "Minutes"]
};
var EP4_LIRE = null;   // lireSession_ d'origine (sans le contrôle de l'appareil)
var EP4_REFUS_APP = { ok: false, app: true, msg: "L’espace équipe et l’espace partenaire s’ouvrent uniquement dans le logiciel AssistAcad, sur un appareil activé. Demandez votre code d’activation à l’administration." };

function ep4Hmac_(cle, valeur) { return Utilities.computeHmacSha256Signature(String(valeur), String(cle)).map(function (b) { var h = (b & 255).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
function ep4Oblige_(s) {
  if (!s || epProp_("APP_OBLIGATOIRE") !== "OUI") return false;
  var r = String(s.role || "");
  if (r === "client") return false;
  if (r === "admin") return epProp_("APP_ADMIN") === "OUI";
  return true;
}
function ep4Appareils_() { return epLire_(EP4.F_APP); }
function ep4Appareil_(id) {
  var c = CacheService.getScriptCache(), k = "APPST_" + id, v = c.get(k);
  if (v) return JSON.parse(v);
  var o = ep4Appareils_().filter(function (x) { return String(x["ID"]) === String(id); })[0];
  var r = o ? { id: String(o["ID"]), membre: String(o["Membre ID"]), statut: String(o["Statut"]), mobile: /^📱/.test(String(o["Systeme"] || "")), _row: o._row } : { statut: "Inconnu" };
  c.put(k, JSON.stringify(r), 60);
  return r;
}
function ep4Liaison_(j) {
  if (typeof j !== "string") return "";
  var k = "APPL_" + ep3Sha_(j).slice(0, 40), c = CacheService.getScriptCache(), v = c.get(k) || epProp_(k);
  if (!v) return "";
  try { var o = JSON.parse(v); if (o.e < Date.now()) { epProps_().deleteProperty(k); return ""; } c.put(k, v, 21600); return o.a; } catch (e) { return ""; }
}
function ep4Lier_(j, app) { var v = JSON.stringify({ a: app, e: Date.now() + 31 * 86400000 }), k = "APPL_" + ep3Sha_(j).slice(0, 40); epProps_().setProperty(k, v); CacheService.getScriptCache().put(k, v, 21600); }
function ep4Activite_(app, version) {
  var c = CacheService.getScriptCache(); if (c.get("APPV_" + app) && !version) return; c.put("APPV_" + app, "1", 300);
  var o = ep4Appareils_().filter(function (x) { return String(x["ID"]) === String(app); })[0];
  if (o) { var ch = { "Derniere activite": new Date() }; if (version) ch["Version"] = epTxt_(version, 20); epMaj_(EP4.F_APP, o._row, ch); }
}
function ep4Nettoyer_() {
  var p = epProps_().getProperties(), now = Date.now(), n = 0;
  Object.keys(p).forEach(function (k) { if (k.indexOf("APPL_") !== 0 && k.indexOf("APPC_") !== 0) return; try { if (JSON.parse(p[k]).e < now) { epProps_().deleteProperty(k); n++; } } catch (e) {} });
  return n;
}
function ep4VersionInf_(a, b) {   // a < b ?
  var x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number);
  for (var i = 0; i < 3; i++) { if ((x[i] || 0) < (y[i] || 0)) return true; if ((x[i] || 0) > (y[i] || 0)) return false; }
  return false;
}

// ---- Pour l'interface ----
function apiAppConfig() { return { ok: true, obligatoire: epProp_("APP_OBLIGATOIRE") === "OUI", lien: epProp_("APP_LIEN", ""), lienClient: epProp_("APP_CLIENT_LIEN", "") }; }
function apiAppDefi() {
  if (!ep2Quota_("APPD_TOUS", 1500, 600)) return { ok: false, msg: "Réessayez dans quelques minutes." };
  var n = ep3Alea_(32); CacheService.getScriptCache().put("APPN_" + n, "1", 180);
  return { ok: true, nonce: n };
}
// Le logiciel prouve qu'il est bien un appareil activé : il signe le défi avec son secret
function apiAppPreuve(id, nonce, sig) {
  var c = CacheService.getScriptCache(); nonce = String(nonce || "");
  if (!/^[0-9a-f]{32}$/.test(nonce) || !c.get("APPN_" + nonce)) return { ok: false, msg: "Défi expiré : réessayez." };
  c.remove("APPN_" + nonce);
  var secret = epProp_("APPK_" + String(id || "").replace(/[^A-Z0-9-]/g, ""));
  if (!secret || ep4Hmac_(secret, nonce + "|" + id) !== String(sig || "")) return { ok: false, msg: "Cet appareil n’est pas reconnu : réactivez le logiciel avec un nouveau code." };
  var a = ep4Appareil_(id); if (a.statut !== "Actif") return { ok: false, msg: "Cet appareil a été désactivé par l’administration." };
  if (a.mobile && epProp_("APP_MOBILE") === "NON") return { ok: false, mobile: true, msg: "La connexion depuis un téléphone est désactivée par l’administration : utilisez le logiciel AssistAcad sur ordinateur." };
  var t = ep3Alea_(32); c.put("APPT_" + t, JSON.stringify({ a: String(id), m: a.membre }), 300);
  ep4Activite_(id);
  return { ok: true, ticket: t };
}
// Après une connexion réussie : la session est liée à l'appareil (ou refusée si le logiciel est obligatoire)
function ep4ApresConnexion_(r, ticket) {
  if (!r || !r.ok || typeof r.jeton !== "string") return r;
  var s = null; try { s = (EP4_LIRE || lireSession_)(r.jeton); } catch (e) {}
  if (!s || !s.id) return r;
  var c = CacheService.getScriptCache(), t = null;
  if (typeof ticket === "string" && /^[0-9a-f]{32}$/.test(ticket)) { try { t = JSON.parse(c.get("APPT_" + ticket) || "null"); } catch (e) {} }
  if (t && t.m === String(s.id)) { c.remove("APPT_" + ticket); ep4Lier_(r.jeton, t.a); r.appareil = t.a; return r; }
  if (!ep4Oblige_(s)) return r;
  if (t && t.m !== String(s.id)) return { ok: false, app: true, msg: "Ce logiciel est activé pour un autre membre de l’équipe. Chacun utilise son propre appareil activé." };
  return EP4_REFUS_APP;
}

// ---- Pour le logiciel (requêtes POST directes, sans session) ----
function ep4Json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ep4Post_(b) {
  if (b.aa === "activer") {
    if (!ep2Quota_("APPACT_TOUS", 60, 3600)) return { ok: false, msg: "Trop d’activations : réessayez dans une heure." };
    var code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 16) return { ok: false, msg: "Code d’activation incorrect." };
    var k = "APPC_" + ep3Sha_(code).slice(0, 40), v = epProp_(k);
    if (!v) return { ok: false, msg: "Code d’activation incorrect ou déjà utilisé." };
    var d = JSON.parse(v); epProps_().deleteProperty(k);
    if (d.e < Date.now()) return { ok: false, msg: "Code expiré : demandez-en un nouveau à l’administration." };
    var m = ep2Membre_(d.m); if (!m || !m.actif) return { ok: false, msg: "Ce compte n’est pas actif." };
    var max = Math.max(1, Number(epProp_("APP_MAX", 2)) || 2);
    var actifs = ep4Appareils_().filter(function (x) { return String(x["Membre ID"]) === m.id && String(x["Statut"]) === "Actif"; });
    if (actifs.length >= max) return { ok: false, msg: "Vous avez déjà " + actifs.length + " appareil(s) activé(s). Demandez à l’administration d’en désactiver un." };
    epFeuille_(EP4.F_APP, EP4_ENT.APP);
    var id = ep2Id_("APP"), secret = ep3Alea_(48);
    epProps_().setProperty("APPK_" + id, secret);
    epAjouter_(EP4.F_APP, { "ID": id, "Membre ID": m.id, "Membre": m.nom, "Role": m.role, "Nom appareil": epTxt_(b.nom, 60), "Systeme": epTxt_(b.os, 60), "Version": epTxt_(b.version, 20), "Active le": new Date(), "Derniere activite": new Date(), "Statut": "Actif" });
    epAdminTg_("📲 <b>Logiciel AssistAcad activé</b>\n👤 " + epEsc_(m.nom) + "\n💻 " + epEsc_(epTxt_(b.nom, 60)) + " · " + epEsc_(epTxt_(b.os, 60)) + "\n🔖 " + id);
    return { ok: true, id: id, secret: secret, membre: m.nom };
  }
  if (b.aa === "etat") {
    var idA = String(b.id || "").replace(/[^A-Z0-9-]/g, ""), sec = epProp_("APPK_" + idA), t0 = Number(b.t) || 0;
    if (!sec || Math.abs(Date.now() - t0) > 300000 || ep4Hmac_(sec, "etat|" + t0 + "|" + idA) !== String(b.sig || "")) return { ok: false, inconnu: true, msg: "Appareil non reconnu." };
    var a = ep4Appareil_(idA);
    if (a.statut !== "Actif") return { ok: true, actif: false, msg: "Cet appareil a été désactivé par l’administration." };
    ep4Activite_(idA, b.version);
    var vmin = epProp_("APP_VERSION_MIN", "");
    return { ok: true, actif: true, majObligatoire: !!(vmin && ep4VersionInf_(b.version, vmin)), versionMin: vmin, lien: epProp_("APP_LIEN", ""), message: epProp_("APP_MESSAGE", "") };
  }
  return { ok: false, msg: "Requête inconnue." };
}

// ---- Téléphones (mise à jour 25) : le navigateur du téléphone devient un appareil activé ----
//  Même clé d'activation que pour l'ordinateur. Le secret reçu est aussitôt rangé dans le
//  téléphone comme clé « non exportable » (WebCrypto) : la page peut signer les défis,
//  mais personne ne peut plus relire le secret. L'administration voit le téléphone (📱)
//  dans la liste des appareils et peut le désactiver à distance, ou couper tous les téléphones.
function apiAppActiverMobile(code, nom, os) {
  if (epProp_("APP_MOBILE") === "NON") return { ok: false, msg: "L’activation des téléphones est désactivée par l’administration." };
  var r = ep4Post_({ aa: "activer", code: code, nom: epTxt_(nom, 50) || "Téléphone", os: "📱 " + (epTxt_(os, 50) || "Téléphone"), version: "mobile" });
  if (!r || !r.ok) return r || { ok: false, msg: "Activation impossible." };
  return { ok: true, id: r.id, secret: r.secret, membre: r.membre, msg: "Téléphone activé pour " + r.membre + "." };
}

// ---- Administration : contrôle à distance ----
function apiAppAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var l = ep4Appareils_().reverse().map(function (o) {
    var d = epParseDate_(o["Derniere activite"]);
    return { id: String(o["ID"]), membre: String(o["Membre"]), membreId: String(o["Membre ID"]), role: String(o["Role"]), nom: String(o["Nom appareil"]), os: String(o["Systeme"]), version: String(o["Version"]),
      active: epDate_(epParseDate_(o["Active le"]) || new Date()), activite: d ? epDate_(d, "dd/MM HH:mm") : "", enLigne: !!(d && Date.now() - d.getTime() < 15 * 60000), statut: String(o["Statut"]), motif: String(o["Motif"] || "") };
  });
  var membres = epMembres_().filter(function (m) { return m.actif && m.role !== "client"; }).map(function (m) { return { id: m.id, nom: m.nom, role: m.role, appareils: l.filter(function (x) { return x.membreId === m.id && x.statut === "Actif"; }).length }; });
  return { ok: true, appareils: l, membres: membres, reglages: { obligatoire: epProp_("APP_OBLIGATOIRE") === "OUI", adminAussi: epProp_("APP_ADMIN") === "OUI", versionMin: epProp_("APP_VERSION_MIN", ""), lien: epProp_("APP_LIEN", ""), message: epProp_("APP_MESSAGE", ""), max: Number(epProp_("APP_MAX", 2)) || 2, mobile: epProp_("APP_MOBILE") !== "NON", lienClient: epProp_("APP_CLIENT_LIEN", "") },
    sansAppareil: membres.filter(function (m) { return !m.appareils && m.role !== "admin"; }).map(function (m) { return m.nom; }) };
}
// Code d'activation à usage unique, valable 72 h, pour UN membre
function apiAppCode(jeton, membreId) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var m = ep2Membre_(membreId); if (!m || !m.actif) return { ok: false, msg: "Membre introuvable ou inactif." };
  var al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now()), code = "";
  for (var i = 0; i < 16; i++) code += al.charAt((d[i] & 255) % al.length);
  var exp = Date.now() + 72 * 3600000;
  epProps_().setProperty("APPC_" + ep3Sha_(code).slice(0, 40), JSON.stringify({ m: m.id, e: exp }));
  var lisible = code.replace(/(.{4})(?=.)/g, "$1-");
  var cle = "AA1." + Utilities.base64EncodeWebSafe(JSON.stringify({ u: ep3UrlApp_(), c: code })).replace(/=+$/, "");
  if (typeof audit_ === "function") { try { audit_(a.nom || a.id, "Code d’activation du logiciel créé", m.id, m.nom); } catch (e) {} }
  return { ok: true, membre: m.nom, code: lisible, cle: cle, expire: epDate_(new Date(exp), "dd/MM/yyyy HH:mm"), msg: "Code créé pour " + m.nom + " : valable 72 h, une seule fois." };
}
function apiAppRevoquer(jeton, id, motif) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = ep4Appareils_().filter(function (x) { return String(x["ID"]) === String(id); })[0]; if (!o) return { ok: false, msg: "Appareil introuvable." };
  epMaj_(EP4.F_APP, o._row, { "Statut": "Désactivé", "Motif": epTxt_(motif, 200) || "Désactivé par l’administration" });
  epProps_().deleteProperty("APPK_" + id);
  CacheService.getScriptCache().remove("APPST_" + id);
  if (typeof audit_ === "function") { try { audit_(a.nom || a.id, "Appareil désactivé", String(id), String(o["Membre"])); } catch (e) {} }
  return { ok: true, msg: "Appareil " + id + " désactivé : ses sessions sont fermées. Pour le réutiliser, il faudra un nouveau code d’activation." };
}
function apiAppReglages(jeton, d) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  d = d || {}; var P = epProps_();
  if (d.obligatoire !== undefined) {
    if (d.obligatoire && d.adminAussi && !ep4Appareils_().some(function (x) { return String(x["Membre ID"]) === String(a.id) && String(x["Statut"]) === "Actif"; }))
      return { ok: false, msg: "Active d’abord le logiciel sur ton propre appareil : sinon tu ne pourrais plus te connecter." };
    P.setProperty("APP_OBLIGATOIRE", d.obligatoire ? "OUI" : "NON");
  }
  if (d.adminAussi !== undefined) P.setProperty("APP_ADMIN", d.adminAussi ? "OUI" : "NON");
  if (d.versionMin !== undefined) { var v = String(d.versionMin || "").trim(); if (v && !/^\d+\.\d+\.\d+$/.test(v)) return { ok: false, msg: "Version minimale : format 1.0.0." }; P.setProperty("APP_VERSION_MIN", v); }
  if (d.lien !== undefined) { var l = String(d.lien || "").trim(); if (l && !/^https:\/\//.test(l)) return { ok: false, msg: "Le lien de téléchargement doit commencer par https://" }; P.setProperty("APP_LIEN", l); }
  if (d.message !== undefined) P.setProperty("APP_MESSAGE", epTxt_(d.message, 300));
  if (d.lienClient !== undefined) { var lc = String(d.lienClient || "").trim(); if (lc && !/^https:\/\//.test(lc)) return { ok: false, msg: "Le lien de l’application client doit commencer par https://" }; P.setProperty("APP_CLIENT_LIEN", lc); }
  if (d.max !== undefined) P.setProperty("APP_MAX", String(Math.max(1, Math.min(5, Number(d.max) || 2))));
  if (d.mobile !== undefined) { P.setProperty("APP_MOBILE", d.mobile ? "OUI" : "NON"); var cc = CacheService.getScriptCache(); ep4Appareils_().forEach(function (x) { cc.remove("APPST_" + x["ID"]); }); }
  if (typeof audit_ === "function") { try { audit_(a.nom || a.id, "Réglages du logiciel AssistAcad", "", JSON.stringify({ o: d.obligatoire, ad: d.adminAussi })); } catch (e) {} }
  return { ok: true, msg: (epProp_("APP_OBLIGATOIRE") === "OUI" ? "Logiciel obligatoire pour l’équipe et les partenaires." : "Logiciel facultatif : l’accès web reste ouvert à l’équipe.") };
}
// En cas d'urgence (depuis l'éditeur Apps Script) : rouvre l'accès web à l'équipe
function desactiverObligationLogiciel() { if (typeof reserveEditeurOuDeclencheur_ === "function") reserveEditeurOuDeclencheur_(arguments[0]); else if (typeof reserveEditeur_ === "function") reserveEditeur_(); epProps_().setProperty("APP_OBLIGATOIRE", "NON"); Logger.log("🔓 L’espace équipe est de nouveau accessible depuis le navigateur."); }

// Diagnostic (depuis l'éditeur) : le serveur répond-il bien au logiciel ?
function testerLogiciel() {
  if (typeof reserveEditeurOuDeclencheur_ === "function") reserveEditeurOuDeclencheur_(arguments[0]);
  var out = doPost({ postData: { contents: JSON.stringify({ aa: "etat", id: "APP-TEST", t: Date.now(), sig: "x" }) }, parameter: {} }), txt = "";
  try { txt = out.getContent(); } catch (e) { txt = String(out); }
  var ok = /"inconnu":true/.test(txt);
  Logger.log((ok ? "✅ Le code du logiciel répond correctement." : "❌ Réponse incorrecte : « " + String(txt).slice(0, 120) + " » → EspacePlus2.gs doit être le DERNIER fichier.")
    + "\nAdresse utilisée par les clés : " + ep3UrlApp_()
    + "\nÉtape suivante : Déployer › Gérer les déploiements › ✏️ › Version « Nouvelle version », « Qui peut accéder : Tout le monde » › Déployer.");
}

// ════════════════════ 11. TEST DE VALIDATION DE LA FORMATION (80 / 100 minimum) ════════════════════
var EP4_SEUIL = 80, EP4_NB_Q = 20, EP4_DUREE_MIN = 20, EP4_LECTURE_MIN = 5, EP4_ESSAIS_JOUR = 3, EP4_PAUSE_MIN = 30;
var EP4_LECTURE = [
  ["1. Notre promesse", ["Accompagner chaque étudiant « jusqu’à la satisfaction complète » : travail original, délais tenus, corrections sans supplément, confidentialité absolue.", "L’équipe travaille de 8 h à 23 h, du lundi au vendredi ; le bot répond 24 h/24."]],
  ["2. Les rôles", ["Employé : ses tâches, l’Assistance client qui lui est confiée, ses outils, son dossier.", "Partenaire : uniquement ses propres clients (venus par son lien) et ses tâches.", "Administration : attribue les tâches, valide les paiements et les travaux, livre aux clients."]],
  ["3. Sécurité du compte", ["Compte strictement personnel ; un code de connexion ne se partage jamais, même à quelqu’un qui se dit de l’administration.", "L’espace équipe s’ouvre dans le logiciel AssistAcad, sur un appareil activé par un code de l’administration.", "Toute activité suspecte est signalée immédiatement."]],
  ["4. La charte 4.0", ["Rien d’un client ne sort d’AssistAcad, sans limite de durée.", "Contact uniquement par l’Assistance client et le bot : jamais de numéro ou de compte personnel.", "Personne n’encaisse d’argent : seule l’administration reçoit et valide les paiements, après vérification bancaire.", "Inventer une source, une donnée ou une citation est une faute grave.", "Prévenir au moindre risque de retard, au plus tard 24 h avant l’échéance."]],
  ["5. Les outils de travail", ["On les ouvre avec le numéro de la commande attribuée (ex. CMD-26-0042) ; les essais faux sont limités et enregistrés.", "La rédaction est protégée : ce qui y est copié ne se colle que dans les outils de travail.", "« Convertir » crée un Word ou un PDF mis aux normes ; « Enregistrer » le range dans Mon dossier. Un fichier non enregistré disparaît après 24 h.", "Le brouillon range idées, sources, citations, plan, données et questions au client, par partie."]],
  ["6. Soumettre le travail", ["On soumet uniquement depuis Mon dossier (« Choisir un fichier ») ou la rédaction elle-même.", "Un fichier de l’ordinateur doit d’abord être ajouté au dossier.", "L’administration valide ou demande une reprise ; elle seule livre au client, après paiement intégral."]],
  ["7. Les normes", ["Universités russes : ГОСТ 7.32-2017, Times New Roman 14, interligne 1,5, retrait 1,25 cm, marges 30/15/20/20 mm, bibliographie ГОСТ Р 7.0.100-2018.", "Universités européennes : guide de l’université, police 12, interligne 1,5, marges 2,5 cm, APA 7, Harvard ou ISO 690.", "Universités africaines : page de garde avec l’État et la devise, recommandations CAMES, Times New Roman 12.", "Le guide de l’établissement du client passe toujours avant les règles générales."]],
  ["8. L’Assistance client", ["Statut Disponible, Occupé ou En pause ; le client voit le prénom de la personne qui répond.", "Réponses rapides avec « / » ; un seul rappel à l’équipe après 10 minutes.", "Ton AssistAcad : poli, clair, chaleureux ; une réponse = une action datée."]],
  ["9. Les erreurs qui coûtent cher", ["Accepter un paiement d’un client, donner son numéro, recopier le travail hors de l’intranet, inventer une source, livrer soi-même, prévenir d’un retard le jour même, partager un code, essayer des numéros de commande."]]
];
var EP4_QUESTIONS = [
  ["Un client propose de vous payer directement sur votre carte. Que faites-vous ?", ["Vous acceptez si c’est plus rapide", "Vous refusez, rappelez les coordonnées officielles du bot et prévenez l’administration", "Vous acceptez et reversez à l’administration", "Vous ne répondez pas"], 1, "Personne n’encaisse à la place d’AssistAcad (charte, article 4)."],
  ["Quelqu’un « de l’administration » vous demande par message le code que vous venez de recevoir. Que faites-vous ?", ["Vous le donnez", "Vous le donnez seulement s’il connaît votre nom", "Vous ne le donnez jamais et vous signalez la demande", "Vous le donnez par téléphone"], 2, "Un code ne se partage jamais : l’administration ne le demande jamais."],
  ["Comment ouvrir les outils de travail d’une commande ?", ["Avec le nom du client", "Avec le numéro de la commande qui vous est attribuée", "Avec n’importe quel numéro de commande", "Avec le code de la charte"], 1, "Les outils s’ouvrent avec le numéro d’une commande attribuée."],
  ["Vous avez copié un paragraphe de la rédaction. Où pouvez-vous le coller ?", ["Dans Word", "Dans WhatsApp", "Uniquement dans les outils de travail (rédaction, brouillon, notes)", "Dans un message au client"], 2, "La rédaction est protégée : le texte ne sort pas des outils."],
  ["Comment envoyer à l’administration un tableau Excel préparé sur votre ordinateur ?", ["Par e-mail personnel", "Par Telegram", "Je l’ajoute à Mon dossier, puis Soumettre › Choisir un fichier", "Je le donne directement au client"], 2, "On soumet uniquement depuis Mon dossier."],
  ["Un fichier converti depuis la rédaction n’a pas été enregistré. Que devient-il ?", ["Il est gardé pour toujours", "Il est supprimé au bout de 24 heures", "Il est envoyé au client", "Il part à l’administration"], 1, "Un fichier converti non enregistré est supprimé après 24 h."],
  ["Quelle norme bibliographique pour une université russe ?", ["APA 7", "ГОСТ Р 7.0.100-2018", "Harvard", "MLA"], 1, "Bibliographie selon ГОСТ Р 7.0.100-2018."],
  ["Quelle mise en page de base pour un travail dans une université russe ?", ["Arial 11, interligne simple", "Times New Roman 14, interligne 1,5, retrait 1,25 cm", "Calibri 12, interligne double", "Times New Roman 10, sans retrait"], 1, "ГОСТ 7.32-2017 : Times New Roman 14, interligne 1,5, retrait 1,25 cm."],
  ["Qu’est-ce qui passe AVANT les règles générales des normes ?", ["Les habitudes du rédacteur", "Le guide de l’établissement du client", "Le modèle d’un autre client", "Rien"], 1, "Le guide de l’établissement passe toujours avant."],
  ["Pour une université africaine francophone, que trouve-t-on en haut de la page de garde ?", ["Le logo d’AssistAcad", "Le nom de l’État et la devise nationale", "Le numéro de commande", "Le prix du travail"], 1, "Page de garde : État, devise, ministère, université, faculté…"],
  ["Votre chapitre risque d’être en retard. Quand prévenez-vous l’administration ?", ["Le jour de l’échéance", "Après l’échéance", "Au plus tôt, et au plus tard 24 h avant l’échéance", "Jamais"], 2, "Charte, article 9."],
  ["Une source vous manque pour appuyer un chiffre. Que faites-vous ?", ["J’invente une référence crédible", "Je cite une source réelle ou je pose la question au client", "Je supprime la bibliographie", "Je copie un autre mémoire"], 1, "Inventer une source est une faute grave (charte, article 8)."],
  ["Qui livre le travail fini au client ?", ["Le rédacteur, par Telegram", "Le partenaire, par e-mail", "L’administration, après validation et paiement intégral", "Le client le télécharge seul sans validation"], 2, "Seule l’administration livre."],
  ["Un client vous demande votre numéro de téléphone pour aller plus vite. Que répondez-vous ?", ["Je le donne", "Je reste sur l’Assistance client et le bot", "Je donne mon WhatsApp", "Je lui donne celui d’un collègue"], 1, "Contact uniquement par les canaux officiels."],
  ["Un partenaire peut-il voir les conversations des clients venus directement par le bot ?", ["Oui, toutes", "Non, uniquement celles de ses propres clients (venus par son lien)", "Oui, s’il le demande", "Seulement le week-end"], 1, "Un partenaire ne voit que ses propres clients."],
  ["Que montre le statut « Disponible » dans l’Assistance client ?", ["Que vous êtes en pause", "Qu’un client peut vous être confié", "Que vous avez fini votre journée", "Rien"], 1, "Un client n’est confié qu’à un membre Disponible."],
  ["Un texte produit par un outil automatique peut-il être livré tel quel ?", ["Oui", "Oui s’il est long", "Non : il est toujours relu, vérifié et corrigé", "Oui s’il est en russe"], 2, "Charte, article 8."],
  ["Le travail d’un client est terminé depuis 6 mois. Pouvez-vous le partager comme exemple ?", ["Oui, sans le nom", "Non : la confidentialité n’a pas de limite de durée", "Oui, après 3 mois", "Oui, sur les réseaux sociaux"], 1, "Charte, article 2."],
  ["Vous essayez plusieurs numéros de commande pour trouver la vôtre. Qu’en est-il ?", ["C’est autorisé", "C’est interdit : les essais sont limités et enregistrés ; demandez l’attribution", "C’est conseillé", "C’est sans conséquence"], 1, "Charte, article 5."],
  ["Où se trouvent les fichiers convertis et ceux ajoutés depuis l’ordinateur ?", ["Dans le brouillon", "Dans Mon dossier de la commande", "Dans le canal @assisacad", "Sur le bureau"], 1, "Mon dossier de la commande."],
  ["Que faire avant de soumettre un travail ?", ["Rien", "Remplir le contrôle qualité et respecter les normes de la catégorie", "Envoyer le fichier au client", "Supprimer le brouillon"], 1, "Contrôle qualité et normes avant chaque remise."],
  ["Comment s’ouvre l’espace équipe ?", ["Dans n’importe quel navigateur, sans condition", "Dans le logiciel AssistAcad, sur un appareil activé par un code de l’administration", "Par le canal Telegram", "Avec le mot de passe d’un collègue"], 1, "Le logiciel AssistAcad, activé par un code."],
  ["Le brouillon sert à…", ["Envoyer le travail au client", "Ranger idées, sources, citations, plan, données et questions au client", "Payer", "Discuter avec l’équipe"], 1, "Le brouillon organise la recherche."],
  ["Quel est le ton attendu avec les clients ?", ["Sec et rapide", "Poli, clair, chaleureux, avec une action datée", "Familier", "Uniquement des émojis"], 1, "Le ton AssistAcad."],
  ["Que contient l’introduction d’un travail pour une université russe ?", ["Uniquement le sujet", "Актуальность, объект, предмет, цель, задачи, методы", "La bibliographie", "Les remerciements"], 1, "Введение : актуальность, объект, предмет, цель, задачи, методы."],
  ["Le logiciel AssistAcad est installé sur votre ordinateur. Un collègue veut l’utiliser avec son compte. Que dites-vous ?", ["Oui, sans problème", "Non : chaque appareil est activé pour une seule personne", "Oui, s’il est rapide", "Oui, le week-end"], 1, "Un appareil = un membre."],
  ["Que se passe-t-il si l’administration désactive votre appareil ?", ["Rien", "Les sessions ouvertes sur cet appareil se ferment aussitôt", "Le travail est envoyé au client", "Le logiciel est payé"], 1, "Désactivation à distance immédiate."],
  ["Quel style de citation pour un mémoire dans une université européenne ?", ["Un style unique (APA 7, Harvard ou ISO 690) du début à la fin", "Plusieurs styles mélangés", "Aucun", "ГОСТ uniquement"], 0, "Un seul style, appliqué partout."],
  ["Une demande de reprise arrive après la soumission. Que faites-vous ?", ["Je l’ignore", "Je corrige la rédaction, reconvertis, enregistre et soumets la nouvelle version", "J’envoie le fichier au client", "Je supprime la commande"], 1, "Reprise : corriger, reconvertir, enregistrer, soumettre."],
  ["Les coordonnées bancaires des clients sont visibles par…", ["Toute l’équipe", "Les partenaires", "L’administration seulement", "Les clients entre eux"], 2, "Seule l’administration les voit."]
];
function ep4Lecture_(s) { return epLire_(EP4.F_LECT).filter(function (o) { return String(o["Membre ID"]) === String(s.id); })[0] || null; }
function ep4Tests_(s) { return epLire_(EP4.F_TESTS).filter(function (o) { return String(o["Membre ID"]) === String(s.id); }); }
function ep4Statut_(s) {
  var t = ep4Tests_(s), faits = t.filter(function (o) { return /^(Validé|Non validé)$/.test(String(o["Statut"])); });
  var val = faits.filter(function (o) { return String(o["Statut"]) === "Validé"; });
  var meilleur = faits.reduce(function (m, o) { return Math.max(m, Number(o["Score"]) || 0); }, 0);
  var jour = Date.now() - 86400000, recents = t.filter(function (o) { var d = epParseDate_(o["Debut"]); return d && d.getTime() > jour; });
  var dernier = faits.length ? faits[faits.length - 1] : null, attente = 0;
  if (dernier && String(dernier["Statut"]) === "Non validé") { var f = epParseDate_(dernier["Fin"]); if (f) attente = Math.max(0, Math.ceil((f.getTime() + EP4_PAUSE_MIN * 60000 - Date.now()) / 60000)); }
  return { valide: !!val.length, dateValide: val.length ? epDate_(epParseDate_(val[val.length - 1]["Fin"]) || new Date()) : "", meilleur: meilleur, tentatives: faits.length, restantes: Math.max(0, EP4_ESSAIS_JOUR - recents.length), attente: attente,
    historique: faits.slice(-8).reverse().map(function (o) { return { date: epDate_(epParseDate_(o["Fin"]) || new Date(), "dd/MM HH:mm"), score: Number(o["Score"]) || 0, statut: String(o["Statut"]) }; }) };
}
function apiFormTestEtat(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var l = ep4Lecture_(s), d = l ? epParseDate_(l["Debut lecture"]) : null, f = l ? epParseDate_(l["Fin lecture"]) : null;
  return { ok: true, nom: s.nom, lecture: { debut: !!d, faite: !!f, secondesRestantes: d && !f ? Math.max(0, Math.round((d.getTime() + EP4_LECTURE_MIN * 60000 - Date.now()) / 1000)) : 0 },
    chapitres: EP4_LECTURE, regles: { seuil: EP4_SEUIL, questions: EP4_NB_Q, duree: EP4_DUREE_MIN, lectureMin: EP4_LECTURE_MIN, essaisJour: EP4_ESSAIS_JOUR, pause: EP4_PAUSE_MIN }, statut: ep4Statut_(s), exige: epProp_("FORM_EXIGE") === "OUI" };
}
function apiFormLectureDebut(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var l = ep4Lecture_(s); if (l && l["Debut lecture"]) return { ok: true };
  epFeuille_(EP4.F_LECT, EP4_ENT.LECT);
  epAjouter_(EP4.F_LECT, { "Membre ID": s.id, "Nom": s.nom || "", "Debut lecture": new Date() });
  return { ok: true };
}
function apiFormLectureFin(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var l = ep4Lecture_(s), d = l ? epParseDate_(l["Debut lecture"]) : null;
  if (!d) return { ok: false, msg: "Commence par lire la formation." };
  if (l["Fin lecture"]) return { ok: true };
  var reste = Math.round((d.getTime() + EP4_LECTURE_MIN * 60000 - Date.now()) / 1000);
  if (reste > 0) return { ok: false, msg: "Prends le temps de tout lire : encore " + Math.ceil(reste / 60) + " minute(s) avant de pouvoir passer le test." };
  epMaj_(EP4.F_LECT, l._row, { "Fin lecture": new Date(), "Minutes": Math.round((Date.now() - d.getTime()) / 60000) });
  return { ok: true, msg: "Lecture terminée : tu peux passer le test." };
}
function apiFormTestCommencer(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var l = ep4Lecture_(s); if (!l || !l["Fin lecture"]) return { ok: false, msg: "Termine d’abord la lecture de la formation." };
  var st = ep4Statut_(s);
  if (st.attente > 0) return { ok: false, msg: "Après un test non validé, relis la formation : nouvel essai possible dans " + st.attente + " minute(s)." };
  if (st.restantes <= 0) return { ok: false, msg: "3 essais en 24 heures : c’est le maximum. Relis la formation et réessaie demain." };
  var pool = ep2Melange_(EP4_QUESTIONS.map(function (q, i) { return i; })).slice(0, EP4_NB_Q);
  var qs = pool.map(function (i, n) { var q = EP4_QUESTIONS[i], ord = ep2Melange_(q[1].map(function (c, j) { return j; })); return { n: n, i: i, choix: ord.map(function (j) { return q[1][j]; }), bonne: ord.indexOf(q[2]) }; });
  epFeuille_(EP4.F_TESTS, EP4_ENT.TESTS);
  var id = ep2Id_("FTE");
  epAjouter_(EP4.F_TESTS, { "ID": id, "Membre ID": s.id, "Nom": s.nom || "", "Debut": new Date(), "Statut": "En cours", "Questions": JSON.stringify(qs) });
  return { ok: true, id: id, duree: EP4_DUREE_MIN, seuil: EP4_SEUIL, questions: qs.map(function (q) { return { n: q.n, q: EP4_QUESTIONS[q.i][0], choix: q.choix }; }) };
}
function apiFormTestRendre(jeton, id, rep) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var o = ep4Tests_(s).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o || String(o["Statut"]) !== "En cours") return { ok: false, msg: "Test introuvable ou déjà rendu." };
  rep = rep || {};
  var qs = JSON.parse(o["Questions"]), bons = 0, detail = [];
  var deb = epParseDate_(o["Debut"]), hors = deb && Date.now() - deb.getTime() > (EP4_DUREE_MIN + 2) * 60000;
  qs.forEach(function (q) {
    var r = rep[q.n] === undefined || rep[q.n] === null ? -1 : Number(rep[q.n]), ok = !hors && r === q.bonne;
    if (ok) bons++;
    detail.push({ q: EP4_QUESTIONS[q.i][0], ok: ok, ta: r >= 0 ? q.choix[r] : "(sans réponse)", explication: EP4_QUESTIONS[q.i][3] });
  });
  var score = Math.round(bons / qs.length * 100), valide = score >= EP4_SEUIL;
  epMaj_(EP4.F_TESTS, o._row, { "Fin": new Date(), "Score": score, "Statut": valide ? "Validé" : "Non validé", "Reponses": JSON.stringify(rep).slice(0, 4000) });
  var m = ep2Membre_(s.id);
  if (m && m.email) ep2Mail_(m.email, "AssistAcad · Test de formation : " + score + "/100 " + (valide ? "✅ validé" : "— non validé"), ep2Gabarit_("Test de validation de la formation",
    "<p>Bonjour " + epEsc_(String(s.nom || "").split(" ")[0]) + ",</p><p style=\"font-size:28px;font-weight:800;text-align:center;color:" + (valide ? "#2C6B29" : "#B3261E") + "\">" + score + " / 100</p>" +
    "<p>" + (valide ? "Félicitations : ta formation est <b>validée</b>. Bienvenue dans l’équipe !" : "Le minimum est de " + EP4_SEUIL + " / 100. Relis la formation, en particulier les points ci-dessous, puis réessaie dans " + EP4_PAUSE_MIN + " minutes.") + "</p>" +
    (valide ? "" : "<ul>" + detail.filter(function (x) { return !x.ok; }).map(function (x) { return "<li>" + epEsc_(x.explication) + "</li>"; }).join("") + "</ul>")));
  epAdminTg_((valide ? "🎓 <b>Formation validée</b>" : "📝 <b>Test de formation non validé</b>") + "\n👤 " + epEsc_(s.nom || s.id) + "\n📊 " + score + " / 100" + (hors ? " (rendu hors temps)" : ""));
  return { ok: true, score: score, valide: valide, seuil: EP4_SEUIL, bons: bons, total: qs.length, horsTemps: !!hors, detail: detail, statut: ep4Statut_(s) };
}
function apiFormTestAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var lect = {}; epLire_(EP4.F_LECT).forEach(function (o) { lect[String(o["Membre ID"])] = o; });
  var l = epMembres_().filter(function (m) { return m.actif && m.role !== "admin" && m.role !== "client"; }).map(function (m) {
    var st = ep4Statut_({ id: m.id }), lc = lect[m.id];
    return { id: m.id, nom: m.nom, role: m.role, valide: st.valide, dateValide: st.dateValide, meilleur: st.meilleur, tentatives: st.tentatives, lecture: lc ? (lc["Fin lecture"] ? "Terminée (" + (lc["Minutes"] || "?") + " min)" : "En cours") : "Pas commencée" };
  });
  return { ok: true, membres: l, exige: epProp_("FORM_EXIGE") === "OUI", seuil: EP4_SEUIL, valides: l.filter(function (x) { return x.valide; }).length };
}
function apiFormTestReglages(jeton, d) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  d = d || {};
  if (d.exige !== undefined) epProps_().setProperty("FORM_EXIGE", d.exige ? "OUI" : "NON");
  if (d.reinitialiser) {   // efface les essais d'un membre (nouvel essai possible tout de suite)
    epLire_(EP4.F_TESTS).forEach(function (o) { if (String(o["Membre ID"]) === String(d.reinitialiser) && String(o["Statut"]) === "Non validé") epMaj_(EP4.F_TESTS, o._row, { "Statut": "Effacé" }); });
  }
  return { ok: true, msg: d.reinitialiser ? "Essais effacés : le membre peut repasser le test." : (epProp_("FORM_EXIGE") === "OUI" ? "Test réussi exigé pour ouvrir les outils de travail." : "Test conseillé, non exigé.") };
}
function ep4FormOk_(s) { if (epProp_("FORM_EXIGE") !== "OUI" || epEstAdmin_(s)) return true; return ep4Statut_(s).valide; }

// Surcouches : contrôle de l'appareil sur chaque session d'équipe, connexions, requêtes du logiciel
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  if (typeof g.lireSession_ === "function" && !g.lireSession_.__app) {
    var base = g.lireSession_; EP4_LIRE = base;
    var w = function (j) {
      var s = base.apply(this, arguments);
      if (!s || !s.id || epProp_("APP_OBLIGATOIRE") !== "OUI") return s;
      if (!ep4Oblige_(s)) return s;
      var app = ep4Liaison_(j); if (!app) return null;
      var a = ep4Appareil_(app); if (a.statut !== "Actif" || a.membre !== String(s.id)) return null;
      if (a.mobile && epProp_("APP_MOBILE") === "NON") return null;
      ep4Activite_(app);
      return s;
    };
    Object.keys(base).forEach(function (k) { w[k] = base[k]; }); w.__app = true; g.lireSession_ = w;
  }
  var env = function (nom, fn) {
    var cur = g[nom]; if (typeof cur !== "function" || cur.__ep4) return;
    var w = function () { return fn.call(this, cur, Array.prototype.slice.call(arguments)); };
    Object.keys(cur).forEach(function (k) { w[k] = cur[k]; }); w.__ep4 = true; g[nom] = w;
  };
  env("apiLoginV3", function (base, a) { return ep4ApresConnexion_(base.apply(this, a), a[2]); });
  env("apiLogin2FA", function (base, a) { return ep4ApresConnexion_(base.apply(this, a), a[2]); });
  env("apiConnexionAppareil", function (base, a) { return ep4ApresConnexion_(base.apply(this, a), a[1]); });
  env("apiReprendre", function (base, a) {
    var avant = ep4Liaison_(a[0]), r = base.apply(this, a);
    if (r && r.ok && typeof r.jeton === "string" && r.jeton !== a[0] && avant) ep4Lier_(r.jeton, avant);
    return r;
  });
  env("doPost", function (base, a) {
    var e = a[0], b = null;
    try { if (e && e.postData && e.postData.contents && e.postData.contents.indexOf('"aa"') !== -1) b = JSON.parse(e.postData.contents); } catch (x) { b = null; }
    if (b && typeof b.aa === "string") { var rep; try { rep = ep4Post_(b); } catch (x) { rep = { ok: false, msg: "Erreur du serveur : réessayez." }; } return ep4Json_(rep); }
    return base.apply(this, a);
  });
  // Nettoyage quotidien : liaisons et codes expirés
  env("ep3NettoyerSessions_", function (base, a) { var n = base.apply(this, a); try { ep4Nettoyer_(); } catch (e) {} return n; });
  // Nom de domaine : la page peut s'afficher dans le cadre d'un site (www…) si l'administration l'autorise
  env("doGet", function (base, a) {
    var r = base.apply(this, a), p = (a[0] && a[0].parameter) || {};
    try { if (String(p.cadre || "") === "1" && epProp_("DOMAINE_CADRE") === "OUI" && r && typeof r.setXFrameOptionsMode === "function") r.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); } catch (e) {}
    // Icône de l'onglet (mise à jour 34) : FAVICON_URL, sinon l'icône de l'application client (GitHub Pages)
    try {
      var fav = epProp_("FAVICON_URL", ""), lc = epProp_("APP_CLIENT_LIEN", "");
      if (!fav && /^https:\/\//.test(lc)) fav = lc.replace(/\/?(index\.html)?$/, "/") + "icone-192.png";
      if (fav && r && typeof r.setFaviconUrl === "function") r.setFaviconUrl(fav);
    } catch (e) {}
    return r;
  });
  // Les partenaires passent aussi le test, et se connectent par le logiciel
  if (typeof PART_OK_ !== "undefined") ["apiFormTestEtat", "apiFormLectureDebut", "apiFormLectureFin", "apiFormTestCommencer", "apiFormTestRendre", "apiAppConfig", "apiAppDefi", "apiAppPreuve", "apiAppActiverMobile"].forEach(function (n) { PART_OK_[n] = 1; });
  // Option : test de formation réussi exigé pour ouvrir les outils
  env("apiOutils2Ouvrir", function (base, a) { var s = epMembre_(a[0]); if (s && !ep4FormOk_(s)) return { ok: false, formation: true, msg: "Passe d’abord le test de validation de la formation (80 / 100 minimum) : Outils › Test de formation." }; return base.apply(this, a); });
})();

// ════════════════════ 12. CANDIDATURES : « Rejoindre l'équipe » (mise à jour 23) ════════════════════
//  Sur le lien web (espace client), un visiteur peut postuler. L'administration reçoit
//  la candidature (Telegram + liste dans Outils › Candidatures), l'accepte ou la refuse.
//  Acceptée : le candidat reçoit par e-mail le lien de téléchargement du logiciel AssistAcad
//  (et sa clé d'activation si son compte existe déjà).
var EP5 = { F: "Candidatures", CV_MAX_KO: 5000 };
var EP5_ENT = ["ID", "Date", "Prenom", "Nom", "Email", "Telegram", "Pays", "Ville", "Poste", "Domaines", "Niveau", "Langues", "Experience", "Disponibilite", "Motivation", "Lien", "CV Drive ID", "Statut", "Decision le", "Motif", "Par"];
var EP5_POSTES = ["Rédacteur·rice", "Correcteur·rice / relecteur·rice", "Traducteur·rice", "Assistance client", "Partenaire spécialiste (indépendant)"];
var EP5_NIVEAUX = ["Licence en cours", "Licence", "Master en cours", "Master", "Doctorat en cours", "Doctorat", "Autre"];
var EP5_LANGUES = ["Français", "Russe", "Anglais", "Arabe", "Espagnol", "Chinois"];
var EP5_DISPO = ["Moins de 10 h / semaine", "10 à 20 h / semaine", "20 à 35 h / semaine", "Temps plein"];

function apiCandidatureInfos() { return { ok: true, postes: EP5_POSTES, niveaux: EP5_NIVEAUX, langues: EP5_LANGUES, dispo: EP5_DISPO, cvMaxMo: Math.round(EP5.CV_MAX_KO / 1000) }; }
function apiCandidatureEnvoyer(d) {
  d = d || {};
  if (d.site) return { ok: true, msg: "Candidature envoyée." };   // piège à robots : on ne garde rien
  if (!ep2Quota_("CAND_TOUS", 60, 3600)) return { ok: false, msg: "Trop de candidatures en ce moment : réessayez dans une heure." };
  var t = function (v, n) { return epTxt_(String(v == null ? "" : v).trim(), n); };
  var c = { prenom: t(d.prenom, 60), nom: t(d.nom, 60), email: t(d.email, 120).toLowerCase(), telegram: t(d.telegram, 60), pays: t(d.pays, 60), ville: t(d.ville, 60),
    poste: t(d.poste, 60), domaines: t(d.domaines, 300), niveau: t(d.niveau, 40), langues: (Array.isArray(d.langues) ? d.langues : []).map(function (x) { return t(x, 30); }).filter(String).slice(0, 8).join(", "),
    experience: t(d.experience, 1500), dispo: t(d.dispo, 40), motivation: t(d.motivation, 2000), lien: t(d.lien, 300) };
  if (!c.prenom || !c.nom) return { ok: false, champ: "prenom", msg: "Indiquez votre prénom et votre nom." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return { ok: false, champ: "email", msg: "Adresse e-mail incorrecte." };
  if (EP5_POSTES.indexOf(c.poste) < 0) return { ok: false, champ: "poste", msg: "Choisissez le poste qui vous intéresse." };
  if (!c.domaines) return { ok: false, champ: "domaines", msg: "Indiquez vos domaines (ex. droit, économie, informatique)." };
  if (!c.langues) return { ok: false, champ: "langues", msg: "Cochez au moins une langue de travail." };
  if (c.motivation.length < 80) return { ok: false, champ: "motivation", msg: "Votre motivation : quelques phrases au moins (80 caractères)." };
  if (c.lien && !/^https:\/\//.test(c.lien)) return { ok: false, champ: "lien", msg: "Le lien doit commencer par https://" };
  if (!d.accord) return { ok: false, champ: "accord", msg: "Merci d’accepter le traitement de vos données pour étudier la candidature." };
  if (epLire_(EP5.F).some(function (o) { return String(o["Email"]).toLowerCase() === c.email && String(o["Statut"]) === "Nouvelle"; }))
    return { ok: false, msg: "Une candidature avec cette adresse est déjà en cours d’examen. Nous vous répondrons par e-mail." };
  var oc = null;
  if (d.cv && d.cv.b64) {
    if (!/\.(pdf|docx?)$/i.test(String(d.cv.nom || ""))) return { ok: false, champ: "cv", msg: "CV : fichier PDF ou Word uniquement." };
    try { oc = ep2Fichier_(d.cv.b64, d.cv.nom, EP5.CV_MAX_KO); } catch (x) { return { ok: false, champ: "cv", msg: x.message }; }
  }
  if (!ep2Quota_("CAND_" + ep3Sha_(c.email).slice(0, 30), 2, 86400)) return { ok: false, msg: "Vous avez déjà postulé aujourd’hui avec cette adresse." };
  epFeuille_(EP5.F, EP5_ENT);
  var cvId = "";
  if (oc) {
    var mime = /\.pdf$/i.test(d.cv.nom) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    cvId = epDossier_("EP5_DOSSIER_CV", "AssistAcad — CV des candidats").createFile(Utilities.newBlob(oc, mime, "CV " + c.prenom + " " + c.nom + " — " + epTxt_(d.cv.nom, 80))).getId();
  }
  var id = ep2Id_("CAND");
  epAjouter_(EP5.F, { "ID": id, "Date": new Date(), "Prenom": c.prenom, "Nom": c.nom, "Email": c.email, "Telegram": c.telegram, "Pays": c.pays, "Ville": c.ville, "Poste": c.poste, "Domaines": c.domaines,
    "Niveau": c.niveau, "Langues": c.langues, "Experience": c.experience, "Disponibilite": c.dispo, "Motivation": c.motivation, "Lien": c.lien, "CV Drive ID": cvId, "Statut": "Nouvelle" });
  epAdminTg_("🧑‍💼 <b>Nouvelle candidature</b>\n👤 " + epEsc_(c.prenom + " " + c.nom) + "\n💼 " + epEsc_(c.poste) + "\n📚 " + epEsc_(c.domaines) + "\n🌍 " + epEsc_(c.langues) + (cvId ? "\n📎 CV joint" : "") + "\n<i>Outils › Candidatures</i>");
  ep2Mail_(c.email, "AssistAcad · Candidature bien reçue", ep2Gabarit_("Merci pour votre candidature",
    "<p>Bonjour " + epEsc_(c.prenom) + ",</p><p>Nous avons bien reçu votre candidature pour le poste <b>" + epEsc_(c.poste) + "</b> (référence " + id + ").</p>" +
    "<p>L’administration l’étudie et vous répond par e-mail. Si elle est retenue, vous recevrez le lien pour installer le logiciel AssistAcad et vos accès.</p><p>À bientôt,<br>L’équipe AssistAcad</p>"));
  return { ok: true, id: id, msg: "Candidature envoyée. Un e-mail de confirmation vient de partir à " + c.email + "." };
}
function ep5Ligne_(o) {
  return { id: String(o["ID"]), date: epDate_(epParseDate_(o["Date"]) || new Date(), "dd/MM/yyyy HH:mm"), prenom: String(o["Prenom"]), nom: String(o["Nom"]), email: String(o["Email"]), telegram: String(o["Telegram"] || ""),
    pays: String(o["Pays"] || ""), ville: String(o["Ville"] || ""), poste: String(o["Poste"]), domaines: String(o["Domaines"] || ""), niveau: String(o["Niveau"] || ""), langues: String(o["Langues"] || ""),
    experience: String(o["Experience"] || ""), dispo: String(o["Disponibilite"] || ""), motivation: String(o["Motivation"] || ""), lien: String(o["Lien"] || ""), cv: !!o["CV Drive ID"],
    statut: String(o["Statut"]), decision: o["Decision le"] ? epDate_(epParseDate_(o["Decision le"]) || new Date()) : "", motif: String(o["Motif"] || "") };
}
function apiCandidaturesAdmin(jeton) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var l = epLire_(EP5.F).reverse().map(ep5Ligne_);
  return { ok: true, liste: l, nouvelles: l.filter(function (x) { return x.statut === "Nouvelle"; }).length, lien: epProp_("APP_LIEN", "") };
}
function apiCandidatureCV(jeton, id) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = epLire_(EP5.F).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o || !o["CV Drive ID"]) return { ok: false, msg: "Pas de CV joint." };
  var b = DriveApp.getFileById(String(o["CV Drive ID"])).getBlob();
  return { ok: true, nom: b.getName(), mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}
function apiCandidatureDecider(jeton, id, decision, motif) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var o = epLire_(EP5.F).filter(function (x) { return String(x["ID"]) === String(id); })[0];
  if (!o) return { ok: false, msg: "Candidature introuvable." };
  if (String(o["Statut"]) !== "Nouvelle") return { ok: false, msg: "Cette candidature a déjà été traitée." };
  var c = ep5Ligne_(o), lien = epProp_("APP_LIEN", ""), cle = null, info = "";
  if (decision === "accepter") {
    if (!lien) return { ok: false, msg: "Indiquez d’abord le lien de téléchargement du logiciel : Outils › Logiciel AssistAcad › « Lien de téléchargement »." };
    var m = epMembres_().filter(function (x) { return x.actif && String(x.email || "").toLowerCase() === c.email; })[0];
    if (m) { var k = apiAppCode(jeton, m.id); if (k && k.ok) cle = k; }
    ep2Mail_(c.email, "AssistAcad · Votre candidature est acceptée", ep2Gabarit_("Bienvenue dans l’équipe AssistAcad",
      "<p>Bonjour " + epEsc_(c.prenom) + ",</p><p>Bonne nouvelle : votre candidature pour le poste <b>" + epEsc_(c.poste) + "</b> est <b>acceptée</b>.</p>" +
      "<p><b>1. Installez le logiciel AssistAcad</b> (Windows, Mac ou Linux) :<br><a href=\"" + epEsc_(lien) + "\">" + epEsc_(lien) + "</a></p>" +
      (cle ? "<p><b>2. Activez-le</b> : ouvrez le logiciel et collez cette clé (valable 72 h, une seule fois) :</p><p style=\"font-family:monospace;word-break:break-all;background:#F1F7EC;padding:10px;border-radius:8px\">" + epEsc_(cle.cle) + "</p><p><b>3. Connectez-vous</b> avec l’identifiant que l’administration vous a communiqué.</p>"
        : "<p><b>2. Vos accès</b> : l’administration vous envoie très vite votre identifiant et votre clé d’activation.</p>") +
      (motif ? "<p>" + epEsc_(epTxt_(motif, 500)) + "</p>" : "") + "<p>Ne transmettez jamais cette clé ni vos identifiants à quelqu’un d’autre.</p><p>À très vite,<br>L’administration AssistAcad</p>"));
    info = cle ? "Candidature acceptée : e-mail envoyé avec le lien du logiciel et la clé d’activation de " + c.prenom + "."
      : "Candidature acceptée : e-mail envoyé avec le lien du logiciel. Créez maintenant son compte (Membres), puis donnez-lui une clé dans Outils › Logiciel AssistAcad.";
  } else if (decision === "refuser") {
    ep2Mail_(c.email, "AssistAcad · Votre candidature", ep2Gabarit_("Votre candidature",
      "<p>Bonjour " + epEsc_(c.prenom) + ",</p><p>Merci de l’intérêt que vous portez à AssistAcad. Après étude, nous ne pouvons pas donner suite à votre candidature pour le moment.</p>" +
      (motif ? "<p>" + epEsc_(epTxt_(motif, 500)) + "</p>" : "") + "<p>Vous pourrez postuler de nouveau plus tard.</p><p>Cordialement,<br>L’administration AssistAcad</p>"));
    info = "Candidature refusée : le candidat est prévenu par e-mail.";
  } else return { ok: false, msg: "Décision inconnue." };
  epMaj_(EP5.F, o._row, { "Statut": decision === "accepter" ? "Acceptée" : "Refusée", "Decision le": new Date(), "Motif": epTxt_(motif, 500), "Par": a.nom || a.id });
  return { ok: true, msg: info, cle: cle ? cle.cle : "" };
}

// ════════════════════ 13. RAPIDITÉ CIBLÉE (mise à jour 24) ════════════════════
//  Quand on sait exactement ce que le client demande (son numéro de commande, son
//  compte Telegram), on va chercher SA ligne dans « Suivi » au lieu de relire tout
//  le tableau. Sécurité : la recherche ciblée n'est utilisée qu'après le contrôle
//  testerRapidite() (résultats identiques à l'ancienne lecture), et si elle ne trouve
//  rien, l'ancienne lecture complète prend le relais.
var RAPIDE_BASE_ = null;
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  if (typeof g.lireSuivi_ === "function" && !g.lireSuivi_.__cible) {
    var base = g.lireSuivi_; RAPIDE_BASE_ = base;
    var w = function (ssId, fn) {
      var h = typeof SUIVI_CIBLE_ !== "undefined" ? SUIVI_CIBLE_ : null;
      if (h && typeof lignesOu_ === "function" && typeof FEUILLE !== "undefined" && epProp_("RAPIDE_CIBLE") === "OUI" && String(ssId) === String(ssId_())) {
        try {
          var l = lignesOu_(FEUILLE.SUIVI, h.col, h.val, 300);
          if (l) { var r = typeof fn === "function" ? l.filter(fn) : l; if (r.length) return r; }
        } catch (e) { console.error("lecture ciblée : " + e); }
      }
      return base.apply(this, arguments);
    };
    Object.keys(base).forEach(function (k) { w[k] = base[k]; }); w.__cible = true; g.lireSuivi_ = w;
  }
  // État de paiement d'UNE commande : sa ligne seulement
  if (typeof g.etatPaiement_ === "function" && !g.etatPaiement_.__cible && typeof g.avecCible_ === "function") {
    var ep = g.etatPaiement_;
    var w2 = function (numero) { var a = arguments, t = this; return avecCible_("N° commande", numero, function () { return ep.apply(t, a); }); };
    Object.keys(ep).forEach(function (k) { w2[k] = ep[k]; }); w2.__cible = true; g.etatPaiement_ = w2;
  }
})();

// À lancer UNE fois depuis l'éditeur : compare la lecture ciblée à l'ancienne sur les dernières
// commandes ; si tout est identique, la lecture ciblée est activée (propriété RAPIDE_CIBLE = OUI).
function testerRapidite() {
  if (typeof reserveEditeurOuDeclencheur_ === "function") reserveEditeurOuDeclencheur_(arguments[0]);
  if (!RAPIDE_BASE_ || typeof lignesOu_ !== "function" || typeof FEUILLE === "undefined") { Logger.log("❌ Bot Telegram.gs v15.0 introuvable : remplacez-le d’abord."); return; }
  var sh = feuille_(FEUILLE.SUIVI); if (!sh || sh.getLastRow() < 2) { Logger.log("Feuille « " + FEUILLE.SUIVI + " » vide : rien à comparer."); return; }
  var t0 = Date.now(), tout = RAPIDE_BASE_(ssId_(), function () { return true; }), tPlein = Date.now() - t0;
  var echant = tout.slice(-8), ecarts = [], tCible = 0, n = 0;
  var cle = function (l) { return JSON.stringify(l.map(function (o) { return [o._row, String(o["N° commande"]), String(o["Chat ID"]), String(o["Statut"])]; })); };
  echant.forEach(function (o) {
    [["N° commande", o["N° commande"]], ["Chat ID", o["Chat ID"]]].forEach(function (c) {
      if (c[1] === "" || c[1] === null || c[1] === undefined) return;
      var pred = function (x) { return String(x[c[0]]) === String(c[1]); };
      var a = tout.filter(pred), t1 = Date.now(), b = (lignesOu_(FEUILLE.SUIVI, c[0], c[1], 300) || []).filter(pred); tCible += Date.now() - t1; n++;
      if (cle(a) !== cle(b)) ecarts.push(c[0] + " = " + c[1] + " (" + a.length + " attendu(s), " + b.length + " trouvé(s))");
    });
  });
  epProps_().setProperty("RAPIDE_CIBLE", ecarts.length ? "NON" : "OUI");
  Logger.log((ecarts.length ? "⚠️ Lecture ciblée NON activée : " + ecarts.join(" ; ") : "✅ Lecture ciblée ACTIVÉE : résultats identiques sur " + n + " recherches.") +
    "\nLecture complète de « " + FEUILLE.SUIVI + " » (" + tout.length + " lignes) : " + tPlein + " ms · lecture ciblée : " + (n ? Math.round(tCible / n) : 0) + " ms en moyenne.");
}

// Diagnostic de vitesse : où part le temps ? (éditeur)
function diagnosticVitesse() {
  if (typeof reserveEditeurOuDeclencheur_ === "function") reserveEditeurOuDeclencheur_(arguments[0]);
  var out = [], t = Date.now(), all = epProps_().getProperties(), tp = Date.now() - t;
  var tailles = {}, total = 0;
  Object.keys(all).forEach(function (k) { var p = (k.match(/^[A-Z0-9]+_?/) || ["(autre)"])[0], n = k.length + String(all[k]).length; total += n; tailles[p] = tailles[p] || { n: 0, o: 0 }; tailles[p].n++; tailles[p].o += n; });
  out.push("Propriétés du script : " + Object.keys(all).length + " (" + Math.round(total / 1024) + " Ko sur 500 Ko) · lecture " + tp + " ms");
  Object.keys(tailles).sort(function (a, b) { return tailles[b].o - tailles[a].o; }).slice(0, 8).forEach(function (p) { out.push("   " + p + "… : " + tailles[p].n + " · " + Math.round(tailles[p].o / 1024) + " Ko"); });
  t = Date.now(); SpreadsheetApp.openById(ssId_()); out.push("Ouverture du tableur : " + (Date.now() - t) + " ms");
  try { var sh = SpreadsheetApp.openById(ssId_()).getSheets(); out.push("Feuilles les plus grosses :"); sh.map(function (f) { return [f.getName(), f.getLastRow(), f.getLastColumn()]; }).sort(function (a, b) { return b[1] * b[2] - a[1] * a[2]; }).slice(0, 6).forEach(function (f) { out.push("   " + f[0] + " : " + f[1] + " lignes × " + f[2] + " colonnes"); }); } catch (e) {}
  out.push("Lecture ciblée : " + (epProp_("RAPIDE_CIBLE") === "OUI" ? "✅ active" : "❌ inactive → lancez testerRapidite()"));
  var nbSess = (tailles["SESS_"] || { n: 0 }).n + (tailles["EP3S_"] || { n: 0 }).n;
  if (total > 350 * 1024) out.push("⚠️ Les propriétés approchent de la limite : lancez nettoyerSessionsExpirees().");
  if (nbSess > 300) out.push("⚠️ " + nbSess + " sessions enregistrées : lancez nettoyerSessionsExpirees().");
  Logger.log(out.join("\n"));
}
// Supprime les sessions et liaisons expirées (aussi fait chaque nuit)
function nettoyerSessionsExpirees() {
  if (typeof reserveEditeurOuDeclencheur_ === "function") reserveEditeurOuDeclencheur_(arguments[0]);
  var n = 0; try { n += ep3NettoyerSessions_() || 0; } catch (e) {} try { n += ep4Nettoyer_() || 0; } catch (e) {}
  var all = epProps_().getProperties(), now = Date.now(), lim = 10 * 3600000;
  Object.keys(all).forEach(function (k) { if (k.indexOf("SESS_") !== 0) return; try { var s = JSON.parse(all[k]); if (s && s.debut && now - s.debut > lim + 3600000) { epProps_().deleteProperty(k); n++; } } catch (e) {} });
  Logger.log("🧹 " + n + " entrée(s) expirée(s) supprimée(s).");
  return n;
}

// ════════════════════ 9. RAPIDITÉ (mise à jour 21) ════════════════════
//  Une même requête relisait plusieurs fois les mêmes feuilles et la même session.
//  Désormais, pendant UNE exécution, chaque feuille n'est lue qu'une fois (copie
//  remise à jour dès qu'on y écrit), et chaque session n'est vérifiée qu'une fois.
var EP2_MEMO = { prof: 0, M: {}, S: {} };
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  if (typeof g.epLire_ === "function" && !g.epLire_.__memo) {
    var lire = g.epLire_, ajouter = g.epAjouter_, maj = g.epMaj_;
    g.epLire_ = function (nom) {
      if (!EP2_MEMO.prof) return lire(nom);
      var M = EP2_MEMO.M; if (!M[nom]) M[nom] = lire(nom);
      return M[nom].map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; return c; });
    };
    g.epLire_.__memo = true;
    g.epAjouter_ = function (nom) { delete EP2_MEMO.M[nom]; return ajouter.apply(this, arguments); };
    g.epMaj_ = function (nom) { delete EP2_MEMO.M[nom]; return maj.apply(this, arguments); };
  }
  ["lireSession_", "sessCli_"].forEach(function (nom) {
    var f = g[nom]; if (typeof f !== "function" || f.__memo) return;
    var w = function (j) {
      if (!EP2_MEMO.prof || typeof j !== "string") return f.apply(this, arguments);
      var S = EP2_MEMO.S, k = nom + ":" + j; if (!(k in S)) S[k] = f.apply(this, arguments); return S[k];
    };
    Object.keys(f).forEach(function (k) { w[k] = f[k]; }); w.__memo = true; g[nom] = w;
  });
  // CV : les coordonnées de paiement s'affichent aussi dans l'espace client
  var cva = g.apiCVAccueil;
  if (typeof cva === "function" && !cva.__pay) {
    var w2 = function () { var r = cva.apply(this, arguments); try { if (r && r.ok && ep3Coord_().numero) r.paiement = ep3TextePaiement_() + " — indiquez le numéro de votre CV en commentaire."; } catch (e) {} return r; };
    Object.keys(cva).forEach(function (k) { w2[k] = cva[k]; }); w2.__pay = true; g.apiCVAccueil = w2;
  }
})();

// ════════════════════ 15. CONSIGNES DES TÂCHES : texte + fichiers joints (mise à jour 28) ════════════════════
//  L'administration écrit les instructions d'une tâche et joint des fichiers (consignes du directeur,
//  plan, sources…). SEUL le membre à qui la tâche est attribuée (et l'administration) peut les lire
//  et télécharger : depuis la liste des Tâches et depuis les Outils de travail de la commande.
//  Fichiers rangés dans Drive (dossier « AssistAcad · Consignes des tâches », jamais partagé) ;
//  chaque téléchargement est noté.
var EP15 = { F: "ConsignesTaches", MAX_MO: 10, MAX_FICHIERS: 8, MAX_TEXTE: 20000 };
var EP15_ENT = ["ID tache", "N° commande", "Consignes", "Fichiers", "Mis a jour le", "Par", "Vu par l'employe le", "Telechargements"];
function ep15Tache_(id) {
  id = String(id || "").trim(); if (!id) return null;
  if (typeof tacheParId_ === "function") { try { var l = tacheParId_(id); if (l) return l; } catch (e) {} }
  return epLire_(epFTaches_()).filter(function (t) { return String(t["ID"]) === id; })[0] || null;
}
function ep15Autorise_(s, t) {
  if (!s || !t) return false;
  if (epEstAdmin_(s)) return true;
  var a = String(t["Assigne a"] || "");
  return a === String(s.id) || (a === String(s.nom) && ep2NomUnique_(s.nom));
}
function ep15Ligne_(id) { return epLire_(EP15.F).filter(function (o) { return String(o["ID tache"]) === String(id); })[0] || null; }
function ep15Fichiers_(o) { try { return o ? JSON.parse(String(o["Fichiers"] || "[]")) : []; } catch (e) { return []; } }
function ep15Vue_(o, admin) {
  if (!o) return { texte: "", fichiers: [], maj: "", vu: "" };
  return { texte: String(o["Consignes"] || ""), fichiers: ep15Fichiers_(o).map(function (f) { return { id: f.id, nom: f.nom, taille: f.taille, type: f.type }; }),
    maj: o["Mis a jour le"] ? epDate_(epParseDate_(o["Mis a jour le"]) || new Date(), "dd/MM HH:mm") : "", par: admin ? String(o["Par"] || "") : "",
    vu: admin && o["Vu par l'employe le"] ? epDate_(epParseDate_(o["Vu par l'employe le"]) || new Date(), "dd/MM HH:mm") : "" };
}
// Consignes d'une tâche (membre attribué ou administration)
function apiConsigneLire(jeton, idTache) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var t = ep15Tache_(idTache); if (!t) return { ok: false, msg: "Tâche introuvable." };
  if (!ep15Autorise_(s, t)) return { ok: false, msg: "Cette tâche ne vous est pas attribuée." };
  var admin = epEstAdmin_(s), o = ep15Ligne_(idTache);
  if (o && !admin && !o["Vu par l'employe le"]) { try { epMaj_(EP15.F, o._row, { "Vu par l'employe le": new Date() }); } catch (e) {} }
  var v = ep15Vue_(o, admin);
  return { ok: true, admin: admin, id: String(t["ID"]), titre: String(t["Titre"] || ""), commande: String(t["N° commande"] || ""), assigne: String(t["Assigne a"] || ""),
    texte: v.texte, fichiers: v.fichiers, maj: v.maj, par: v.par, vu: v.vu, maxMo: EP15.MAX_MO, maxFichiers: EP15.MAX_FICHIERS };
}
// Enregistrer (administration) : texte + nouveaux fichiers [{nom, mime, b64}] + fichiers à retirer [id]
function apiConsigneEnregistrer(jeton, idTache, texte, nouveaux, retirer) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  var t = ep15Tache_(idTache); if (!t) return { ok: false, msg: "Tâche introuvable." };
  texte = String(texte == null ? "" : texte).slice(0, EP15.MAX_TEXTE);
  nouveaux = Array.isArray(nouveaux) ? nouveaux : []; retirer = Array.isArray(retirer) ? retirer.map(String) : [];
  var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return { ok: false, msg: "Serveur occupé : réessayez dans un instant." };
  try {
    epFeuille_(EP15.F, EP15_ENT);
    var o = ep15Ligne_(idTache), fics = ep15Fichiers_(o).filter(function (f) {
      if (retirer.indexOf(String(f.id)) === -1) return true;
      try { DriveApp.getFileById(String(f.id)).setTrashed(true); } catch (e) {}
      return false;
    });
    if (fics.length + nouveaux.length > EP15.MAX_FICHIERS) return { ok: false, msg: "Maximum " + EP15.MAX_FICHIERS + " fichiers par tâche." };
    var dossier = null;
    for (var i = 0; i < nouveaux.length; i++) {
      var n = nouveaux[i] || {}, nom = String(n.nom || "fichier").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120), b64 = String(n.b64 || "");
      if (!b64) continue;
      var octets = Utilities.base64Decode(b64);
      if (octets.length > EP15.MAX_MO * 1024 * 1024) return { ok: false, msg: "« " + nom + " » dépasse " + EP15.MAX_MO + " Mo." };
      if (!dossier) dossier = epDossier_("EP15_DOSSIER", "AssistAcad · Consignes des tâches");
      var f = dossier.createFile(Utilities.newBlob(octets, String(n.mime || "application/octet-stream"), String(t["ID"]) + " — " + nom));
      fics.push({ id: f.getId(), nom: nom, taille: octets.length, type: String(n.mime || "") });
    }
    var champs = { "ID tache": String(t["ID"]), "N° commande": String(t["N° commande"] || ""), "Consignes": texte, "Fichiers": JSON.stringify(fics), "Mis a jour le": new Date(), "Par": String(a.nom || a.id), "Vu par l'employe le": "" };
    if (o) epMaj_(EP15.F, o._row, champs); else { champs["Telechargements"] = 0; epAjouter_(EP15.F, champs); }
  } finally { lock.releaseLock(); }
  // Le membre est prévenu (message interne de l'intranet + Telegram s'il l'a relié)
  var dest = String(t["Assigne a"] || ""), info = "📋 Nouvelles consignes pour la tâche « " + String(t["Titre"] || t["ID"]) + " »" + (t["N° commande"] ? " (" + t["N° commande"] + ")" : "") + " : ouvrez Tâches › 📋 Consignes, ou les Outils de travail de la commande.";
  try { var fi = epSS_().getSheetByName(typeof F_INTERNES !== "undefined" ? F_INTERNES : "MessagesInternes"); if (fi && dest) fi.appendRow([new Date(), String(a.nom || "Administration"), dest, info, ""]); } catch (e) {}
  try { var m = epMembres_().filter(function (x) { return x.id === dest || x.nom === dest; })[0];
    if (m && m.email && MailApp.getRemainingDailyQuota() > 5) MailApp.sendEmail({ to: m.email, subject: "AssistAcad · Nouvelles consignes : " + String(t["Titre"] || t["ID"]), body: "Bonjour " + m.nom + ",\n\n" + info.replace(/^📋 /, "") + "\n\nPar sécurité, les consignes et les fichiers ne sont lisibles que dans l'espace AssistAcad.\n\nL'administration AssistAcad", name: "AssistAcad" }); } catch (e) {}
  return { ok: true, msg: "Consignes enregistrées" + (dest ? " — " + dest + " est prévenu(e)." : "."), fichiers: fics.length };
}
// Télécharger un fichier joint (membre attribué ou administration)
function apiConsigneFichier(jeton, idTache, idFichier) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var t = ep15Tache_(idTache); if (!t || !ep15Autorise_(s, t)) return { ok: false, msg: "Cette tâche ne vous est pas attribuée." };
  var o = ep15Ligne_(idTache), f = ep15Fichiers_(o).filter(function (x) { return String(x.id) === String(idFichier); })[0];
  if (!f) return { ok: false, msg: "Fichier introuvable." };
  var b; try { b = DriveApp.getFileById(String(f.id)).getBlob(); } catch (e) { return { ok: false, msg: "Fichier supprimé de Drive." }; }
  try { epMaj_(EP15.F, o._row, { "Telechargements": (Number(o["Telechargements"]) || 0) + 1 }); } catch (e) {}
  return { ok: true, nom: f.nom, mime: b.getContentType() || f.type || "application/octet-stream", b64: Utilities.base64Encode(b.getBytes()) };
}
// Résumé pour la liste des tâches : quelles tâches ont des consignes (une seule lecture)
function apiConsignesResume(jeton) {
  var s = epMembre_(jeton); if (!s) return EP_DECO;
  var admin = epEstAdmin_(s), res = {};
  var lignes = epLire_(EP15.F); if (!lignes.length) return { ok: true, consignes: res };
  var miennes = null;
  if (!admin) { miennes = {}; epLire_(epFTaches_()).forEach(function (t) { if (ep15Autorise_(s, t)) miennes[String(t["ID"])] = 1; }); }
  lignes.forEach(function (o) {
    var id = String(o["ID tache"]); if (!admin && !miennes[id]) return;
    var nf = ep15Fichiers_(o).length; if (!String(o["Consignes"] || "").trim() && !nf) return;
    res[id] = { f: nf, nouveau: !admin && !o["Vu par l'employe le"] };
  });
  return { ok: true, consignes: res };
}
// Juste après « Créer » dans le formulaire Nouvelle tâche : joindre les consignes à la tâche qui vient d'être créée
function apiConsigneApresCreation(jeton, info, texte, fichiers) {
  var a = epAdminSess_(jeton); if (!a) return EP_ADMIN_SEUL;
  info = info || {}; var titre = String(info.titre || "").trim(), num = ep2Num_(info.commande || "");
  if (!titre) return { ok: false, msg: "Titre de la tâche absent." };
  var deja = {}; epLire_(EP15.F).forEach(function (o) { deja[String(o["ID tache"])] = 1; });
  var l = epLire_(epFTaches_()).filter(function (x) {
    if (String(x["Titre"] || "").trim() !== titre || deja[String(x["ID"])]) return false;
    if (num && ep2Num_(x["N° commande"]) !== num) return false;
    var c = epParseDate_(x["Creee le"]); return !c || Date.now() - c.getTime() < 15 * 60000;
  });
  if (!l.length) return { ok: false, attente: true, msg: "Tâche pas encore enregistrée." };
  var r = apiConsigneEnregistrer(jeton, String(l[l.length - 1]["ID"]), texte, fichiers, []);
  return r.ok ? { ok: true, msg: "📋 Consignes jointes à la tâche « " + titre + " » : le membre est prévenu." } : r;
}
// Outils de travail : les consignes de chaque tâche de la commande arrivent avec l'ouverture
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this, base = g.apiOutils2Ouvrir;
  if (typeof base !== "function" || base.__ep15) return;
  var w = function (jeton, numero) {
    var r = base.apply(this, arguments);
    try {
      if (r && r.ok && r.taches && r.taches.length) {
        var lignes = epLire_(EP15.F), admin = !!r.admin;
        r.taches.forEach(function (t) { var o = lignes.filter(function (x) { return String(x["ID tache"]) === String(t.id); })[0]; if (o) t.consigne = ep15Vue_(o, admin); });
      }
    } catch (e) {}
    return r;
  };
  Object.keys(base).forEach(function (k) { w[k] = base[k]; }); w.__ep15 = true; g.apiOutils2Ouvrir = w;
  // Création d'une tâche avec ses consignes (champ ajouté au formulaire « Nouvelle tâche »)
  ["apiCreerTache2", "apiCreerTache"].forEach(function (nom) {
    var b0 = g[nom]; if (typeof b0 !== "function" || b0.__ep15) return;
    var w2 = function (jeton, t) {
      var texte = "", fics = [];
      if (t && typeof t === "object") { texte = String(t.consignes || ""); fics = Array.isArray(t.fichiersConsignes) ? t.fichiersConsignes : []; delete t.consignes; delete t.fichiersConsignes; }
      var r = b0.apply(this, arguments);
      if ((texte.trim() || fics.length) && r && r.ok !== false && epAdminSess_(jeton)) {
        try {
          var id = r.id || r.tache || "";
          if (!id) { var l = epLire_(epFTaches_()).filter(function (x) { return String(x["Titre"]) === String(t.titre || "") && (!t.commande || ep2Num_(x["N° commande"]) === ep2Num_(t.commande)); }); if (l.length) id = String(l[l.length - 1]["ID"]); }
          var rc = id ? apiConsigneEnregistrer(jeton, id, texte, fics, []) : { ok: false, msg: "tâche introuvable" };
          r.msg = (r.msg || "Tâche créée.") + (rc.ok ? " 📋 Consignes jointes, le membre est prévenu." : " ⚠️ Consignes non enregistrées (" + rc.msg + ") : ajoutez-les avec le bouton 📋 Consignes.");
        } catch (e) { r.msg = (r.msg || "Tâche créée.") + " ⚠️ Consignes non enregistrées : ajoutez-les avec le bouton 📋 Consignes."; }
      }
      return r;
    };
    Object.keys(b0).forEach(function (k) { w2[k] = b0[k]; }); w2.__ep15 = true; g[nom] = w2;
  });
  if (typeof PART_OK_ !== "undefined") ["apiConsigneLire", "apiConsigneFichier", "apiConsignesResume"].forEach(function (n) { PART_OK_[n] = 1; });
})();

// ════════════════════ 16. RATTACHER SES COMMANDES À TELEGRAM (mise à jour 30) ════════════════════
//  Les commandes passées par le FORMULAIRE (site) n'ont pas de « Chat ID » : le bot ne pouvait donc
//  rien dire au client sur ces commandes. Trois façons de les rattacher, toutes vérifiées :
//   1. dans le bot : bouton « 🔗 Rattacher une commande » (ou /rattacher, ou en tapant le numéro) →
//      un code à 6 chiffres est envoyé à l'e-mail de la commande → le client le tape → rattaché ;
//   2. dans l'espace client (web) › Mon compte : « 🔗 Rattacher mes commandes à Telegram » (lien direct) ;
//   3. l'administration envoie à tous ces clients un e-mail avec leur lien personnel :
//      inviterRattachementTelegram() (depuis l'éditeur).
//  Une fois vérifié, TOUTES les commandes de la même adresse e-mail sans Chat ID sont rattachées.
var EP16 = { F_INV: "RattachementsTG", ESSAIS: 5, CODE_MIN: 15, INV_JOURS: 30, INV_MAX_JOUR: 80 };
var EP16_RX_NUM = /^\s*([A-Za-z]{2,6}-\d{2}-\d{2,6})\s*$/;
var EP16_T = {
  fr: { demande: "🔗 <b>Rattacher une commande</b>\nEnvoyez le numéro de la commande passée sur le site (exemple : <code>CMD-26-0001</code>).",
    introuvable: "Je ne trouve pas la commande {n}. Vérifiez le numéro (il figure dans l'e-mail de confirmation).",
    deja: "✅ La commande {n} est déjà rattachée à ce compte Telegram.",
    autre: "Cette commande est déjà rattachée à un autre compte Telegram. Si c'est une erreur, écrivez à l'administration.",
    sansMail: "Cette commande n'a pas d'adresse e-mail : l'administration va la rattacher pour vous. Elle est prévenue.",
    code: "📩 Un code à 6 chiffres vient d'être envoyé à <b>{e}</b>.\nEnvoyez-le ici (valable 15 minutes).",
    faux: "Code incorrect. Il vous reste {k} essai(s).", bloque: "Trop d'essais. Recommencez avec /rattacher.",
    ok: "✅ <b>C'est fait !</b> Commande(s) rattachée(s) à votre Telegram : {l}.\nVous pouvez maintenant suivre l'avancement ici, avec « 📦 Mes commandes ».",
    proposer: "La commande {n} a été passée sur le site et n'est pas encore rattachée à votre Telegram. Rattachez-la pour que je puisse vous informer :",
    bouton: "🔗 Rattacher {n}", bMenu: "🔗 Rattacher une commande", expire: "Ce lien a expiré ou a déjà servi. Utilisez /rattacher.",
    rien: "Aucune commande sans Telegram n'a été trouvée pour cette adresse. Si vous avez commandé sur le site, envoyez /rattacher.",
    aide: "📌 Vous avez commandé sur le site ? Rattachez la commande à votre Telegram pour la suivre ici :" },
  en: { demande: "🔗 <b>Link an order</b>\nSend the number of the order you placed on the website (example: <code>CMD-26-0001</code>).",
    introuvable: "I can't find order {n}. Please check the number (it is in the confirmation e-mail).",
    deja: "✅ Order {n} is already linked to this Telegram account.",
    autre: "This order is already linked to another Telegram account. If this is a mistake, please contact us.",
    sansMail: "This order has no e-mail address: our team will link it for you. They have been notified.",
    code: "📩 A 6-digit code has just been sent to <b>{e}</b>.\nSend it here (valid for 15 minutes).",
    faux: "Wrong code. {k} attempt(s) left.", bloque: "Too many attempts. Start again with /link.",
    ok: "✅ <b>Done!</b> Order(s) linked to your Telegram: {l}.\nYou can now follow their progress here with « 📦 My orders ».",
    proposer: "Order {n} was placed on the website and is not linked to your Telegram yet. Link it so I can keep you informed:",
    bouton: "🔗 Link {n}", bMenu: "🔗 Link an order", expire: "This link has expired or was already used. Use /link.",
    rien: "No order without Telegram was found for this address. If you ordered on the website, send /link.",
    aide: "📌 Ordered on the website? Link the order to your Telegram to follow it here:" }
};
function ep16L_(lang) { return EP16_T[lang === "en" ? "en" : "fr"]; }
function ep16F_(s, o) { return String(s).replace(/\{(\w)\}/g, function (m, k) { return o[k] === undefined ? m : o[k]; }); }
function ep16Lang_(chat, from) { try { if (typeof langue_ === "function") return langue_(chat, from); } catch (e) {} var c = String(from && from.language_code || "").slice(0, 2); return c === "en" ? "en" : "fr"; }
function ep16Masque_(e) { e = String(e || ""); var p = e.split("@"); if (p.length !== 2) return "votre adresse"; return p[0].slice(0, 2) + "•••" + "@" + p[1]; }
function ep16Feuille_() { var n = (typeof FEUILLE !== "undefined" && FEUILLE.SUIVI) || "Suivi"; return epSS_().getSheetByName(n); }
// Toutes les lignes du Suivi (avec numéro de ligne) : lecture complète, seulement pendant un rattachement
function ep16Lignes_() {
  var f = ep16Feuille_(); if (!f || f.getLastRow() < 2) return { f: f, h: [], l: [] };
  var v = f.getDataRange().getValues(), h = v[0].map(String), l = [];
  for (var i = 1; i < v.length; i++) { var o = { _row: i + 1 }; for (var j = 0; j < h.length; j++) o[h[j]] = v[i][j]; l.push(o); }
  return { f: f, h: h, l: l };
}
function ep16Col_(h, noms) { for (var i = 0; i < noms.length; i++) { var c = h.indexOf(noms[i]); if (c !== -1) return c; } return -1; }
function ep16Email_(o) { return String(o["Email"] || o["E-mail"] || o["Adresse e-mail"] || "").trim().toLowerCase(); }
function ep16Chat_(o) { return String(o["Chat ID"] || "").trim(); }
// Rattache à ce chat la commande « num » ET toutes les commandes du même e-mail qui n'ont pas de Chat ID
function ep16Rattacher_(chat, email, num) {
  var T = ep16Lignes_(); if (!T.f) return [];
  var cc = ep16Col_(T.h, ["Chat ID"]); if (cc === -1) return [];
  var lc = ep16Col_(T.h, ["Langue bot"]), faits = {};
  email = String(email || "").toLowerCase();
  T.l.forEach(function (o) {
    var n = ep2Num_(o["N° commande"]); if (!n) return;
    var memeCmd = num && n === ep2Num_(num), memeMail = email && ep16Email_(o) === email && !ep16Chat_(o);
    if ((memeCmd && !ep16Chat_(o)) || memeMail) { T.f.getRange(o._row, cc + 1).setValue(String(chat)); faits[n] = 1; }
  });
  try { CacheService.getScriptCache().remove("TGCMD_" + chat); } catch (e) {}
  return Object.keys(faits);
}
function ep16Env_(chat, texte, clavier) { var p = { chat_id: chat, text: texte, parse_mode: "HTML", disable_web_page_preview: true }; if (clavier) p.reply_markup = clavier; ep3TgApi_("sendMessage", p); }
function ep16Bouton_(L) { return { inline_keyboard: [[{ text: L.bMenu, callback_data: "RCAT" }]] }; }
// Étape « numéro reçu » : contrôle, puis code envoyé à l'e-mail de la commande
function ep16Numero_(chat, lang, num) {
  var L = ep16L_(lang), c = CacheService.getScriptCache();
  var T = ep16Lignes_(), lignes = T.l.filter(function (o) { return ep2Num_(o["N° commande"]) === ep2Num_(num); });
  if (!lignes.length) { c.put("RC_" + chat, JSON.stringify({ e: "num" }), 900); ep16Env_(chat, ep16F_(L.introuvable, { n: num })); return; }
  var chats = lignes.map(ep16Chat_).filter(String);
  if (chats.indexOf(String(chat)) !== -1) { c.remove("RC_" + chat); ep16Env_(chat, ep16F_(L.deja, { n: num })); return; }
  if (chats.length) { c.remove("RC_" + chat); ep16Env_(chat, L.autre); return; }
  var email = lignes.map(ep16Email_).filter(String)[0] || "";
  if (!email) { c.remove("RC_" + chat); ep16Env_(chat, L.sansMail); try { epAdminTg_("🔗 Demande de rattachement Telegram pour <b>" + ep2Num_(num) + "</b> (commande sans e-mail) : chat " + chat + ". Mettez ce numéro dans la colonne Chat ID du Suivi."); } catch (e) {} return; }
  // Anti-abus : quelqu'un qui tape des numéros au hasard ne peut pas inonder de codes les clients ni vider le quota d'e-mails
  if (!ep2Quota_("RCQ_C" + chat, 3, 3600) || !ep2Quota_("RCQ_N" + ep2Num_(num), 2, 3600) || !ep2Quota_("RCQ_J", 30, 86400) || MailApp.getRemainingDailyQuota() < 20) {
    c.remove("RC_" + chat); ep16Env_(chat, lang === "en" ? "Too many requests: please try again later, or write to us here." : "Trop de demandes : réessayez plus tard, ou écrivez-nous ici."); return; }
  var code = String(Math.floor(100000 + Math.random() * 900000));
  c.put("RC_" + chat, JSON.stringify({ e: "code", n: ep2Num_(num), m: email, h: Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code + "|" + chat)), k: 0 }), EP16.CODE_MIN * 60);
  try {
    MailApp.sendEmail({ to: email, name: "AssistAcad", subject: "AssistAcad · Code pour rattacher votre commande " + ep2Num_(num) + " à Telegram",
      body: "Bonjour,\n\nVotre code : " + code + "\n\nTapez-le dans le bot Telegram @" + epProp_("BOT_USERNAME", "acades_bot") + " pour suivre votre commande " + ep2Num_(num) + " dans Telegram.\nValable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nL'équipe AssistAcad",
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0E1A13"><p>Bonjour,</p><p>Votre code pour rattacher la commande <b>' + ep2Num_(num) + '</b> à Telegram :</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#0B7A34">' + code + '</p><p>Tapez-le dans le bot <b>@' + epProp_("BOT_USERNAME", "acades_bot") + '</b>. Valable 15 minutes.</p><p style="color:#4F6156;font-size:13px">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p></div>' });
  } catch (e) { c.remove("RC_" + chat); ep16Env_(chat, "⚠️ E-mail impossible à envoyer pour le moment. Réessayez plus tard ou écrivez à l'administration."); return; }
  ep16Env_(chat, ep16F_(L.code, { e: ep16Masque_(email) }));
}
function ep16Code_(chat, lang, st, code) {
  var L = ep16L_(lang), c = CacheService.getScriptCache();
  var h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code + "|" + chat));
  if (h !== st.h) {
    st.k = (st.k || 0) + 1;
    if (st.k >= EP16.ESSAIS) { c.remove("RC_" + chat); ep16Env_(chat, L.bloque); return; }
    c.put("RC_" + chat, JSON.stringify(st), EP16.CODE_MIN * 60); ep16Env_(chat, ep16F_(L.faux, { k: EP16.ESSAIS - st.k })); return;
  }
  c.remove("RC_" + chat);
  var faits = ep16Rattacher_(chat, st.m, st.n);
  ep16Env_(chat, ep16F_(L.ok, { l: faits.join(", ") || st.n }));
  try { if (typeof mesCommandes2_ === "function") mesCommandes2_(chat, lang); } catch (e) {}
}
// Lien direct (espace client ou e-mail d'invitation) : /start RC<jeton>
function ep16Lien_(chat, lang, jeton) {
  var L = ep16L_(lang), c = CacheService.getScriptCache(), email = "";
  var brut = c.get("RCL_" + jeton), seule = "";
  if (brut) { var ob = JSON.parse(brut); email = ob.m; seule = ob.n || ""; c.remove("RCL_" + jeton); }
  else {
    var f = epSS_().getSheetByName(EP16.F_INV);
    if (f) { var hj = ep16Hj_(jeton), o = epLire_(EP16.F_INV).filter(function (x) { return String(x["Jeton"]) === hj && !x["Utilise le"] && epParseDate_(x["Expire"]) && epParseDate_(x["Expire"]).getTime() > Date.now(); })[0];
      if (o) { email = String(o["Email"]); epMaj_(EP16.F_INV, o._row, { "Utilise le": new Date(), "Chat ID": String(chat) }); } }
  }
  if (!email) { ep16Env_(chat, L.expire); return; }
  // Lien donné après une commande passée sans compte : il ne rattache QUE cette commande
  var faits = seule ? ep16Rattacher_(chat, "", seule) : ep16Rattacher_(chat, email, "");
  ep16Env_(chat, faits.length ? ep16F_(L.ok, { l: faits.join(", ") }) : L.rien);
  if (faits.length) try { if (typeof mesCommandes2_ === "function") mesCommandes2_(chat, lang); } catch (e) {}
}
function ep16Hj_(j) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "rc|" + j)).slice(0, 32); }
// Lecture d'un message Telegram : true si le message concernait un rattachement (le bot ne le traite pas)
function ep16Tg_(e) {
  var b = null; try { b = JSON.parse(e.postData.contents); } catch (x) { return false; }
  var m = b && b.message, q = b && b.callback_query;
  if (!m && !q) return false;
  if (typeof webhookAutorise_ === "function" && !webhookAutorise_(e)) return false;     // le bot refusera de lui-même
  if (q && typeof q.data === "string" && /^RCAT(:[A-Za-z0-9-]{4,40})?$/.test(q.data)) {
    var chq = q.message && q.message.chat ? q.message.chat.id : (q.from || {}).id, lq = ep16Lang_(chq, q.from);
    ep3TgApi_("answerCallbackQuery", { callback_query_id: q.id });
    var nq = q.data.split(":")[1];
    if (nq) ep16Numero_(chq, lq, nq); else { CacheService.getScriptCache().put("RC_" + chq, JSON.stringify({ e: "num" }), 900); ep16Env_(chq, ep16L_(lq).demande); }
    return true;
  }
  if (!m || typeof m.text !== "string" || !m.chat) return false;
  var chat = m.chat.id, tx = m.text.trim(), lang = null, lg = function () { return lang || (lang = ep16Lang_(chat, m.from)); };
  if (/^\/start RC[A-Za-z0-9]{24}$/.test(tx)) { ep16Lien_(chat, lg(), tx.slice(9)); return true; }
  if (/^\/(rattacher|link)(@\w+)?$/i.test(tx)) { CacheService.getScriptCache().put("RC_" + chat, JSON.stringify({ e: "num" }), 900); ep16Env_(chat, ep16L_(lg()).demande); return true; }
  var estNum = EP16_RX_NUM.exec(tx), estCode = /^\d{6}$/.test(tx);
  if (!estNum && !estCode) return false;
  var st = null; try { st = JSON.parse(CacheService.getScriptCache().get("RC_" + chat) || "null"); } catch (x) {}
  if (st && st.e === "code" && estCode) { ep16Code_(chat, lg(), st, tx); return true; }
  if (st && st.e === "num" && estNum) { ep16Numero_(chat, lg(), estNum[1]); return true; }
  // Numéro tapé seul, hors questionnaire : si la commande n'est pas à ce Telegram, on propose de la rattacher
  if (estNum && !st) {
    try { var s0 = CacheService.getScriptCache().get("S_" + chat); if (s0) { var so = JSON.parse(s0); if (so && (so.mode || so.step)) return false; } } catch (x) {}
    var T = ep16Lignes_(), lignes = T.l.filter(function (o) { return ep2Num_(o["N° commande"]) === ep2Num_(estNum[1]); });
    if (!lignes.length || lignes.some(function (o) { return ep16Chat_(o) === String(chat); })) return false;
    if (lignes.some(function (o) { return ep16Chat_(o); })) return false;            // déjà à un autre compte : le bot répond comme avant
    var L = ep16L_(lg()), n = ep2Num_(estNum[1]);
    ep16Env_(chat, ep16F_(L.proposer, { n: n }), { inline_keyboard: [[{ text: ep16F_(L.bouton, { n: n }), callback_data: "RCAT:" + n }]] });
    return true;
  }
  return false;
}
// Espace client (web) : lien personnel vers le bot, valable 30 minutes
function apiCliLienTelegram(jeton) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var email = String(s.email || "").trim().toLowerCase();
  if (!email) return { ok: false, msg: "Ajoutez d'abord votre adresse e-mail dans Mon compte : c'est elle qui relie vos commandes." };
  var j = ep3Alea_(24); CacheService.getScriptCache().put("RCL_" + j, JSON.stringify({ m: email }), 1800);
  var n = ep16Lignes_().l.filter(function (o) { return ep16Email_(o) === email && !ep16Chat_(o); }).length;
  return { ok: true, lien: "https://t.me/" + epProp_("BOT_USERNAME", "acades_bot") + "?start=RC" + j, commandes: n };
}
// Administration (éditeur) : e-mail à chaque client du formulaire avec son lien personnel (30 jours)
function inviterRattachementTelegram() {
  if (typeof reserveEditeur_ === "function") reserveEditeur_();
  epFeuille_(EP16.F_INV, ["Jeton", "Email", "Commandes", "Envoye le", "Expire", "Utilise le", "Chat ID"]);
  var deja = {}; epLire_(EP16.F_INV).forEach(function (o) { deja[String(o["Email"]).toLowerCase()] = 1; });
  var parMail = {};
  ep16Lignes_().l.forEach(function (o) { var m = ep16Email_(o); if (!m || ep16Chat_(o) || deja[m] || !/@/.test(m)) return; (parMail[m] = parMail[m] || []).push(ep2Num_(o["N° commande"])); });
  var bot = epProp_("BOT_USERNAME", "acades_bot"), n = 0, reste = Math.min(EP16.INV_MAX_JOUR, MailApp.getRemainingDailyQuota() - 10);
  Object.keys(parMail).forEach(function (m) {
    if (n >= reste) return;
    var j = ep3Alea_(24), lien = "https://t.me/" + bot + "?start=RC" + j, cmds = parMail[m].filter(String).join(", ");
    try {
      MailApp.sendEmail({ to: m, name: "AssistAcad", subject: "AssistAcad · Suivez votre commande sur Telegram",
        body: "Bonjour,\n\nVous avez passé commande sur notre site (" + cmds + "). Pour suivre l'avancement, payer et recevoir votre travail directement dans Telegram, ouvrez ce lien personnel :\n" + lien + "\n\nUn seul appui sur « Démarrer » suffit. Lien valable 30 jours.\n\nL'équipe AssistAcad",
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0E1A13;line-height:1.55"><p>Bonjour,</p><p>Vous avez passé commande sur notre site (<b>' + cmds + '</b>). Suivez l’avancement, payez et recevez votre travail directement dans Telegram :</p><p><a href="' + lien + '" style="display:inline-block;background:#12B347;color:#06210F;font-weight:bold;padding:12px 20px;border-radius:10px;text-decoration:none">🔗 Rattacher ma commande à Telegram</a></p><p style="color:#4F6156;font-size:13px">Un seul appui sur « Démarrer » dans le bot @' + bot + ' suffit. Lien personnel, valable 30 jours.</p></div>' });
      epAjouter_(EP16.F_INV, { "Jeton": ep16Hj_(j), "Email": m, "Commandes": cmds, "Envoye le": new Date(), "Expire": new Date(Date.now() + EP16.INV_JOURS * 86400000) });
      n++;
    } catch (e) {}
  });
  var total = Object.keys(parMail).length;
  Logger.log("📧 " + n + " invitation(s) envoyée(s) sur " + total + " client(s) du formulaire sans Telegram." + (total > n ? " Relancez demain pour les " + (total - n) + " autres (quota d'e-mails)." : ""));
}
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  var env = function (nom, fn) { var cur = g[nom]; if (typeof cur !== "function" || cur.__ep16) return; var w = function () { return fn.call(this, cur, Array.prototype.slice.call(arguments)); }; Object.keys(cur).forEach(function (k) { w[k] = cur[k]; }); w.__ep16 = true; g[nom] = w; };
  env("doPost", function (base, a) {
    var e = a[0];
    try { if (e && e.postData && e.postData.contents && /"(message|callback_query)"/.test(e.postData.contents) && ep16Tg_(e)) return ContentService.createTextOutput("ok"); } catch (x) { console.error("rattachement : " + x); }
    var r = base.apply(this, a);
    // « Mes commandes » sans aucune commande à ce Telegram : proposer de rattacher une commande du site
    try {
      var b = JSON.parse(e.postData.contents), m = b.message, q = b.callback_query, chat = null, from = null;
      if (m && typeof m.text === "string" && /^\/(mescommandes|myorders)\b/.test(m.text.trim())) { chat = m.chat.id; from = m.from; }
      else if (q && q.data === "menu:mine") { chat = q.message && q.message.chat ? q.message.chat.id : (q.from || {}).id; from = q.from; }
      if (chat) {
        var a1 = typeof lignesOu_ === "function" ? lignesOu_((typeof FEUILLE !== "undefined" && FEUILLE.SUIVI) || "Suivi", "Chat ID", String(chat), 1) : null;
        if (a1 !== null && !a1.length) { var L = ep16L_(ep16Lang_(chat, from)); ep16Env_(chat, L.aide, ep16Bouton_(L)); }
      }
    } catch (x) {}
    return r;
  });
  if (typeof PART_OK_ !== "undefined") PART_OK_.apiCliLienTelegram = 1;
})();

// ════════════════════ 17. PASSER UNE COMMANDE DEPUIS L'ESPACE CLIENT (mise à jour 31) ════════════════════
//  Le même questionnaire que le bot (mêmes questions, mêmes choix de la feuille Choix, mêmes codes),
//  dans la langue du téléphone du client. À l'envoi, la commande passe par traiterCommande_ comme
//  dans le bot : numéro, prix calculé, réductions, échéancier, e-mails, alerte à l'administration.
var EP17 = { MAX_FICHIERS: 8, MAX_MO: 10, MAX_HEURE: 5 };
var EP17_LANGUES = ["fr", "en", "ru", "ar", "es", "pt", "zh", "tr", "de", "it", "uk", "uz", "kk", "ky", "tg", "fa", "hi", "bn", "sw", "id", "vi"];
var EP17_UI = {
  fr: { titre: "Passer une commande", intro: "Répondez aux questions : le prix est calculé dès l'envoi, comme dans le bot Telegram.", obl: "obligatoire", fac: "facultatif",
    autre: "Autre…", preciser: "Précisez", fichiers: "Fichiers joints", fichiersAide: "Consignes du professeur, plan, brouillon, photos… (8 fichiers, 10 Mo chacun)", ajouter: "📎 Ajouter des fichiers",
    verifier: "Vérifier le code", suite: "Vérifier ma commande", recap: "Votre commande", modifier: "✏️ Modifier", envoyer: "✅ Envoyer ma commande", envoi: "Envoi en cours…",
    manque: "Merci de compléter : ", emailKo: "Adresse e-mail incorrecte.", pagesKo: "Nombre de pages : écrivez un nombre entre 1 et 2000.", choisir: "Choisir…",
    telegram: "🔗 Ouvrir le bot : capture et suivi", nouvelle: "Passer une autre commande", aucun: "Aucun" },
  en: { titre: "Place an order", intro: "Answer the questions: the price is calculated as soon as you send, just like in the Telegram bot.", obl: "required", fac: "optional",
    autre: "Other…", preciser: "Please specify", fichiers: "Attached files", fichiersAide: "Teacher's instructions, outline, draft, photos… (8 files, 10 MB each)", ajouter: "📎 Add files",
    verifier: "Check code", suite: "Review my order", recap: "Your order", modifier: "✏️ Edit", envoyer: "✅ Send my order", envoi: "Sending…",
    manque: "Please complete: ", emailKo: "Invalid e-mail address.", pagesKo: "Number of pages: enter a number between 1 and 2000.", choisir: "Choose…",
    telegram: "🔗 Open the bot: screenshot & tracking", nouvelle: "Place another order", aucun: "None" },
  ru: { titre: "Оформить заказ", intro: "Ответьте на вопросы: стоимость рассчитывается сразу после отправки, как в Telegram-боте.", obl: "обязательно", fac: "необязательно",
    autre: "Другое…", preciser: "Уточните", fichiers: "Файлы", fichiersAide: "Требования преподавателя, план, черновик, фото… (8 файлов, до 10 МБ)", ajouter: "📎 Добавить файлы",
    verifier: "Проверить код", suite: "Проверить заказ", recap: "Ваш заказ", modifier: "✏️ Изменить", envoyer: "✅ Отправить заказ", envoi: "Отправка…",
    manque: "Заполните: ", emailKo: "Неверный адрес e-mail.", pagesKo: "Количество страниц: число от 1 до 2000.", choisir: "Выберите…",
    telegram: "🔗 Открыть бот: скриншот и статус", nouvelle: "Оформить ещё заказ", aucun: "Нет" },
  ar: { titre: "تقديم طلب", intro: "أجب عن الأسئلة: يُحسب السعر فور الإرسال، كما في بوت تيليجرام.", obl: "إلزامي", fac: "اختياري",
    autre: "أخرى…", preciser: "يرجى التوضيح", fichiers: "الملفات المرفقة", fichiersAide: "تعليمات الأستاذ، الخطة، المسودة، الصور… (8 ملفات، 10 ميغابايت لكل ملف)", ajouter: "📎 إضافة ملفات",
    verifier: "تحقق من الرمز", suite: "مراجعة طلبي", recap: "طلبك", modifier: "✏️ تعديل", envoyer: "✅ إرسال طلبي", envoi: "جارٍ الإرسال…",
    manque: "يرجى إكمال: ", emailKo: "عنوان البريد الإلكتروني غير صحيح.", pagesKo: "عدد الصفحات: أدخل رقمًا بين 1 و2000.", choisir: "اختر…",
    telegram: "🔗 افتح البوت: اللقطة والمتابعة", nouvelle: "تقديم طلب آخر", aucun: "لا يوجد" }
};
function ep17Lang_(l) { l = String(l || "").toLowerCase().slice(0, 2); return EP17_LANGUES.indexOf(l) !== -1 ? l : "fr"; }
function ep17Base_(l) { return ["fr", "en", "ru", "ar"].indexOf(l) !== -1 ? l : "en"; }
// Traduction des textes pour les langues du monde (même moteur et même cache que le bot)
function ep17Trad_(textes, l) {
  if (ep17Base_(l) === l || typeof traduireLot_ !== "function") return textes;
  try { return traduireLot_(textes, l); } catch (e) { return textes; }
}
function ep17SansBalises_(t) { return String(t || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(); }
// Texte du bot (HTML Telegram) → HTML sûr pour la page : seuls <b> <i> <code> sont gardés
function ep17Html_(t) {
  var s = String(t || "").replace(/&(?!(amp|lt|gt|quot|#39);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/&lt;(\/?)(b|i|code)&gt;/g, "<$1$2>").replace(/&lt;a [^&]*&gt;|&lt;\/a&gt;/g, "");
  return s.replace(/\n/g, "<br>");
}
function ep17Botok_() { return typeof T !== "undefined" && T.fr && T.fr.labels && typeof ETAPES !== "undefined" && typeof choix_ === "function"; }
function apiCmdFormulaire(jeton, langNav) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  if (!ep17Botok_()) return { ok: false, msg: "Module de commande indisponible : le fichier du bot est absent du projet." };
  var l = ep17Lang_(langNav), b = ep17Base_(l), L = T[b], ch = choix_(), ui = EP17_UI[b];
  var etapes = ETAPES.map(function (k) {
    var q = String((L.q || {})[k] || ""), m = /<i>([\s\S]*?)<\/i>/.exec(q), aide = m ? ep17SansBalises_(m[1]) : "";
    if (/Passer|Skip|Пропуст|تخط|Envoie|Send them|Отправь/i.test(aide) || k === "fichiers") aide = "";
    var e = { k: k, label: String((L.labels || {})[k] || k), aide: aide,
      type: ETAPES_CHOIX.indexOf(k) !== -1 ? "choix" : k === "email" ? "email" : k === "pages" ? "nombre" : k === "instructions" ? "zone" : k === "fichiers" ? "fichiers" : k === "code" ? "code" : "texte",
      optionnel: ETAPES_OPTION.indexOf(k) !== -1 || k === "fichiers" || k === "nom" };
    if (e.type === "choix") e.options = (ch[k] || []).map(function (v) { return { v: String(v), lib: typeof libChoix_ === "function" ? String(libChoix_(v, b)) : String(v) }; });
    return e;
  });
  // Langues du monde : tout part en un seul lot de traduction
  if (b !== l) {
    var txt = [], pose = [];
    etapes.forEach(function (e) { txt.push(e.label); pose.push(function (v) { e.label = v; }); if (e.aide) { txt.push(e.aide); pose.push(function (v) { e.aide = v; }); }
      (e.options || []).forEach(function (o) { txt.push(o.lib); pose.push(function (v) { o.lib = v; }); }); });
    var uiT = {}; Object.keys(ui).forEach(function (k) { txt.push(ui[k]); pose.push(function (v) { uiT[k] = v; }); });
    var tr = ep17Trad_(txt, l); tr.forEach(function (v, i) { pose[i](v); }); ui = uiT;
  }
  var nom = String(s.nom || "").trim().split(/\s+/);
  return { ok: true, lang: l, dir: l === "ar" || l === "fa" ? "rtl" : "ltr", ui: ui, etapes: etapes, maxFichiers: EP17.MAX_FICHIERS, maxMo: EP17.MAX_MO,
    pre: { prenom: nom[0] || "", nom: nom.slice(1).join(" "), email: String(s.email || "") } };
}
function apiCmdCode(jeton, code, email, langNav) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  if (typeof analyserCode_ !== "function") return { ok: false, msg: "Vérification des codes indisponible." };
  var l = ep17Lang_(langNav), b = ep17Base_(l), L = T[b], an = analyserCode_(ssId_(), String(code || "").trim(), String(email || s.email || "").trim());
  var txt;
  if (an.valide) txt = L.codeOk(an.code, Math.round(an.pct * 100));
  else { var r = b === "ru" && typeof RAISONS_RU !== "undefined" ? RAISONS_RU[an.raisonCode] : b === "ar" && typeof RAISONS_AR !== "undefined" ? RAISONS_AR[an.raisonCode] : (typeof RAISONS !== "undefined" && RAISONS[an.raisonCode] ? RAISONS[an.raisonCode][b] : "");
    txt = L.codeKo(an.code || code, r || "").split("\n")[0]; }
  return { ok: true, valide: !!an.valide, code: an.code || "", html: ep17Html_(ep17Trad_([txt], l)[0]) };
}
// Récapitulatif avant l'envoi (mêmes lignes que dans le bot, frais de réouverture compris)
function apiCmdRecap(jeton, d, langNav) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  var v = ep17Valider_(d); if (!v.ok) return v;
  var l = ep17Lang_(langNav), b = ep17Base_(l), lignes = [];
  ETAPES.forEach(function (k) { if (k === "fichiers") return; var x = d[k] ? (ETAPES_CHOIX.indexOf(k) !== -1 && typeof libChoix_ === "function" ? libChoix_(d[k], b) : d[k]) : "—"; lignes.push([String(T[b].labels[k] || k), String(x).slice(0, 400)]); });
  var mj = null; try { if (typeof majorationAnnulation_ === "function") mj = majorationAnnulation_({ chatId: s.chatId || "", email: d.email }); } catch (e) {}
  var note = mj ? ({ fr: "♻️ Frais de réouverture : +" + Math.round(mj.pct * 100) + " % (commande " + mj.annulee + " annulée). Vous verrez le montant exact avant de payer.", en: "♻️ Reopening fee: +" + Math.round(mj.pct * 100) + " % (order " + mj.annulee + " cancelled). You'll see the exact amount before paying.", ru: "♻️ Сбор за повторное оформление: +" + Math.round(mj.pct * 100) + " % (заказ " + mj.annulee + " отменён).", ar: "♻️ رسوم إعادة الفتح: +" + Math.round(mj.pct * 100) + "٪ (الطلب " + mj.annulee + " أُلغي)." })[b] : "";
  if (b !== l) { var tr = ep17Trad_(lignes.map(function (x) { return x[0]; }).concat(note ? [note] : []), l); lignes.forEach(function (x, i) { x[0] = tr[i]; }); if (note) note = tr[tr.length - 1]; }
  return { ok: true, lignes: lignes, note: note };
}
function ep17Valider_(d) {
  d = d || {};
  var manque = ETAPES.filter(function (k) { return k !== "fichiers" && k !== "nom" && ETAPES_OPTION.indexOf(k) === -1 && !String(d[k] || "").trim(); });
  if (manque.length) return { ok: false, manque: manque };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email).trim())) return { ok: false, manque: ["email"], email: true };
  var n = parseInt(String(d.pages).replace(/\D/g, ""), 10); if (!n || n > 2000) return { ok: false, manque: ["pages"], pages: true };
  var trop = ETAPES.filter(function (k) { return String(d[k] || "").length > (k === "instructions" ? 4000 : 300); }); if (trop.length) return { ok: false, manque: trop };
  return { ok: true };
}
function apiCmdEnvoyer(jeton, d, fichiers, langNav) {
  var s = epClient_(jeton); if (!s) return EP_DECO;
  if (!ep17Botok_() || typeof traiterCommande_ !== "function") return { ok: false, msg: "Commande impossible pour le moment : écrivez au bot @" + epProp_("BOT_USERNAME", "acades_bot") + "." };
  d = d || {}; var v = ep17Valider_(d); if (!v.ok) return v;
  fichiers = Array.isArray(fichiers) ? fichiers.slice(0, EP17.MAX_FICHIERS) : [];
  var c = CacheService.getScriptCache(), kq = "EP17Q_" + s.id, nq = Number(c.get(kq) || 0);
  if (nq >= EP17.MAX_HEURE) return { ok: false, msg: "Trop de commandes en une heure : réessayez plus tard ou écrivez au bot." };
  var l = ep17Lang_(langNav), b = ep17Base_(l), L = T[b];
  if (!s.chatId) { try { var cpt = ep3ComptePar_("Client ID", s.id) || (s.email ? ep3ComptePar_("Email", String(s.email).toLowerCase()) : null); if (cpt && cpt["Chat ID"]) s.chatId = String(cpt["Chat ID"]); } catch (e) {} }
  // Fichiers : rangés dans Drive (jamais partagés), liens ajoutés aux instructions pour l'équipe
  var liens = [];
  if (fichiers.length) {
    var dos = epDossier_("EP17_DOSSIER", "AssistAcad · Fichiers des commandes (site)");
    fichiers.forEach(function (f) {
      try { var o = Utilities.base64Decode(String(f.b64 || "")); if (!o.length || o.length > EP17.MAX_MO * 1024 * 1024) return;
        var fi = dos.createFile(Utilities.newBlob(o, String(f.mime || "application/octet-stream"), String(f.nom || "fichier").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120)));
        liens.push({ id: fi.getId(), nom: fi.getName(), url: fi.getUrl() }); } catch (e) {}
    });
  }
  var details = ETAPES.filter(function (k) { return k !== "fichiers"; }).map(function (k) { return [T.fr.labels[k], String(d[k] || "")]; });
  details.push(["Fichiers (site)", String(liens.length)]);
  var commande = { source: "Espace client", chatId: String(s.chatId || ""), username: "", langueBot: b, fichiersIds: [], details: details,
    prenom: String(d.prenom || "").trim(), nom: String(d.nom || "").trim(), email: String(d.email).trim().toLowerCase(), niveau: d.niveau, etablissement: d.etablissement, domaine: d.domaine,
    type: d.type, pages: String(parseInt(String(d.pages).replace(/\D/g, ""), 10)), complexite: d.complexite, delai: d.delai, langue: d.langue, sujet: d.sujet || "",
    instructions: String(d.instructions || "") + (liens.length ? "\n[📎 " + liens.length + " fichier(s) joint(s) sur le site : " + liens.map(function (x) { return x.nom; }).join(", ") + "]" : ""),
    codeParrain: "", codePromo: String(d.code || "").trim(), paiement: d.paiement };
  var lock = LockService.getScriptLock(), pris = false, res;
  try { lock.waitLock(25000); pris = true; } catch (e) {}
  if (!pris) return { ok: false, msg: lang === "en" ? "The server is busy: please press Send again in a few seconds." : "Serveur très occupé : appuyez de nouveau sur Envoyer dans quelques secondes." };   // sans verrou, deux commandes pourraient recevoir le même numéro
  try { res = traiterCommande_(commande); }
  catch (err) { try { epAdminTg_("🚨 <b>Erreur commande (espace client)</b>\n" + String(err).slice(0, 300) + "\nClient : " + (s.nom || s.id) + " · " + commande.email); } catch (e) {} return { ok: false, msg: "La commande n'a pas pu être enregistrée. L'administration est prévenue : réessayez dans un moment ou écrivez au bot." }; }
  finally { if (pris) try { lock.releaseLock(); } catch (e) {} }
  c.put(kq, String(nq + 1), 3600);
  // Dossier Drive au nom de la commande + liens pour l'administration
  if (liens.length && res && res.numero) {
    try { var dd = DriveApp.getFolderById(epProp_("EP17_DOSSIER")).createFolder(String(res.numero)); liens.forEach(function (x) { try { DriveApp.getFileById(x.id).moveTo(dd); } catch (e) {} }); } catch (e) {}
    try { epAdminTg_("📎 <b>" + res.numero + "</b> · " + liens.length + " fichier(s) joint(s) depuis l'espace client :\n" + liens.map(function (x) { return "• " + x.nom + " : " + x.url; }).join("\n")); } catch (e) {}
  }
  var cfg = typeof cfg_ === "function" ? cfg_() : {};
  var capt = { fr: "📸 <b>Envoyez ensuite la capture du paiement dans le bot Telegram @" + epProp_("BOT_USERNAME", "acades_bot") + "</b> (bouton ci-dessous). Le travail démarre dès validation.",
    en: "📸 <b>Then send the payment screenshot in the Telegram bot @" + epProp_("BOT_USERNAME", "acades_bot") + "</b> (button below). Work starts as soon as it is validated.",
    ru: "📸 <b>Затем отправьте скриншот оплаты в Telegram-бот @" + epProp_("BOT_USERNAME", "acades_bot") + "</b> (кнопка ниже). Работа начнётся сразу после проверки.",
    ar: "📸 <b>ثم أرسل لقطة شاشة الدفع في بوت تيليجرام @" + epProp_("BOT_USERNAME", "acades_bot") + "</b> (الزر أدناه). يبدأ العمل فور التحقق." }[b];
  var txt = L.devisOk(res) + (L.refuses ? L.refuses(res.codesRefuses || []) : "") + L.prix(res, cfg.CARTE) + (res.codeParrainagePerso && L.parrain ? L.parrain(res.codeParrainagePerso) : "") + (res.email && L.emailNote ? L.emailNote : "");
  txt = txt.replace(/📸[^\n]*/, capt);
  return { ok: true, numero: res.numero, html: ep17Html_(ep17Trad_([txt], l)[0]), devis: !!res.devis, telegram: !s.chatId, bot: "https://t.me/" + epProp_("BOT_USERNAME", "acades_bot") };
}
(function () { if (typeof PART_OK_ !== "undefined") ["apiCmdFormulaire", "apiCmdCode", "apiCmdRecap", "apiCmdEnvoyer"].forEach(function (n) { PART_OK_[n] = 1; }); })();

// ════════════════════ 17. « PASSER MA COMMANDE » SUR LE SITE (mise à jour 31) ════════════════════
//  Les MÊMES questions que le bot (feuille Choix, traductions du bot), dans une seule fenêtre.
//  « Envoyer » passe par le MÊME moteur que le bot (traiterCommande_) : numéro, prix, réductions,
//  codes, e-mails, alerte à l'administration… et le client voit le même message de prix que dans le bot.
var EP17 = { MAX_FICHIERS: 8, MAX_MO: 10, MAX_TOTAL_MO: 25, LANGUES: ["fr", "en", "ru", "ar"], PAR_MAIL_HEURE: 4, ANON_HEURE: 15, ANON_JOUR: 40 };
var EP17_REQUIS = ["prenom", "nom", "email", "niveau", "etablissement", "domaine", "type", "pages", "complexite", "delai", "langue", "paiement"];
function ep17Lang_(l) { l = String(l || "").toLowerCase().slice(0, 2); return EP17.LANGUES.indexOf(l) !== -1 ? l : "fr"; }
function ep17SansHtml_(t) { return String(t || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(); }
function ep17Html_(t) {   // HTML de Telegram (b, i, code, retours à la ligne) → HTML sûr pour la page
  var s = String(t || "").replace(/&(?!(amp|lt|gt|quot|#39);)/g, "&amp;").replace(/<(?!\/?(b|i|code|u)>)/g, "&lt;");
  return s.replace(/\n/g, "<br>");
}
function ep17Etapes_() { return typeof ETAPES !== "undefined" ? ETAPES : ["prenom", "nom", "email", "niveau", "etablissement", "domaine", "type", "pages", "complexite", "delai", "langue", "sujet", "instructions", "fichiers", "code", "paiement"]; }
function ep17Choix_() { return typeof ETAPES_CHOIX !== "undefined" ? ETAPES_CHOIX : ["niveau", "type", "complexite", "delai", "langue", "paiement"]; }
// La fenêtre : champs, libellés et options exactement comme dans le bot, dans la langue du client
function apiCmdFormulaire(jeton, lang) {
  lang = ep17Lang_(lang);
  if (typeof T === "undefined" || typeof choix_ !== "function") return { ok: false, msg: "Module de commande indisponible : passez par le bot @" + epProp_("BOT_USERNAME", "acades_bot") + "." };
  var L = T[lang] || T.fr, ch = choix_(), cc = ep17Choix_();
  var champs = ep17Etapes_().filter(function (k) { return k !== "fichiers"; }).map(function (k) {
    var q = String((L.q || {})[k] || ""), aide = (/<i>([\s\S]*?)<\/i>/.exec(q) || [])[1] || "";
    var o = { k: k, label: String((L.labels || {})[k] || k), aide: ep17SansHtml_(aide), requis: EP17_REQUIS.indexOf(k) !== -1 };
    if (cc.indexOf(k) !== -1) { o.type = "choix"; o.options = (ch[k] || []).map(function (v) { return { v: v, l: typeof libChoix_ === "function" ? libChoix_(v, lang) : v }; }); o.autre = true; }
    else o.type = k === "email" ? "email" : k === "pages" ? "nombre" : k === "instructions" ? "zone" : "texte";
    return o;
  });
  var s = epClient_(jeton), pre = {};
  if (s) { var nm = String(s.nom || "").trim().split(/\s+/); pre.prenom = nm[0] || ""; pre.nom = nm.slice(1).join(" "); pre.email = String(s.email || ""); }
  return { ok: true, lang: lang, champs: champs, prerempli: pre, connecte: !!s, maxFichiers: EP17.MAX_FICHIERS, maxMo: EP17.MAX_MO, maxTotalMo: EP17.MAX_TOTAL_MO,
    titreFichiers: String((L.labels || {}).fichiers || "Fichiers"), aideFichiers: ep17SansHtml_(String((L.q || {}).fichiers || "").split("\n")[0]) };
}
// Vérifier un code (promo, affiliation, groupe, parrainage) avant d'envoyer, comme dans le bot
function apiCmdCode(jeton, code, email, lang) {
  lang = ep17Lang_(lang); code = String(code || "").trim().slice(0, 40); if (!code) return { ok: false };
  if (!ep2Quota_("EP17C_" + String(email || "x").toLowerCase().slice(0, 60), 15, 900) || !ep2Quota_("EP17C_TOUS", 80, 900)) return { ok: false, msg: "Trop d'essais : réessayez dans 15 minutes." };
  if (typeof analyserCode_ !== "function") return { ok: true, inconnu: true };
  var an = analyserCode_(ssId_(), code, String(email || "").toLowerCase());
  if (an && an.valide) return { ok: true, valide: true, code: an.code, pct: Math.round((an.pct || 0) * 100) };
  var raison = "";
  try { raison = lang === "ru" && typeof RAISONS_RU !== "undefined" ? RAISONS_RU[an.raisonCode] : lang === "ar" && typeof RAISONS_AR !== "undefined" ? RAISONS_AR[an.raisonCode] : RAISONS[an.raisonCode][lang === "en" ? "en" : "fr"]; } catch (e) {}
  return { ok: true, valide: false, msg: raison || "code non valable" };
}
// Envoyer : contrôles du bot, fichiers rangés dans Drive, puis le moteur de commande du bot
function apiCmdEnvoyer(jeton, d, fichiers, piege, lang) {
  lang = ep17Lang_(lang); d = d || {}; fichiers = Array.isArray(fichiers) ? fichiers : [];
  var L = (typeof T !== "undefined" && (T[lang] || T.fr)) || null;
  if (!L || typeof traiterCommande_ !== "function") return { ok: false, msg: "Module de commande indisponible : passez par le bot." };
  if (piege) return { ok: true, html: "✅" };                                     // robot : on fait semblant
  var ch = choix_(), cc = ep17Choix_(), v = {}, err = [];
  ep17Etapes_().forEach(function (k) {
    if (k === "fichiers") return;
    var x = String(d[k] == null ? "" : d[k]).trim();
    if (x.length > 1500) { err.push(L.labels[k] + " : " + ep17SansHtml_(L.tooLong)); return; }
    if (!x) { if (EP17_REQUIS.indexOf(k) !== -1) err.push(L.labels[k]); return; }
    if (cc.indexOf(k) !== -1 && (ch[k] || []).indexOf(x) === -1 && x.length > 120) { err.push(L.labels[k]); return; }   // « Autre… » : texte court
    v[k] = x;
  });
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) err.push(ep17SansHtml_(L.badEmail));
  if (v.pages) { var n = parseInt(v.pages.replace(/\D/g, ""), 10); if (!n || n > 2000) err.push(ep17SansHtml_(L.badPages)); else v.pages = String(n); }
  if (err.length) return { ok: false, champs: true, msg: err.join(" · ") };
  v.email = v.email.toLowerCase();
  var connu = !!epClient_(jeton);
  if (!ep2Quota_("EP17M_" + v.email.slice(0, 60), EP17.PAR_MAIL_HEURE, 3600) || (!connu && (!ep2Quota_("EP17_ANON_H", EP17.ANON_HEURE, 3600) || !ep2Quota_("EP17_ANON_J", EP17.ANON_JOUR, 86400))))
    return { ok: false, msg: lang === "en" ? "Too many orders in a short time: please try again in an hour, or use the Telegram bot." : "Trop de commandes en peu de temps : réessayez dans une heure, ou passez par le bot Telegram." };
  // Fichiers : contrôlés AVANT tout enregistrement
  if (fichiers.length > EP17.MAX_FICHIERS) return { ok: false, msg: "Maximum " + EP17.MAX_FICHIERS + " fichiers." };
  var blobs = [], total = 0;
  for (var i = 0; i < fichiers.length; i++) {
    var f = fichiers[i] || {}, oct = []; try { oct = Utilities.base64Decode(String(f.b64 || "")); } catch (e) { return { ok: false, msg: "Fichier illisible : " + String(f.nom || "") }; }
    if (oct.length > EP17.MAX_MO * 1048576) return { ok: false, msg: "« " + String(f.nom || "") + " » dépasse " + EP17.MAX_MO + " Mo." };
    total += oct.length; if (total > EP17.MAX_TOTAL_MO * 1048576) return { ok: false, msg: "Fichiers trop lourds (" + EP17.MAX_TOTAL_MO + " Mo au total)." };
    blobs.push(Utilities.newBlob(oct, String(f.mime || "application/octet-stream"), String(f.nom || "fichier").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120)));
  }
  var dossier = null, lienDossier = "";
  if (blobs.length) {
    var racine = epDossier_("EP17_DOSSIER", "AssistAcad · Commandes du site");
    dossier = racine.createFolder("En cours " + epDate_(new Date(), "yyyy-MM-dd HH:mm") + " · " + v.email);
    blobs.forEach(function (b) { dossier.createFile(b); });
    lienDossier = dossier.getUrl();
  }
  var s = epClient_(jeton), chat = s && s.chat ? String(s.chat) : "";
  var etapes = ep17Etapes_(), details = etapes.filter(function (k) { return k !== "fichiers"; }).map(function (k) { return [T.fr.labels[k], v[k] || ""]; });
  details.push(["Fichiers (site)", blobs.length ? blobs.length + " · " + lienDossier : "0"]);
  var commande = {
    source: "Formulaire", chatId: chat, username: "", langueBot: lang, fichiersIds: [], details: details,
    prenom: v.prenom, nom: v.nom, email: v.email, niveau: v.niveau, etablissement: v.etablissement, domaine: v.domaine,
    type: v.type, pages: v.pages, complexite: v.complexite, delai: v.delai, langue: v.langue, sujet: v.sujet || "",
    instructions: (v.instructions || "") + (blobs.length ? "\n[📎 " + blobs.length + " fichier(s) envoyés sur le site : " + lienDossier + "]" : "") + "\n[Commande passée sur le site AssistAcad]",
    codeParrain: "", codePromo: v.code || "", paiement: v.paiement
  };
  var lock = LockService.getScriptLock(), pris = false, res;
  try { lock.waitLock(25000); pris = true; } catch (e) {}
  if (!pris) return { ok: false, msg: lang === "en" ? "The server is busy: please press Send again in a few seconds." : "Serveur très occupé : appuyez de nouveau sur Envoyer dans quelques secondes." };   // sans verrou, deux commandes pourraient recevoir le même numéro
  try { res = traiterCommande_(commande); }
  catch (e) {
    console.error("commande site : " + (e && e.stack ? e.stack : e));
    try { epAdminTg_("🚨 <b>Erreur commande du site</b>\n" + String(e).slice(0, 300) + "\n👤 " + v.prenom + " " + v.nom + " (" + v.email + ")\n📝 " + v.type + " · " + v.pages + " p." + (lienDossier ? "\n📎 " + lienDossier : "")); } catch (x) {}
    return { ok: false, msg: ep17SansHtml_(L.error) };
  } finally { if (pris) { try { lock.releaseLock(); } catch (e) {} } }
  if (dossier && res && res.numero) { try { dossier.setName(res.numero + " · " + v.prenom + " " + v.nom); } catch (e) {} }
  var carte = (cfg_() || {}).CARTE || "";
  var html = L.devisOk(res) + (L.refuses ? L.refuses(res.codesRefuses || []) : "") + L.prix(res, carte) + (res.codeParrainagePerso && L.parrain ? L.parrain(res.codeParrainagePerso) : "") + (res.email && L.emailNote ? L.emailNote : "");
  html = html.replace(/\n\n📸[^\n]*/, "");        // « Envoie la capture ici » : sur le site, on propose le bot juste en dessous
  // Suivi dans Telegram : compte avec Telegram → déjà relié ; sinon lien qui ne rattache QUE cette commande
  var lien = "";
  if (!chat && res && res.numero) {
    var j = ep3Alea_(24); CacheService.getScriptCache().put("RCL_" + j, JSON.stringify({ m: v.email, n: String(res.numero) }), 21600);
    lien = "https://t.me/" + epProp_("BOT_USERNAME", "acades_bot") + "?start=RC" + j;
  }
  return { ok: true, numero: String(res.numero || ""), devis: !!res.devis, html: ep17Html_(html), telegram: lien, relie: !!chat };
}
(function () { if (typeof PART_OK_ !== "undefined") ["apiCmdFormulaire", "apiCmdCode", "apiCmdEnvoyer"].forEach(function (n) { PART_OK_[n] = 1; }); })();

// ════════════════════ 5. RATTRAPAGE DE SÉCURITÉ (doit rester À LA FIN du dernier fichier) ════════════════════
//  Securite.gs protège les fonctions « api… » qui existent au moment où il est lu.
//  Les fichiers placés en dessous (MaCommande, SuiviEmail, EspacePlus, EspacePlus2…)
//  échappaient donc au verrouillage d'urgence et à la liste des partenaires.
//  Ce bloc applique les deux protections à TOUTES les fonctions « api… ».
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  var sessionDe = function (j) { if (typeof j !== "string" || j.length < 16 || typeof lireSession_ !== "function") return null; try { return lireSession_(j); } catch (e) { return null; } };
  var LIBRES = { apiLogin: 1, apiLoginV3: 1, apiLogin2FA: 1 };
  var n = 0;
  Object.getOwnPropertyNames(g).forEach(function (nom) {
    if (!/^api[A-Z]/.test(nom)) return;
    var f = g[nom]; if (typeof f !== "function") return;
    var w = f;
    if (typeof PART_OK_ !== "undefined" && !f.__part && !PART_OK_[nom]) {
      var f1 = w;
      w = function () {
        var j0 = arguments[0], s = typeof j0 === "string" && /^cw[0-9a-f]{46}$/.test(j0) ? null : sessionDe(j0);   // jeton de client : pas de session d'équipe à chercher
        if (s && String(s.role) === "partenaire") return (typeof PART_VIDE_ !== "undefined" && PART_VIDE_[nom]) ? PART_VIDE_[nom]() : { ok: false, msg: "Réservé à l’équipe interne d’AssistAcad." };
        return f1.apply(this, arguments);
      };
      w.__part = true; w.__orig = f1;
    }
    if (typeof bqVerrou_ === "function" && !f.__verrou && !LIBRES[nom]) {
      var f2 = w;
      w = function () {
        if (bqVerrou_()) { var s = sessionDe(arguments[0]); if (!(s && String(s.role) === "admin")) return { ok: false, deconnecte: !s && typeof arguments[0] === "string" && arguments[0].length >= 16, msg: "🔒 Maintenance de sécurité : l’espace est momentanément fermé. Réessayez plus tard." }; }
        return f2.apply(this, arguments);
      };
      w.__verrou = true; w.__part = w.__part || f.__part;
    }
    if (w !== f) { try { Object.keys(f).forEach(function (k) { if (w[k] === undefined) w[k] = f[k]; }); } catch (e) {} g[nom] = w; n++; }
  });
  EP2.RATTRAPAGE = n;
})();

// Contrôle : toutes les fonctions « api… » sont-elles protégées ? (sinon un fichier est placé sous EspacePlus2.gs)
function ep2VerifProtections_() {
  var g = typeof globalThis !== "undefined" ? globalThis : this, LIBRES = { apiLogin: 1, apiLoginV3: 1, apiLogin2FA: 1 };
  if (typeof bqVerrou_ !== "function") return "Protections : ⚠️ Securite.gs (bouclier) introuvable.";
  var sans = Object.getOwnPropertyNames(g).filter(function (n) { return /^api[A-Z]/.test(n) && typeof g[n] === "function" && !LIBRES[n] && !g[n].__verrou; });
  return sans.length ? "Protections : ❌ " + sans.length + " fonction(s) non protégée(s) (" + sans.slice(0, 8).join(", ") + ") → glisse EspacePlus2.gs TOUT EN BAS de la liste des fichiers, puis Nouvelle version."
    : "Protections : ✅ toutes les fonctions api… sont couvertes (verrouillage d’urgence + liste des partenaires).";
}
function verifierProtections() { Logger.log(ep2VerifProtections_()); }

// ════════════════════ 14. VITESSE MAX : objectif 3 secondes (mise à jour 27) ════════════════════
//  Mesure TOUT ce qui ralentit une réponse (propriétés, tableur, Telegram) et, une fois activé
//  par activerVitesseMax(), supprime les allers-retours inutiles vers les serveurs Google :
//   • propriétés du script : chargées en UNE fois puis servies en mémoire (1,5 s maximum,
//     relues dès qu'un verrou est pris : les compteurs et numéros de commande restent justes) ;
//   • tableur : ouvert UNE fois par exécution au lieu de 3 à 10 fois.
//  Tout se désactive avec desactiverVitesseMax(). Les réponses lentes (plus de 3 s) du bot et de
//  l'intranet sont notées : mesurerVitesse() les affiche.
var EP14 = { actif: false, compte: null, memoP: null, tP: 0, ss: {}, TTL: 1500, SEUIL: 3000 };
function ep14Compteur_() { return { props: 0, propsMs: 0, ouv: 0, ouvMs: 0, url: 0, urlMs: 0 }; }
function ep14Remplacer_(g, nomSvc, methode, fn) {
  var svc = g[nomSvc]; if (!svc) return false;
  try { svc[methode] = fn; if (svc[methode] === fn) return true; } catch (e) {}
  try {
    var px = new Proxy(svc, { get: function (t, p) { if (p === methode) return fn; var v = t[p]; return typeof v === "function" ? v.bind(t) : v; } });
    g[nomSvc] = px; if (g[nomSvc] === px) return true;
  } catch (e) {}
  return false;
}
// Installe les accélérateurs (memo = true) ou de simples compteurs (memo = false). Renvoie ce qui a marché.
function ep14Installer_(memo) {
  var g = typeof globalThis !== "undefined" ? globalThis : this, ok = { props: false, verrou: false, tableur: false, url: false };
  if (g.__EP14_INSTALLE) { EP14.actif = !!(memo && g.__EP14_INSTALLE.props); return g.__EP14_INSTALLE; }
  var PS = g.PropertiesService, SA = g.SpreadsheetApp, LS = g.LockService, UF = g.UrlFetchApp;
  if (!PS || !SA) return ok;
  var rawP = PS.getScriptProperties(), rawOpen = SA.openById, rawLock = LS && LS.getScriptLock, rawFetch = UF && UF.fetch, rawAll = UF && UF.fetchAll;
  EP14.raw = rawP;
  var C0 = function () { return EP14.compte; };
  var charge = function () {
    var now = Date.now();
    if (!EP14.memoP || now - EP14.tP > EP14.TTL) { var t0 = Date.now(); EP14.memoP = rawP.getProperties(); EP14.tP = Date.now(); var c = C0(); if (c) { c.props++; c.propsMs += EP14.tP - t0; } }
    return EP14.memoP;
  };
  var compte = function (fn) { var c = C0(), t0 = Date.now(); try { return fn(); } finally { if (c) { c.props++; c.propsMs += Date.now() - t0; } } };
  var P2 = {
    getProperty: function (k) { if (EP14.actif) { var m = charge(); return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; } return compte(function () { return rawP.getProperty(k); }); },
    getProperties: function () { if (EP14.actif) { var m = charge(), o = {}; for (var k in m) o[k] = m[k]; return o; } return compte(function () { return rawP.getProperties(); }); },
    getKeys: function () { if (EP14.actif) return Object.keys(charge()); return compte(function () { return rawP.getKeys(); }); },
    setProperty: function (k, v) { compte(function () { rawP.setProperty(k, v); }); if (EP14.memoP) EP14.memoP[k] = String(v); return P2; },
    setProperties: function (o, tout) { compte(function () { rawP.setProperties(o, tout); }); if (tout) EP14.memoP = null; else if (EP14.memoP) for (var k in o) EP14.memoP[k] = String(o[k]); return P2; },
    deleteProperty: function (k) { compte(function () { rawP.deleteProperty(k); }); if (EP14.memoP) delete EP14.memoP[k]; return P2; },
    deleteAllProperties: function () { compte(function () { rawP.deleteAllProperties(); }); EP14.memoP = null; return P2; }
  };
  // Verrou : sans lui, pas d'accélérateur des propriétés (sinon un compteur pourrait être relu trop vieux)
  if (rawLock) ok.verrou = ep14Remplacer_(g, "LockService", "getScriptLock", function () {
    var l = rawLock.call(LS);
    return { waitLock: function (ms) { l.waitLock(ms); EP14.memoP = null; }, tryLock: function (ms) { var r = l.tryLock(ms); if (r) EP14.memoP = null; return r; },
      releaseLock: function () { return l.releaseLock(); }, hasLock: function () { return l.hasLock(); } };
  });
  if (ok.verrou) {
    ok.props = ep14Remplacer_(g, "PropertiesService", "getScriptProperties", function () { return P2; });
    // Les fichiers qui avaient déjà gardé l'objet des propriétés dans « P » passent aussi par la mémoire
    if (ok.props) ["P", "PROPS", "PROP"].forEach(function (n) { try { if (g[n] && typeof g[n].getProperty === "function" && g[n] !== P2) g[n] = P2; } catch (e) {} });
  }
  ok.tableur = ep14Remplacer_(g, "SpreadsheetApp", "openById", function (id) {
    var k = String(id), c = C0();
    if (EP14.actif && EP14.ss[k]) return EP14.ss[k];
    var t0 = Date.now(), s = rawOpen.call(SA, id); if (c) { c.ouv++; c.ouvMs += Date.now() - t0; }
    if (EP14.actif) EP14.ss[k] = s;
    return s;
  });
  if (rawFetch) ok.url = ep14Remplacer_(g, "UrlFetchApp", "fetch", function (u, o) { var c = C0(), t0 = Date.now(); try { return o === undefined ? rawFetch.call(UF, u) : rawFetch.call(UF, u, o); } finally { if (c) { c.url++; c.urlMs += Date.now() - t0; } } });
  if (rawAll && ok.url) ep14Remplacer_(g, "UrlFetchApp", "fetchAll", function (rs) { var c = C0(), t0 = Date.now(); try { return rawAll.call(UF, rs); } finally { if (c) { c.url++; c.urlMs += Date.now() - t0; } } });
  EP14.actif = memo && ok.props;
  g.__EP14_INSTALLE = ok;
  return ok;
}
// Note des réponses lentes (bot et intranet), une seule écriture en mémoire rapide
function ep14Noter_(quoi, ms) {
  try {
    var c = CacheService.getScriptCache(), k = "EP14_LENTS", l = JSON.parse(c.get(k) || "[]");
    l.push({ t: Date.now(), q: String(quoi).slice(0, 40), ms: ms }); c.put(k, JSON.stringify(l.slice(-40)), 21600);
  } catch (e) {}
}
function ep14NoterBot_(ms) {
  try {
    var c = CacheService.getScriptCache(), k = "EP14_BOT", l = JSON.parse(c.get(k) || "[]");
    l.push([Date.now(), ms]); c.put(k, JSON.stringify(l.slice(-50)), 21600);
  } catch (e) {}
}
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  try { if (String(PropertiesService.getScriptProperties().getProperty("VITESSE_MAX") || "") === "OUI") ep14Installer_(true); } catch (e) {}
  // Chronomètre de chaque message Telegram (doPost) et de chaque appel de l'intranet (api…)
  var chrono = function (nom, estBot) {
    var f = g[nom]; if (typeof f !== "function" || f.__ep14) return;
    var w = function () {
      var t0 = Date.now();
      try { return f.apply(this, arguments); }
      finally {
        var ms = Date.now() - t0;
        if (estBot) { var e = arguments[0], test = false; try { test = /"_test"/.test(String(e && e.postData && e.postData.contents || "")); } catch (x) {} if (!test && e && e.postData) ep14NoterBot_(ms); }
        else if (ms > EP14.SEUIL) ep14Noter_(nom, ms);
      }
    };
    Object.keys(f).forEach(function (k) { w[k] = f[k]; }); w.__ep14 = true; g[nom] = w;
  };
  chrono("doPost", true);
  Object.getOwnPropertyNames(g).forEach(function (n) { if (/^api[A-Z]/.test(n)) chrono(n, false); });
})();
// Un /start de test passé par tout le code, avec le détail du temps
function ep14Essai_() {
  var admin = PropertiesService.getScriptProperties().getProperty("ADMIN_CHAT_ID");
  if (!admin) return null;
  EP14.compte = ep14Compteur_(); EP14.ss = {}; EP14.memoP = null;
  var up = { _test: 1, update_id: 900000000 + Math.floor(Math.random() * 99999999), message: { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: Number(admin), type: "private" }, from: { id: Number(admin), is_bot: false, first_name: "Test", language_code: "fr" }, text: "/start" } };
  var t0 = Date.now();
  try { doPost({ postData: { contents: JSON.stringify(up), type: "application/json" }, parameter: { cle: PropertiesService.getScriptProperties().getProperty("WEBHOOK_CLE") || "" } }); } catch (e) {}
  var r = EP14.compte; r.total = Date.now() - t0; EP14.compte = null;
  return r;
}
function ep14Ligne_(nom, r) {
  if (!r) return nom + " : impossible (ADMIN_CHAT_ID absent)";
  var reste = Math.max(0, r.total - r.propsMs - r.ouvMs - r.urlMs);
  return nom + " : " + (r.total / 1000).toFixed(1) + " s" + (r.total <= EP14.SEUIL ? " ✅" : " ⚠️") +
    "\n     propriétés : " + r.props + " lecture(s), " + r.propsMs + " ms · tableur : " + r.ouv + " ouverture(s), " + r.ouvMs + " ms" +
    "\n     Telegram/Internet : " + r.url + " appel(s), " + r.urlMs + " ms · calculs du code : " + reste + " ms";
}
// À exécuter : mesure réelle, compare avec et sans accélérateur, active s'il est plus rapide et sûr
function mesurerVitesse() {
  if (typeof reserveEditeur_ === "function") reserveEditeur_();
  var out = ["════ VITESSE AssistAcad (objectif : 3 s) ════"], c = CacheService.getScriptCache();
  var bot = []; try { bot = JSON.parse(c.get("EP14_BOT") || "[]"); } catch (e) {}
  if (bot.length) {
    var ms = bot.map(function (x) { return x[1]; }), moy = Math.round(ms.reduce(function (a, b) { return a + b; }, 0) / ms.length), lents = ms.filter(function (x) { return x > EP14.SEUIL; }).length;
    out.push("1. Vrais messages clients (" + ms.length + " derniers) : moyenne " + (moy / 1000).toFixed(1) + " s · le plus lent " + (Math.max.apply(null, ms) / 1000).toFixed(1) + " s · au-dessus de 3 s : " + lents);
  } else out.push("1. Vrais messages clients : pas encore de mesure (elles s'accumulent à chaque message reçu).");
  var lents2 = []; try { lents2 = JSON.parse(c.get("EP14_LENTS") || "[]"); } catch (e) {}
  if (lents2.length) {
    var par = {}; lents2.forEach(function (x) { var p = par[x.q] || (par[x.q] = { n: 0, max: 0 }); p.n++; p.max = Math.max(p.max, x.ms); });
    out.push("2. Intranet, appels de plus de 3 s : " + Object.keys(par).sort(function (a, b) { return par[b].max - par[a].max; }).slice(0, 8).map(function (k) { return k + " (" + par[k].n + "×, jusqu'à " + (par[k].max / 1000).toFixed(1) + " s)"; }).join(", "));
  } else out.push("2. Intranet : aucun appel de plus de 3 s noté pour l'instant ✅");
  var etait = String(PropertiesService.getScriptProperties().getProperty("VITESSE_MAX") || "") === "OUI";
  var inst = ep14Installer_(false);
  out.push("3. Essai réel d'un /start (vous recevez 2 menus de test dans Telegram) :");
  var sans = ep14Essai_();
  out.push("   " + ep14Ligne_("Sans accélérateur", sans));
  var avec = null, sur = false;
  if (inst.props) {
    EP14.actif = true; avec = ep14Essai_(); EP14.actif = etait;
    // Contrôle : la mémoire rend exactement les mêmes propriétés que le serveur
    try { EP14.actif = true; EP14.memoP = null; var a = PropertiesService.getScriptProperties().getProperties(), b = EP14.raw.getProperties(), k1 = Object.keys(a), k2 = Object.keys(b); EP14.actif = etait;
      sur = k1.length === k2.length && k2.every(function (k) { return a[k] === b[k]; }) && PropertiesService.getScriptProperties().getProperty("ADMIN_CHAT_ID") === b.ADMIN_CHAT_ID; } catch (e) { sur = false; EP14.actif = etait; }
    out.push("   " + ep14Ligne_("Avec accélérateur", avec));
  } else out.push("   Accélérateur : ❌ Google n'a pas permis de l'installer ici (verrou " + (inst.verrou ? "✅" : "❌") + ", propriétés " + (inst.props ? "✅" : "❌") + ") — rien n'est changé.");
  if (avec && sans && sur && avec.total < sans.total) {
    PropertiesService.getScriptProperties().setProperty("VITESSE_MAX", "OUI");
    out.push("✅ Accélérateur ACTIVÉ : " + Math.round((1 - avec.total / sans.total) * 100) + " % plus rapide. (desactiverVitesseMax() pour revenir en arrière)");
  } else if (avec && sans) out.push(etait ? "Accélérateur déjà actif." : "Accélérateur pas activé : pas de gain mesuré.");
  var r = avec || sans;
  if (r) {
    out.push("");
    out.push("CE QUI RESTE LENT :");
    if (r.ouvMs > 600) out.push("  • Tableur : " + r.ouvMs + " ms. Un tableur plus léger aide : archivez les vieilles lignes de Suivi (archiverSuivi si disponible).");
    if (r.urlMs > 1200) out.push("  • Telegram/Internet : " + r.urlMs + " ms pour " + r.url + " appel(s). Normal : environ 0,3 s par message envoyé.");
    var reste = r.total - r.propsMs - r.ouvMs - r.urlMs;
    if (reste > 1500) out.push("  • Calculs du code : " + reste + " ms. Une partie vient de la taille du projet, que Google recharge à chaque message. Envoyez-moi la capture.");
    if (r.total <= EP14.SEUIL) out.push("  ✅ Objectif atteint : un /start répond en moins de 3 s.");
  }
  Logger.log(out.join("\n"));
  return out.join("\n");
}
function desactiverVitesseMax() { if (typeof reserveEditeur_ === "function") reserveEditeur_(); PropertiesService.getScriptProperties().deleteProperty("VITESSE_MAX"); Logger.log("Accélérateur désactivé. Faites Déployer › Nouvelle version si besoin."); }
function activerVitesseMax() { return mesurerVitesse(); }

// Portée de la mémoire de lecture : chaque appel « api… » repart à zéro (doit rester tout à la fin)
(function () {
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  Object.getOwnPropertyNames(g).forEach(function (nom) {
    if (!/^api[A-Z]/.test(nom)) return;
    var f = g[nom]; if (typeof f !== "function" || f.__portee) return;
    var w = function () {
      if (!EP2_MEMO.prof) { EP2_MEMO.M = {}; EP2_MEMO.S = {}; }
      EP2_MEMO.prof++;
      try { return f.apply(this, arguments); } finally { EP2_MEMO.prof--; }
    };
    Object.keys(f).forEach(function (k) { w[k] = f[k]; }); w.__portee = true; g[nom] = w;
  });
})();

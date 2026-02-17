// PF2e Lesser Dread — All-in-one module (Foundry v13, PF2e 7.x)
// - Crea/aggiorna automaticamente due Item PF2e (Effect + Aura) nel world
// - Annuncia in chat all'inizio del turno se l'attore ha "effect-lesser-dread" ed è Frightened > 0
// Docs v13 hook: https://foundryvtt.com/api/v13/functions/hookEvents.combatTurn.html

const FOLDER_NAME = "PF2e Lesser Dread (Module)";

// ====== Item data (minimi, puliti) ======
const EFFECT_DATA = {
  name: "Effect: Lesser Dread",
  type: "effect",
  img: "systems/pf2e/icons/default-icons/effect.svg",
  system: {
    description: {
      value:
        "<p>Eerie symbols cover your armor, inspiring terror in your foes. " +
        "Frightened enemies within 30 feet that can see you must attempt a " +
        "@Check[will|dc:20|name:Dread Rune|traits:fear|showDC:all|immutable:true] save at the end of their turn; " +
        "on a failure, the value of their @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened} " +
        "condition doesn't decrease below 1 that turn.</p>",
      gm: ""
    },
    slug: "effect-lesser-dread",
    traits: { value: [], otherTags: [] },
    level: { value: 6 },
    duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
    tokenIcon: { show: true },
    start: { value: 0, initiative: null },
    unidentified: false,
    publication: { title: "", authors: "", license: "ORC", remaster: true }
  }
};

const AURA_DATA_BASE = {
  name: "Aura: Lesser Dread",
  type: "effect",
  img: "icons/magic/symbols/rune-sigil-black-pink.webp",
  system: {
    description: {
      value:
        "<p>Granted by @UUID[Compendium.pf2e.equipment-srd.gSSibF07emWGpGKw]{Dread (Lesser)}</p>" +
        "<p>Eerie symbols cover your armor, inspiring terror in your foes. " +
        "Frightened enemies within 30 feet that can see you must attempt a " +
        "@Check[will|dc:20|name:Dread Rune|traits:fear|showDC:all|immutable:true] save at the end of their turn; " +
        "on a failure, the value of their @UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened} " +
        "condition doesn't decrease below 1 that turn.</p>",
      gm: ""
    },
    slug: "aura-lesser-dread",
    traits: { value: [], otherTags: [] },
    level: { value: 6 },
    duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
    tokenIcon: { show: true },
    start: { value: 0, initiative: null },
    unidentified: false,
    publication: { title: "", authors: "", license: "ORC", remaster: true },
    // RE Aura (l'UUID dell'effetto verrà inserito a runtime dopo la creazione dell'Effect)
    rules: [
      {
        key: "Aura",
        radius: 30,
        traits: ["magical", "fear", "mental", "visual"],
        level: 6,
        effects: [
          {
            uuid: "",            // <-- lo settiamo noi dopo la creazione dell'Effect
            affects: "enemies",
            includesSelf: false
          }
        ]
      }
    ]
  }
};

// ====== Helpers di installazione ======
async function ensureFolder(name) {
  let folder = game.folders.find(f => f.type === "Item" && f.name === name);
  if (!folder) {
    folder = await Folder.create({ name, type: "Item" });
  }
  return folder;
}

function findWorldItemBySlug(slug) {
  return game.items.find(i => i?.type === "effect" && i?.system?.slug === slug) ?? null;
}

async function ensureWorldEffectItem(data, folderId) {
  const existing = findWorldItemBySlug(data.system.slug);
  if (existing) return existing;
  data.folder = folderId;
  return await Item.create(data);
}

async function upsertAuraUUID(auraItem, effectItem) {
  try {
    const rules = foundry.utils.deepClone(auraItem.system.rules ?? []);
    const aura = rules.find(r => r?.key === "Aura");
    if (!aura?.effects?.[0]) return;
    const desired = effectItem.uuid; // es. "Item.<id>"
    if (aura.effects[0].uuid !== desired) {
      aura.effects[0].uuid = desired;
      await auraItem.update({ "system.rules": rules });
    }
  } catch (err) {
    console.error("Lesser Dread: aggiornamento UUID Aura fallito", err);
  }
}

// ====== Annuncio in chat all'inizio del turno ======
async function onTurnStartAnnounce(combat, updateData) {
  // Solo l’active GM invia per evitare duplicati
  if (!game.user.isGM || game.user.id !== game.users.activeGM?.id) return;

  const idx = updateData?.turn;
  if (typeof idx !== "number") return;

  const current = combat.turns?.[idx];
  if (!current?.tokenId) return;

  const token = canvas.tokens.get(current.tokenId);
  const actor = token?.actor;
  if (!actor) return;

  // 1) Effetto PF2e "effect-lesser-dread"
  const hasLesserDread =
    actor.itemTypes?.effect?.some(e => e.slug === "effect-lesser-dread" && !e.isExpired) ?? false;
  if (!hasLesserDread) return;

  // 2) Frightened > 0
  const frightened = actor.getCondition?.("frightened");
  const isFrightened = !!frightened && !frightened.isExpired && ((frightened.value ?? 1) > 0);
  if (!isFrightened) return;

  const content =
    "Frightened:Eerie symbols cover your armor, inspiring terror in your foes. " +
    "Frightened enemies within 30 feet that can see you must attempt a " +
    "@Check[will|dc:20|name:Dread Rune|traits:fear|showDC:all|immutable:true] " +
    "save at the end of their turn; on a failure, the value of their " +
    "@UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened} " +
    "condition doesn't decrease below 1 that turn.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: token.document }),
    content
  });
}

// ====== Boot (ready) ======
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  // 1) Crea/assicurati cartella world items
  const folder = await ensureFolder(FOLDER_NAME);

  // 2) Crea/assicurati Effect e Aura nel world
  const effectItem = await ensureWorldEffectItem(foundry.utils.deepClone(EFFECT_DATA), folder.id);

  const AURA_DATA = foundry.utils.deepClone(AURA_DATA_BASE);
  const auraItem = await ensureWorldEffectItem(AURA_DATA, folder.id);

  // 3) Assicura che la Aura punti all'UUID reale dell'Effect
  await upsertAuraUUID(auraItem, effectItem);

  // 4) Registra hook combatTurn per l'annuncio
  if (game.pf2e?.lesserDreadHook) {
    Hooks.off("combatTurn", game.pf2e.lesserDreadHook);
    game.pf2e.lesserDreadHook = null;
  }
  game.pf2e ??= {};
  game.pf2e.lesserDreadHook = Hooks.on("combatTurn", onTurnStartAnnounce);

  console.log("PF2e Lesser Dread (all-in-one): pronto. Items world creati/aggiornati e hook registrato.");
});



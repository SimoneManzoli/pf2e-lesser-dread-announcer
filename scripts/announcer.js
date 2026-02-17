// PF2e Lesser Dread Announcer — Foundry v13
// Evento cambio turno: hook 'combatTurn' (v13)
// Docs: https://foundryvtt.com/api/v13/functions/hookEvents.combatTurn.html

Hooks.once("ready", () => {
  if (!game.user.isGM) return;

  if (game.pf2e?.lesserDreadHook) {
    Hooks.off("combatTurn", game.pf2e.lesserDreadHook);
    game.pf2e.lesserDreadHook = null;
  }
  game.pf2e ??= {};

  game.pf2e.lesserDreadHook = Hooks.on("combatTurn", async (combat, updateData, updateOptions) => {
    if (game.user.id !== game.users.activeGM?.id) return;

    const idx = updateData?.turn;
    if (typeof idx !== "number") return;

    const current = combat.turns?.[idx];
    if (!current?.tokenId) return;

    const token = canvas.tokens.get(current.tokenId);
    const actor = token?.actor;
    if (!actor) return;

    // Effetto PF2e con slug "effect-lesser-dread" attivo
    const hasLesserDread =
      actor.itemTypes?.effect?.some(e => e.slug === "effect-lesser-dread" && !e.isExpired) ?? false;
    if (!hasLesserDread) return;

    // Condizione Frightened > 0
    const frightened = actor.getCondition?.("frightened");
    const isFrightened = !!frightened && !frightened.isExpired && ((frightened.value ?? 1) > 0);
    if (!isFrightened) return;

    const content =
      "Frightened:Eerie symbols cover your armor, inspiring terror in your foes. " +
      "Frightened enemies within 30 feet that can see you must attempt a " +
      "@Check[will|dc:20|name:Dread Rune|traits:fear|showDC:all] " +
      "save at the end of their turn; on a failure, the value of their " +
      "@UUID[Compendium.pf2e.conditionitems.Item.TBSHQspnbcqxsmjL]{Frightened} " +
      "condition doesn't decrease below 1 that turn.";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token: token.document }),
      content
    });
  });

  console.log("PF2e Lesser Dread Announcer: ready (hook combatTurn).");
});

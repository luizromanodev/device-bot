const { Events, ChannelType } = require("discord.js");
const { updateTicketActivity } = require("../utils/ticketManager");
const {
  checkMessageForBlacklistedWords,
  checkMessageForInvites,
  checkMessageForSpam,
} = require("../utils/autoModManager");
const { logError } = require("../utils/logger");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    // Auto-Moderação
    if (message.inGuild()) {
      // Apenas em servidores
      try {
        // 1. Verifica palavras proibidas
        const isBlacklisted = await checkMessageForBlacklistedWords(message);
        if (isBlacklisted) {
          return;
        }

        // 2. Verifica convites de outros servidores
        const hasInvites = await checkMessageForInvites(message);
        if (hasInvites) {
          return;
        }

        // 3. Verifica spam
        const isSpam = await checkMessageForSpam(message);
        if (isSpam) {
          return;
        }
      } catch (error) {
        logError(`Erro na auto-moderação:`, error);
      }
    }

    if (
      message.channel.type === ChannelType.GuildText &&
      message.channel.topic
    ) {
      await updateTicketActivity(message.channel);
    }
  },
};

const { Events } = require("discord.js");
const { updateTicketActivity } = require("../utils/ticketManager");
const {
  checkMessageForBlacklistedWords,
  checkMessageForInvites,
  checkMessageForSpam,
} = require("../utils/autoModManager");

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
        console.error(
          `[${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}] Erro na auto-moderação: ${error.stack}`
        );
      }
    }

    // atualização de atividade de tickets
    if (message.channel.type === 0 && message.channel.topic) {
      // ChannelType.GuildText
      await updateTicketActivity(message.channel);
    }
  },
};

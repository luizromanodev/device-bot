const { SlashCommandBuilder } = require("discord.js");
const { logInfo } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Verifica a latência do bot."),
  async execute(interaction) {
    // Responde com uma mensagem temporária enquanto calcula o ping
    await interaction.deferReply({ ephemeral: true });

    // Calcula a latência da API do Discord
    const apiLatency = Math.round(interaction.client.ws.ping);

    // Calcula a latência de ida e volta da mensagem
    const messageLatency = Date.now() - interaction.createdTimestamp;

    await interaction.editReply(
      `🏓 Pong!\nLatência da API: **${apiLatency}ms**\nLatência da Mensagem: **${messageLatency}ms**`
    );
    logInfo(`Comando /ping usado por ${interaction.user.tag}.`);
  },
};

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { logInfo, logWarn } = require("../utils/logger");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Exibe o link para as regras da cidade/servidor FiveM."),
  async execute(interaction) {
    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP";
    // IMPORTANTE: Configure esta variável no seu arquivo .env com o link real das suas regras.
    const rulesLink =
      process.env.FIVEM_RULES_LINK || "https://suacidade.com/regras";

    // Verifica se o link das regras foi configurado corretamente
    if (!rulesLink || rulesLink === "https://suacidade.com/regras") {
      logWarn(
        `A variável de ambiente FIVEM_RULES_LINK não está configurada ou está com o valor padrão. O comando /rules pode não funcionar como esperado.`
      );
      return await interaction.reply({
        content:
          "O link das regras não foi configurado no bot. Por favor, contate a administração do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const rulesEmbed = new EmbedBuilder()
      .setColor(0x00bfff)
      .setTitle(`📜 Regras Oficiais de ${serverName} 📜`)
      .setDescription(
        `Para uma experiência de Roleplay saudável e divertida em **${serverName}**, é fundamental que todos os jogadores conheçam e sigam as regras da nossa comunidade.\n\n` +
          `**Clique no botão abaixo para acessar o documento completo com todas as regras:**`
      )
      .addFields(
        {
          name: "⚠️ Lembrete Importante",
          value:
            "A ignorância das regras não isenta de punição. Certifique-se de lê-las e compreendê-las.",
          inline: false,
        },
        {
          name: "🔄 Atualizações",
          value:
            "As regras podem ser atualizadas periodicamente. Verifique sempre o documento para as versões mais recentes.",
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Verificado em ${serverName} | Solicitado por ${interaction.user.tag}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    // Cria o botão que linka para as regras
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Acessar Regras")
        .setStyle(ButtonStyle.Link)
        .setURL(rulesLink)
    );

    // Envia o embed com o botão
    await interaction.reply({ embeds: [rulesEmbed], components: [row] });
    logInfo(
      `Comando /rules usado por ${interaction.user.tag} (link: ${rulesLink}).`
    );
  },
};

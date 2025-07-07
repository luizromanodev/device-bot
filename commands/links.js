const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logInfo } = require("../utils/logger");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("links")
    .setDescription("Exibe links importantes da cidade FiveM."),
  async execute(interaction) {
    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP";

    const website =
      process.env.FIVEM_SERVER_WEBSITE || "https://suacidade.com/";
    const discordInvite =
      process.env.FIVEM_DISCORD_INVITE || "https://discord.gg/seucidade";
    const storeLink =
      process.env.FIVEM_STORE_LINK || "https://loja.suacidade.com/"; // NOVO: Link da Loja/Doação
    const whitelistForm =
      process.env.FIVEM_WHITELIST_FORM ||
      "https://forms.google.com/sua_whitelist"; // NOVO: Link do Formulário de Whitelist
    const twitterLink =
      process.env.FIVEM_TWITTER_LINK || "https://twitter.com/suacidade"; // NOVO: Link do Twitter
    const youtubeLink =
      process.env.FIVEM_YOUTUBE_LINK || "https://youtube.com/suacidade"; // NOVO: Link do YouTube

    const linksEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(`🔗 Links Úteis de ${serverName} 🔗`)
      .setDescription(
        "Acesse rapidamente os recursos mais importantes da nossa comunidade!"
      )
      .addFields(
        {
          name: "🌐 Site Oficial",
          value: `[Clique aqui](${website})`,
          inline: false,
        },
        {
          name: "💬 Nosso Discord",
          value: `[Clique aqui](${discordInvite})`,
          inline: false,
        },
        {
          name: "💰 Loja/Doações",
          value: `[Clique aqui](${storeLink})`,
          inline: false,
        },
        {
          name: "📝 Formulário Whitelist",
          value: `[Clique aqui](${whitelistForm})`,
          inline: false,
        },
        {
          name: "🐦 Twitter",
          value: `[Siga-nos](${twitterLink})`,
          inline: false,
        },
        {
          name: "▶️ YouTube",
          value: `[Inscreva-se](${youtubeLink})`,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Conecte-se com ${serverName} | Solicitado por ${interaction.user.tag}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [linksEmbed] });
    logInfo(`Comando /links usado por ${interaction.user.tag}.`);
  },
};

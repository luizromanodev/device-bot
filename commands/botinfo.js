const { SlashCommandBuilder, EmbedBuilder, version } = require("discord.js");
const { logInfo } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Mostra informações sobre o bot."),
  async execute(interaction) {
    const client = interaction.client;

    let totalSeconds = client.uptime / 1000;
    let days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = Math.floor(totalSeconds % 60);
    let uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const botInfoEmbed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle(`🤖 Informações sobre ${client.user.username}`)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: "👑 Desenvolvedor",
          value: "Seu Nome/Tag aqui (ou ID)",
          inline: true,
        },
        { name: "🆔 ID do Bot", value: `\`${client.user.id}\``, inline: true },
        {
          name: "📊 Servidores",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "👥 Usuários Atendidos",
          value: `${client.users.cache.size}`,
          inline: true,
        },
        {
          name: "💬 Canais Observados",
          value: `${client.channels.cache.size}`,
          inline: true,
        },
        {
          name: "⚡ Latência da API",
          value: `${Math.round(client.ws.ping)}ms`,
          inline: true,
        },
        {
          name: "⏳ Tempo online (Uptime)",
          value: uptimeString,
          inline: false,
        },
        { name: "📚 Versão Discord.js", value: `v${version}`, inline: true },
        {
          name: "⚙️ Plataforma",
          value: `Node.js ${process.version}`,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

    await interaction.reply({ embeds: [botInfoEmbed] });
    logInfo(`Comando /botinfo usado por ${interaction.user.tag}.`);
  },
};

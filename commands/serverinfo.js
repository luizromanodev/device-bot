const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const { logInfo, logError } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Mostra informações detalhadas sobre o servidor."),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: "Este comando só pode ser usado em um servidor.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);

    // Contagem de membros por status
    const members = await guild.members.fetch();
    const onlineMembers = members.filter(
      (member) => member.presence?.status === "online" && !member.user.bot
    ).size;
    const idleMembers = members.filter(
      (member) => member.presence?.status === "idle" && !member.user.bot
    ).size;
    const dndMembers = members.filter(
      (member) => member.presence?.status === "dnd" && !member.user.bot
    ).size;
    const bots = members.filter((member) => member.user.bot).size;
    const totalMembers = guild.memberCount; // Inclui bots

    // Contagem de canais
    const textChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText
    ).size;
    const voiceChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildVoice
    ).size;
    const categoryChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildCategory
    ).size;
    const stageChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildStageVoice
    ).size;
    const newsChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildNews
    ).size; // Canais de anúncios
    const forumChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildForum
    ).size; // Canais de fórum
    const totalChannels = guild.channels.cache.size;

    const serverEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`Informações do Servidor: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: "👑 Dono do Servidor",
          value: owner
            ? `${owner.user.tag} (\`${owner.user.id}\`)`
            : "Desconhecido",
          inline: true,
        },
        { name: "🆔 ID do Servidor", value: `\`${guild.id}\``, inline: true },
        {
          name: "📅 Criado em",
          value: `<t:${parseInt(guild.createdTimestamp / 1000)}:f>`,
          inline: false,
        },
        {
          name: "👥 Membros",
          value: `Total: ${totalMembers}\nOnline: ${onlineMembers}\nAusente: ${idleMembers}\nNão Perturbe: ${dndMembers}\nBots: ${bots}`,
          inline: true,
        },
        {
          name: "💬 Canais",
          value: `Texto: ${textChannels}\nVoz: ${voiceChannels}\nCategorias: ${categoryChannels}\nFórum: ${forumChannels}\nOutros: ${
            totalChannels -
            (textChannels + voiceChannels + categoryChannels + forumChannels)
          }`,
          inline: true,
        },
        {
          name: "📈 Nível de Boost",
          value: `Tier ${guild.premiumTier} (${
            guild.premiumSubscriptionCount || 0
          } boosts)`,
          inline: true,
        },
        { name: "🏷️ Cargos", value: `${guild.roles.cache.size}`, inline: true },
        {
          name: "😄 Emojis",
          value: `${guild.emojis.cache.size}`,
          inline: true,
        },
        {
          name: "🛡️ Nível de Verificação",
          value: `${guild.verificationLevel}`,
          inline: true,
        },
        {
          name: "🌐 Região",
          value: guild.preferredLocale ? `\`${guild.preferredLocale}\`` : "N/A",
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [serverEmbed] });
    logInfo(
      `Comando /serverinfo usado por ${interaction.user.tag} no servidor ${guild.name}.`
    );
  },
};

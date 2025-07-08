const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { logInfo, logError } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription(
      "Bloqueia um canal, impedindo que membros enviem mensagens."
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription(
          "O canal a ser bloqueado (opcional, padrão é o canal atual)."
        )
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Motivo do bloqueio (opcional).")
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: "Este comando só pode ser usado em um servidor.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const targetChannel =
      interaction.options.getChannel("canal") || interaction.channel;
    const reason =
      interaction.options.getString("motivo") || "Nenhum motivo fornecido.";
    const moderator = interaction.user;
    const guild = interaction.guild;

    const everyoneRole = guild.roles.cache.find(
      (role) => role.name === "@everyone"
    );
    if (!everyoneRole) {
      logError(
        `Cargo @everyone não encontrado na guilda ${guild.name}. Não é possível bloquear o canal.`
      );
      return await interaction.reply({
        content:
          "Não foi possível encontrar o cargo `@everyone` para aplicar as permissões. Contate a administração.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (
      !targetChannel.manageable ||
      !targetChannel
        .permissionsFor(guild.members.me)
        .has(PermissionsBitField.Flags.ManageChannels)
    ) {
      return await interaction.reply({
        content: `Não tenho permissão para bloquear o canal ${targetChannel}. Certifique-se de que meu cargo tem as permissões "Gerenciar Canais" e "Gerenciar Permissões" e está acima do cargo do canal.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🔒 Canal Bloqueado")
        .setDescription(
          `Este canal foi bloqueado por **${moderator.tag}**.\n**Motivo:** ${reason}`
        )
        .setTimestamp()
        .setFooter({
          text: `Para desbloquear, use /unlock | Executor: ${moderator.tag}`,
        });

      await interaction.reply({ embeds: [embed] });
      logInfo(
        `Canal ${targetChannel.name} bloqueado por ${moderator.tag}. Motivo: ${reason}`
      );

      // Log para o canal de automod
      const AUTOMOD_LOG_CHANNEL_ID = process.env.AUTOMOD_LOG_CHANNEL_ID;
      if (AUTOMOD_LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels
          .fetch(AUTOMOD_LOG_CHANNEL_ID)
          .catch(() => null);
        if (logChannel && logChannel.type === ChannelType.GuildText) {
          const modLogEmbed = new EmbedBuilder(embed)
            .setTitle("🔒 Canal Bloqueado (Log)")
            .setDescription(
              `**Ação:** Lockdown\n**Canal:** <#${targetChannel.id}>\n**Motivo:** ${reason}\n**Executor:** <@${moderator.id}> (${moderator.tag})`
            )
            .setColor(0xff0000);
          await logChannel.send({ embeds: [modLogEmbed] });
        }
      }
    } catch (error) {
      logError(`Erro ao bloquear o canal ${targetChannel.name}:`, error);
      await interaction.reply({
        content:
          "Houve um erro ao tentar bloquear o canal. Verifique as permissões do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};

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
    .setName("slowmode")
    .setDescription("Define ou remove o modo lento de um canal.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addIntegerOption((option) =>
      option
        .setName("duracao")
        .setDescription(
          "Duração do modo lento em segundos (0 para desativar). Máximo 21600 (6h)."
        )
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription(
          "O canal para aplicar o modo lento (opcional, padrão é o canal atual)."
        )
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: "Este comando só pode ser usado em um servidor.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const duration = interaction.options.getInteger("duracao");
    const targetChannel =
      interaction.options.getChannel("canal") || interaction.channel;
    const moderator = interaction.user;

    if (!targetChannel.manageable) {
      return await interaction.reply({
        content: `Não tenho permissão para definir o modo lento no canal ${targetChannel}. Certifique-se de que meu cargo tem a permissão "Gerenciar Canais" e está acima do cargo do canal.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      await targetChannel.setRateLimitPerUser(duration);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Executor: ${moderator.tag}` });

      if (duration > 0) {
        embed
          .setTitle("⏳ Modo Lento Ativado")
          .setDescription(
            `O modo lento foi definido para **${duration} segundos** em ${targetChannel}.`
          );
        logInfo(
          `Modo lento ativado para ${targetChannel.name} por ${moderator.tag}. Duração: ${duration}s`
        );
      } else {
        embed
          .setTitle("✅ Modo Lento Desativado")
          .setDescription(`O modo lento foi desativado em ${targetChannel}.`);
        logInfo(
          `Modo lento desativado para ${targetChannel.name} por ${moderator.tag}.`
        );
      }

      await interaction.reply({ embeds: [embed] });

      // Log para o canal de automod
      const AUTOMOD_LOG_CHANNEL_ID = process.env.AUTOMOD_LOG_CHANNEL_ID;
      if (AUTOMOD_LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels
          .fetch(AUTOMOD_LOG_CHANNEL_ID)
          .catch(() => null);
        if (logChannel && logChannel.type === ChannelType.GuildText) {
          const modLogEmbed = new EmbedBuilder(embed)
            .setTitle(
              `${
                duration > 0
                  ? "⏳ Modo Lento Definido"
                  : "✅ Modo Lento Desativado"
              }`
            )
            .setDescription(
              `**Ação:** Modo Lento\n**Canal:** <#${
                targetChannel.id
              }>\n**Duração:** ${
                duration > 0 ? `${duration} segundos` : "Desativado"
              }\n**Executor:** <@${moderator.id}> (${moderator.tag})`
            )
            .setColor(duration > 0 ? 0xffa500 : 0x00ff00);
          await logChannel.send({ embeds: [modLogEmbed] });
        }
      }
    } catch (error) {
      logError(
        `Erro ao definir/desativar modo lento em ${targetChannel.name}:`,
        error
      );
      await interaction.reply({
        content:
          "Houve um erro ao tentar definir/desativar o modo lento. Verifique as permissões do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};

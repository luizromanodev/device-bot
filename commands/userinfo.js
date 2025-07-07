const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logInfo, logError } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Mostra informações sobre um usuário.")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("O usuário para obter informações (opcional).")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const member = interaction.guild
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : null;

    const userInfoEmbed = new EmbedBuilder()
      .setColor(member ? member.displayHexColor : 0x0099ff)
      .setTitle(`Informações do Usuário: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: "🆔 ID do Usuário",
          value: `\`${targetUser.id}\``,
          inline: false,
        },
        {
          name: "👤 Nickname (Servidor)",
          value: member ? member.displayName : "Não aplicável (DM)",
          inline: true,
        },
        {
          name: "🤖 Bot?",
          value: targetUser.bot ? "Sim" : "Não",
          inline: true,
        },
        {
          name: "📅 Criou a conta em",
          value: `<t:${parseInt(targetUser.createdTimestamp / 1000)}:f>`,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

    if (member) {
      userInfoEmbed.addFields(
        {
          name: "🚀 Entrou no servidor em",
          value: `<t:${parseInt(member.joinedTimestamp / 1000)}:f>`,
          inline: false,
        },
        {
          name: "🎨 Cargos",
          value:
            member.roles.cache.size > 1
              ? member.roles.cache
                  .map((role) => role.name)
                  .filter((name) => name !== "@everyone")
                  .join(", ")
              : "Nenhum cargo específico",
          inline: false,
        }
      );
    }

    const presence = member?.presence;
    if (presence && presence.activities.length > 0) {
      const customStatus = presence.activities.find(
        (activity) => activity.type === 4
      ); // ActivityType.Custom
      if (customStatus && customStatus.state) {
        userInfoEmbed.addFields({
          name: "🗣️ Status Customizado",
          value: customStatus.state,
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [userInfoEmbed] });
    logInfo(
      `Comando /userinfo usado por ${interaction.user.tag} para ${targetUser.tag}.`
    );
  },
};

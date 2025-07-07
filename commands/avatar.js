// commands/avatar.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logInfo } = require("../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Exibe o avatar de um usuário.")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("O usuário cujo avatar você quer ver (opcional).")
        .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user; // Pega o usuário mencionado ou o próprio executor

    const avatarEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`Avatar de ${targetUser.tag}`)
      .setImage(targetUser.displayAvatarURL({ dynamic: true, size: 4096 })) // dynamic para GIFs, size para qualidade
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [avatarEmbed] });
    logInfo(
      `Comando /avatar usado por ${interaction.user.tag} para ${targetUser.tag}.`
    );
  },
};

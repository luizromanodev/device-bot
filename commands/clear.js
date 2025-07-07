const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Limpa mensagens de um canal.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("O número de mensagens a serem apagadas (1-99).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(99)
    )
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Limpar mensagens apenas deste usuário.")
        .setRequired(false)
    ),
  async execute(interaction) {},
};

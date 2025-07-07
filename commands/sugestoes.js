// commands/sugestoes.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} = require("discord.js");
const { logInfo, logError } = require("../utils/logger");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sugestoes")
    .setDescription("Envie uma sugestão para a cidade/servidor."),
  async execute(interaction) {
    const serverName = process.env.FIVEM_SERVER_NAME || "Sua Cidade RP";
    const suggestionsChannelId = process.env.SUGGESTIONS_CHANNEL_ID;

    // Verifica se o ID do canal de sugestões está configurado
    if (!suggestionsChannelId) {
      logError("SUGGESTIONS_CHANNEL_ID não está configurado no arquivo .env.");
      return await interaction.reply({
        content:
          "O canal de sugestões não foi configurado no bot. Por favor, contate a administração.",
        ephemeral: true,
      });
    }

    // Cria o modal para coletar a sugestão
    const modal = new ModalBuilder()
      .setCustomId("suggestionModal")
      .setTitle(`📝 Nova Sugestão para ${serverName}`);

    const suggestionInput = new TextInputBuilder()
      .setCustomId("suggestionText")
      .setLabel("Sua Sugestão")
      .setStyle(TextInputStyle.Paragraph) // Campo de texto longo
      .setPlaceholder("Descreva sua sugestão detalhadamente aqui...")
      .setRequired(true)
      .setMinLength(20) // Mínimo de 20 caracteres para a sugestão
      .setMaxLength(1000); // Máximo de 1000 caracteres

    const firstActionRow = new ActionRowBuilder().addComponents(
      suggestionInput
    );

    modal.addComponents(firstActionRow);

    // Mostra o modal para o usuário
    await interaction.showModal(modal);

    // Aguarda a submissão do modal
    const filter = (modalInteraction) =>
      modalInteraction.customId === "suggestionModal" &&
      modalInteraction.user.id === interaction.user.id;
    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: 300000,
      }); // 5 minutos para submeter

      const suggestion = modalSubmit.fields.getTextInputValue("suggestionText");

      const suggestionsChannel = await modalSubmit.client.channels.fetch(
        suggestionsChannelId
      );

      if (
        !suggestionsChannel ||
        suggestionsChannel.type !== ChannelType.GuildText
      ) {
        logError(
          `Canal de sugestões com ID ${suggestionsChannelId} não encontrado ou não é um canal de texto.`
        );
        return await modalSubmit.reply({
          content:
            "Ocorreu um erro ao enviar sua sugestão. O canal de sugestões não foi encontrado ou não é um canal de texto válido. Por favor, contate a administração.",
          ephemeral: true,
        });
      }

      // Cria o embed da sugestão para enviar ao canal de sugestões
      const suggestionEmbed = new EmbedBuilder()
        .setColor(0x00ff00) // Verde
        .setTitle(`💡 Nova Sugestão de ${modalSubmit.user.tag}`)
        .setDescription(suggestion)
        .addFields(
          {
            name: "Usuário",
            value: `<@${modalSubmit.user.id}> (${modalSubmit.user.tag})`,
            inline: true,
          },
          { name: "ID do Usuário", value: modalSubmit.user.id, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Sugestão recebida de ${serverName}` });

      const sentMessage = await suggestionsChannel.send({
        embeds: [suggestionEmbed],
      });

      // Adiciona reações para votação (opcional, mas recomendado)
      await sentMessage.react("👍");
      await sentMessage.react("👎");

      await modalSubmit.reply({
        content:
          "✅ Sua sugestão foi enviada com sucesso para a equipe! Agradecemos sua contribuição.",
        ephemeral: true,
      });
      logInfo(
        `Sugestão enviada por ${modalSubmit.user.tag} para o canal ${suggestionsChannel.name}.`
      );
    } catch (error) {
      if (error.code === "InteractionCollectorError") {
        await interaction.followUp({
          content:
            "Você demorou muito para enviar a sugestão. Tente novamente.",
          ephemeral: true,
        });
      } else {
        logError(`Erro ao processar sugestão: ${error.message}`);
        await interaction.followUp({
          content:
            "Ocorreu um erro inesperado ao enviar sua sugestão. Por favor, tente novamente mais tarde.",
          ephemeral: true,
        });
      }
    }
  },
};

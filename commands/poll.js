const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { logInfo, logError, logWarn } = require("../utils/logger");

const pollEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Cria uma enquete com opções de votação via modal."),
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("pollModal")
      .setTitle("📊 Criar Enquete");

    const questionInput = new TextInputBuilder()
      .setCustomId("pollQuestion")
      .setLabel("Qual é a pergunta da enquete?")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ex: Qual o melhor horário para o evento?")
      .setRequired(true)
      .setMaxLength(256);

    const optionsInput = new TextInputBuilder()
      .setCustomId("pollOptions")
      .setLabel("Opções (uma por linha, mínimo 2)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Opção 1\nOpção 2\nOpção 3")
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(questionInput),
      new ActionRowBuilder().addComponents(optionsInput)
    );

    await interaction.showModal(modal);

    const filter = (modalInteraction) =>
      modalInteraction.customId === "pollModal" &&
      modalInteraction.user.id === interaction.user.id;
    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter,
        time: 300000,
      });

      const question = modalSubmit.fields.getTextInputValue("pollQuestion");
      const optionsText = modalSubmit.fields.getTextInputValue("pollOptions");

      const options = optionsText
        .split("\n")
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);

      if (options.length < 2) {
        return await modalSubmit.reply({
          content:
            "Você precisa fornecer pelo menos duas opções para a enquete.",
          flags: [MessageFlags.Ephemeral],
        });
      }
      if (options.length > pollEmojis.length) {
        return await modalSubmit.reply({
          content: `Desculpe, o número máximo de opções suportadas é ${pollEmojis.length}. Você forneceu ${options.length}.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      let description = "";
      for (let i = 0; i < options.length; i++) {
        description += `${pollEmojis[i]} ${options[i]}\n`;
      }

      const pollEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Enquete: ${question}`)
        .setDescription(description)
        .setFooter({ text: `Enquete criada por ${modalSubmit.user.tag}` })
        .setTimestamp();

      const pollMessage = await modalSubmit.reply({
        embeds: [pollEmbed],
        fetchReply: true,
      });

      for (let i = 0; i < options.length; i++) {
        await pollMessage.react(pollEmojis[i]).catch((error) => {
          logError(
            `Erro ao adicionar reação ${pollEmojis[i]} à enquete (ID da Mensagem: ${pollMessage.id}):`,
            error
          );
        });
      }

      logInfo(
        `Enquete criada por ${modalSubmit.user.tag}: "${question}" com ${options.length} opções no canal ${modalSubmit.channel.name}.`
      );
    } catch (error) {
      if (error.code === "InteractionCollectorError") {
        logWarn(
          `Modal de enquete não submetido a tempo por ${interaction.user.tag}.`
        );
        await interaction.followUp({
          content: "Você demorou muito para enviar a enquete. Tente novamente.",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        logError(`Erro ao processar submissão do modal de enquete:`, error);
        await interaction.followUp({
          content:
            "Ocorreu um erro inesperado ao criar a enquete. Por favor, tente novamente mais tarde.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};

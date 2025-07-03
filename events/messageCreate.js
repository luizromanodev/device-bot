const { Events } = require("discord.js");
const { updateTicketActivity } = require("../utils/ticketManager");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorar mensagens de bots para evitar loops ou falsas atividades
    if (message.author.bot) return;

    // Se a mensagem foi enviada em um canal de texto e esse canal tem um tópico
    if (message.channel.type === 0 && message.channel.topic) {
      await updateTicketActivity(message.channel);
    }
  },
};

const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();
const { logInfo, logWarn, logError } = require("./utils/logger");

const commands = [];

// Carregar comandos de barra da pasta 'commands'
const commandsPath = path.join(__dirname, "commands");
try {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      logWarn(
        `O comando em ${filePath} não possui as propriedades "data" ou "execute".`
      );
    }
  }
} catch (error) {
  logWarn(
    `Não foi possível ler comandos da pasta 'commands' para registro. Ela pode estar vazia ou não existir. Erro: ${error.message}`
  );
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    logInfo(
      `Começando a atualizar ${commands.length} comandos de aplicação (/).`
    );

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    logInfo(
      `Comandos de aplicação (/) recarregados com sucesso: ${data.length}.`
    );
    if (data.length === 0) {
      logInfo(
        "Se o número de comandos for 0, isso é esperado, pois não há comandos de barra definidos no projeto ou a pasta 'commands' está vazia."
      );
    }
  } catch (error) {
    logError("Erro ao recarregar comandos de aplicação (/) no Discord:", error);
  }
})();

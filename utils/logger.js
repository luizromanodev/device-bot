/**
 *
 * @returns {string}
 */
function getTimestamp() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 *
 * @param {string}
 */
function logInfo(message) {
  console.log(`[${getTimestamp()}] INFO: ${message}`);
}

/**
 *
 * @param {string}
 */
function logWarn(message) {
  console.warn(`[${getTimestamp()}] WARN: ${message}`);
}

/**
 *
 * @param {string}
 * @param {Error|any
 */
function logError(message, error) {
  console.error(`[${getTimestamp()}] ERROR: ${message}`, error);
  if (error && error.stack) {
    console.error(error.stack);
  }
}

module.exports = { logInfo, logWarn, logError };

const winston = require('winston');
const LogzioWinstonTransport = require('winston-logzio');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const logzioTransport = new LogzioWinstonTransport({
  level: 'info',
  name: 'aspca-spots',
  token: process.env.LOGZIO_TOKEN,
  host: process.env.LOGZIO_HOST,
});

const developmentLogger = winston.createLogger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const formattedMessage = typeof message === 'string' ? message : jsonFormat.transform(message, { colorize: true });
      return `${timestamp}:${level}\t${formattedMessage}`
    }),
  ),
});

const productionLogger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    logzioTransport,
  ],
  format: winston.format.json(),
});

module.exports = IS_PRODUCTION ? productionLogger : developmentLogger;
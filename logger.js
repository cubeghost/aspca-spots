const winston = require('winston');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const jsonFormat = winston.format.json();

const logger = winston.createLogger({
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

module.exports = logger;
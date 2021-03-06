const winston = require('winston');
const LogzioWinstonTransport = require('winston-logzio');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const USE_LOGZ = !!process.env.LOGZIO_TOKEN;

const jsonFormat = winston.format.json();

const formatMeta = (meta) => {
  const splat = meta[Symbol.for('splat')];
  if (splat && splat.length) {
    const obj = splat.length === 1 ? splat[0] : splat;
    return jsonFormat.transform(obj, { colorize: true })[Symbol.for('message')];
  } else {
    return '';
  }
};

const developmentLogger = winston.createLogger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = formatMeta(meta);
      return `${timestamp}:${level}\t${message}\t${extra}`;
    }),
  ),
});

const productionTransports = [
  new winston.transports.Console(),
];

if (USE_LOGZ) {
  productionTransports.push(new LogzioWinstonTransport({
    level: 'info',
    name: 'aspca-spots',
    token: process.env.LOGZIO_TOKEN,
    host: process.env.LOGZIO_HOST,
  }));
}

const productionLogger = winston.createLogger({
  transports: productionTransports,
  format: jsonFormat,
});

module.exports = IS_PRODUCTION ? productionLogger : developmentLogger;
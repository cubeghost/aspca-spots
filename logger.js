const os = require('os');
const winston = require('winston');
require('winston-syslog');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST;
const PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT;

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

if (PAPERTRAIL_HOST && PAPERTRAIL_PORT) {
  productionTransports.push(new winston.transports.Syslog({
    host: PAPERTRAIL_HOST,
    port: PAPERTRAIL_PORT,
    protocol: 'tls4',
    localhost: os.hostname(),
    app_name: 'aspca-spots',
    eol: '\n',
  }));
}

const productionLogger = winston.createLogger({
  transports: productionTransports,
  format: jsonFormat,
});

module.exports = IS_PRODUCTION ? productionLogger : developmentLogger;
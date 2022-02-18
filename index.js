require('dotenv').config();

const ASPCA = require('./aspca');
const logger = require('./logger');
const Sentry = require('./sentry');
const { postEvents } = require('./slack');

(async () => {
  try {
    const scraper = new ASPCA();

    await scraper.connect();
    await scraper.signIn();
    await scraper.navigateToCalendar();

    const logEvents = async () => {
      // if past 6am and last day of month, go to next month
      let filteredEvents = await scraper.getEvents();

      logger.info('getEvents', {
        events: filteredEvents,
        eventsLength: filteredEvents.length,
      });
      return await postEvents(filteredEvents);
    };

    await logEvents();

    let calls = 0;
    setInterval(async () => {
      await scraper.page.reload();

      if (!scraper.connected) {
        await scraper.connect();
      }

      if (!scraper.loggedIn) {
        await scraper.signIn();
        await scraper.navigateToCalendar();
      }

      await logEvents();
      calls++;
      logger.info(`setInterval iteration: ${calls}`)
    }, 0.5 * 60 * 1000);
  } catch (error) {
    Sentry.captureException(error);
  }
})();

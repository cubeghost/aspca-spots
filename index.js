require('dotenv').config();

const ASPCA = require('./aspca');
const logger = require('./logger');
const { postEvents } = require('./slack');

(async () => {
  try {
    const scraper = new ASPCA();

    await scraper.connect();
    await scraper.signIn();
    await scraper.navigateToCalendar();

    const logEvents = async () => {
      let filteredEvents = await scraper.getEvents();

      // logger.info({
      //   month: currentMonth,
      //   events: filteredEvents,
      // });

      // filteredEvents = await scraper.getEvents({nextMonth: true});
      
      logger.info({
        events: filteredEvents,
      });
      return await postEvents(filteredEvents);
    };

    await logEvents();

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
    }, 0.5 * 60 * 1000);

    // await browser.close();
  } catch (error) {
    logger.error(error);
  }
})();

const puppeteer = require('puppeteer');
const queryString = require('query-string');

const logger = require('./logger');

const ASPCA_BASE_URL = 'https://aspcasnc.civicore.com/RSS/index.php';
const AUTH_PARAMS = { action: 'userLogin' };
const CALENDAR_PARAMS = { section: 'eventCal', action: 'cal' };

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ONE_MINUTE = 60 * 1000;

const puppeteerOptions = {
  headless: IS_PRODUCTION || process.env.DISABLE_HEADLESS !== 'true',
  devtools: !IS_PRODUCTION,
  args: ['--no-sandbox'],
  defaultViewport: {
    width: 1920,
    height: 1080
  },
};

class ASPCA {

  constructor() {
    this.connected = false;
    this.loggedIn = false;
  }

  async connect() {
    this.browser = await puppeteer.launch(puppeteerOptions);
    this.connected = true;

    const [page] = await this.browser.pages();
    this.page = page;

    this.browser.on('disconnected', () => {
      logger.warn('browser disconnected');
      this.connected = false;
      this.loggedIn = false;
      this.requestsIntercepted = false;
      process.exit(1);
    });
  }

  async signIn() {
    await this.page.goto(ASPCA_BASE_URL + queryString.stringify(AUTH_PARAMS), { waitUntil: 'networkidle2' });

    const form = (await this.page.$x("//div[contains(text(), 'Rescuer Login')]/.."))[0];
    const inputs = await form.$$('[fw-loginform-fieldinput] input');
    const submit = await form.$('button');

    await inputs[0].type(process.env.ASPCA_AUTH_EMAIL);
    await inputs[1].type(process.env.ASPCA_AUTH_PASSWORD);

    await submit.click();
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: ONE_MINUTE });

    logger.info('Signed in');
    this.loggedIn = true;

    await this.page.setRequestInterception(true);

    if (!this.requestsIntercepted) {
      this.page.on('request', (request) => {
        if (request.isNavigationRequest() && request.url().includes(queryString.stringify(AUTH_PARAMS))) {
          this.loggedIn = false;
        }
        request.continue();
      });
      this.requestsIntercepted = true;
    }
  }

  async navigateToCalendar() {
    await this.page.goto(ASPCA_BASE_URL + queryString.stringify(CALENDAR_PARAMS), { waitUntil: 'networkidle2' });

    const scheduleNav = (await this.page.$x("//a[contains(text(), 'Schedule Services')]"))[0];
    await scheduleNav.click();
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: ONE_MINUTE });
  }

  async getEvents({ nextMonth = false } = {}) {
    if (nextMonth) {
      await this.page.click('#calendar .fc-button-next');
      await this.page.waitForSelector('#loading', { hidden: true });
    }

    let eventsContainer = await this.page.$('.fc-event-container');
    if (!eventsContainer) {
      await this.page.waitForTimeout(1000); 
      eventsContainer = await this.page.$('.fc-event-container');
    }

    const events = await eventsContainer.evaluate((container) => {
      const events = container.querySelectorAll('.fc-event');

      container.scrollIntoView();
      container.style.setProperty('pointer-events', 'none');

      const eventData = [...events].map((eventElement) => {
        const rect = eventElement.getBoundingClientRect();
        const x = rect.left + (rect.width / 2);
        const y = rect.top + (rect.height / 2);
        const dateElement = document.elementFromPoint(x, y)?.closest('.fc-day');

        if (!dateElement) {
          throw new Error('Event missing date element');
        }

        return {
          date: dateElement.dataset.date,
          text: eventElement.innerText,
          eventClasses: [...eventElement.classList],
          dateClasses: [...dateElement.classList],
        };
      });

      container.style.removeProperty('pointer-events');
      return eventData;
    });

    const filteredEvents = events.filter((event) => {
      return (
        !event.eventClasses.includes('source-source_blockedDays') &&
        !event.dateClasses.includes('fc-past')
      );
    });

    const parsedEvents = filteredEvents.map((event) => ({
      ...event,
      data: ASPCA.parseEvent(event.text),
    }));

    return parsedEvents;
  }

  static parseEvent(text) {
    const maxCats = text.match(/max # of cats: (\d+)/im)?.[1];
    const maxDogs = text.match(/max # of dogs: (\d+)/im)?.[1];

    const transportType = text.match(/((Self|Central|Private)[\s-]Transport)/im)?.[1];
    const location = text.match(/(Glendale|Brooklyn CVC|Bronx CVC)/im)?.[1];

    return {
      transportType,
      location,
      maxCats: maxCats && parseInt(maxCats),
      maxDogs: maxDogs && parseInt(maxDogs),
    };
  };

}

module.exports = ASPCA;
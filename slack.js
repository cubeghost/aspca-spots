const { WebClient } = require('@slack/web-api');
const _ = require('lodash');
const { fromUnixTime, parseISO, format, add } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');

// const logger = require('./logger');
const Storage = require('./storage');

const web = new WebClient(process.env.SLACK_BOT_USER_TOKEN, {
  logLevel: 'ERROR',
});

const storage = new Storage('slack');

const tz = 'America/New_York';

/*

  [
    {
      date: '2021-10-01',
      text: 'Glendale/ Brooklyn CVC Self Transport- REDIRECTED\n' +
        'Location: Brooklyn CVC Self-Transport\n' +
        'Total Open Appts/Max # of Cats: 2\n' +
        'Max # of Dogs: 2',
      data: {
        transportType: 'Self Transport',
        location: 'Glendale',
        maxCats: 2,
        maxDogs: 2
      },
      eventClasses: [],
      dateClasses: []
    },
    {
      date: '2021-10-01',
      text: 'Brooklyn CVC Self Transport\n' +
        'Location: Brooklyn CVC Self-Transport\n' +
        'Total Open Appts/Max # of Cats: 1\n' +
        'Max # of Dogs: 2',
      data: {
        transportType: 'Self Transport',
        location: 'Brooklyn CVC',
        maxCats: 1,
        maxDogs: 2
      },
      eventClasses: [],
      dateClasses: []
    },
    {
      date: '2021-10-05',
      text: 'Brooklyn CVC Self Transport\n' +
        'Location: Brooklyn CVC Self-Transport\n' +
        'Total Open Appts/Max # of Cats: 2\n' +
        'Max # of Dogs: 5',
      data: {
        transportType: 'Self Transport',
        location: 'Brooklyn CVC',
        maxCats: 2,
        maxDogs: 5
      },
      eventClasses: [],
      dateClasses: []
    },
  ]



  events: [
    {
      date: '2021-10-12',
      text: 'Glendale/ Brooklyn CVC Self Transport- REDIRECTED\n' +
        'Location: Brooklyn CVC Self-Transport\n' +
        'Total Open Appts/Max # of Cats: 1\n' +
        'Max # of Dogs: 1',
      eventClasses: [Array],
      dateClasses: [Array],
      data: [Object]
    }
  ]


 */

const intersperse = (array, separator) => array.flatMap(value => [separator, value]).slice(1);

const DIVIDER = {
  type: 'divider',
};

const NO_LONGER_AVAILABLE = {
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: ':warning: No longer available'
  }
};

const createEventBlock = ({text, data}) => {
  if (!data || _.some(Object.values(data), _.isNil)) {
    return {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: text,
        },
      ],
    }
  } else {
    return {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Type:*\n${data.transportType}`
        },
        {
          type: 'mrkdwn',
          text: `*Location:*\n${data.location}`
        },
        {
          type: 'mrkdwn',
          text: `:cat2:\n*Cats:*\n${data.maxCats}`
        },
        {
          type: 'mrkdwn',
          text: `:dog2:\n*Dogs:*\n${data.maxDogs}`
        }
      ]
    };
  }
};

const createTimestampBlock = () => ({
  type: 'context',
  elements: [
    {
      type: 'plain_text',
      text: format(utcToZonedTime(new Date(), tz), 'MMM d yyyy, h:mm aaa'),
    },
  ],
});

const createDateBlock = (dateString) => {
  const formattedDate = format(parseISO(dateString), 'cccc, MMMM d');

  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: formattedDate,
    },
    block_id: dateString,
  };
}

const composeBlocks = (events) => {
  const blocks = [];
  const groupedEvents = _.groupBy(events, 'date');

  Object.keys(groupedEvents).forEach((dateString) => {
    blocks.push(createDateBlock(dateString));
    
    const eventsForDate = groupedEvents[dateString];
    const eventBlocks = eventsForDate.map(createEventBlock);

    blocks.push(...intersperse(eventBlocks, DIVIDER));
  });

  blocks.push(createTimestampBlock());

  return blocks;
};

const updateBlocks = (prevEvents, events) => {
  const blocks = [];
  const groupedPrevEvents = _.groupBy(prevEvents, 'date');
  const groupedEvents = _.groupBy(events, 'date');

  // TODO what to do if there are more events than there were in prevEvents
  Object.keys(groupedPrevEvents).forEach((dateString) => {
    const prevEventsForDate = groupedPrevEvents[dateString];
    const eventsForDate = groupedEvents[dateString] || [];
    blocks.push(createDateBlock(dateString));

    const eventBlocks = _.compact(prevEventsForDate.map((prevEvent) => {
      const matchingEvent = eventsForDate.find((event) => {
        if (prevEvent.data && event.data) {
          return event.data.transportType === prevEvent.data.transportType && 
                 event.data.location === prevEvent.data.location;
        } else {
          return prevEvent.text.split('\n')?.[0] === event.text.split('\n')?.[0];
        }
      });

      if (matchingEvent) {
        return createEventBlock(matchingEvent);
      }
    }));

    if (eventBlocks.length === 0) {
      blocks.push(NO_LONGER_AVAILABLE);
    } else {
      blocks.push(...intersperse(eventBlocks, DIVIDER));
    }

    // Reflect.deleteProperty(groupedEvents, dateString);
  });

  blocks.push(createTimestampBlock());

  return blocks;
};

const timestampIsRecent = (slackTimestamp) => {
  const epoch = parseInt(slackTimestamp.split('.')[0]);
  const timestampDate = fromUnixTime(epoch);

  return new Date() <= add(timestampDate, { minutes: 5 });
};

const postEvents = async (events) => {
  const { lastMessageTimestamp, lastEvents } = await storage.get();

  if (lastMessageTimestamp && events.length === 0) {
    const blocks = [];
    const dates = Object.keys(_.groupBy(lastEvents, 'date'));

    dates.forEach((date) => {
      blocks.push(createDateBlock(date));
      blocks.push(NO_LONGER_AVAILABLE);
    });

    blocks.push(createTimestampBlock());
    
    const response = await web.chat.update({
      channel: process.env.SLACK_CHANNEL_ID,
      ts: lastMessageTimestamp,
      blocks: blocks,
    });

    await storage.set({
      lastMessageTimestamp: null,
      lastEvents: null,
    });

    return response;
  }

  if (events.length) {
    let response;

    if (lastMessageTimestamp && timestampIsRecent(lastMessageTimestamp)) {
      response = await web.chat.update({
        channel: process.env.SLACK_CHANNEL_ID,
        ts: lastMessageTimestamp,
        blocks: updateBlocks(lastEvents, events),
      });
    } else {
      response = await web.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID,
        blocks: composeBlocks(events),
      });
    }

    // console.log(JSON.stringify(response.message.blocks, null, 2))

    if (!response.ok) {
      // TODO
      await storage.set({});
    }

    await storage.set({
      lastMessageTimestamp: response.ts,
      lastEvents: events, 
      // this needs to be like a merge of the previous lastEvents with the 
      // current one, somehow. like preserving the dates? maybe we do need to store these as grouped by date
    });

    return response;
  }
};

module.exports = {
  postEvents,
};

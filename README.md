# aspca spots notifier

#### **note:** it's unclear if this works running on a server yet (may be an issue with headless mode), but you can run it on your computer and use a tool like `caffeine` to keep it awake 

this app scrapes the [ASPCA Rescue Services Scheduler calendar](https://www.aspca.org/nyc/aspca-veterinary-spayneuter-services-new-york-city/rescue-professionals#tab-3) for available spay/neuter and transportation appointments at any of the NYC-based rescue clinics and notifies a Slack channel if any are found. you must have an ASPCA RSS Rescuer account to use the scraper.

this does _not_ automatically reserve appointments. doing so is likely against the ASPCA's terms of service and makes things harder for your fellow rescuers. please do not use this code for that purpose.

we are all unfortunately competing for scarce resources, but please be courteous to other rescuers!

## setup

1. [TODO] creating slack app instructions
2. `yarn install`
3. `cp sample.env .env`, and fill in the following environment variables
    - your ASPCA RSS email in `ASPCA_AUTH_EMAIL` and password in `ASPCA_AUTH_PASSWORD`
    - your Slack token from step 1 in `SLACK_BOT_USER_TOKEN`
    - the Slack channel ID you want notifications to go to in `SLACK_CHANNEL_ID`
      - in the desktop app, you can find the channel ID by clicking on the channel title and scrolling down to the bottom of the "About" section
      - I recommend creating a dedicated channel just for these notifications so that you can turn on push notifications for all messages in the channel
    - set `DISABLE_HEADLESS` to true if you'd like to see the scraper do its work
    - you can ignore the `SENTRY_` and `LOGZ_` variables unless you'd like to send logs or errors to those third party services
4. `yarn start`

## todo
- figure out a threshold for when to fetch the next month as well as the current month (probably ~7 days) 
- probably need a way to disable scraping around 6am on the morning appointments become available
- there are many todos in slack.js
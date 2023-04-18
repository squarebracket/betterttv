import ReconnectingEventSource from 'reconnecting-eventsource';
import watcher from '../../watcher.js';
import settings from '../../settings.js';
import AbstractEmotes from '../emotes/abstract-emotes.js';
import createEmote from './utils.js';
import {EmoteCategories, EmoteProviders, EmoteTypeFlags, SettingIds} from '../../constants.js';
import {hasFlag} from '../../utils/flags.js';
import {getCurrentChannel} from '../../utils/channel.js';
import formatMessage from '../../i18n/index.js';

const category = {
  id: EmoteCategories.SEVENTV_CHANNEL,
  provider: EmoteProviders.SEVENTV,
  displayName: formatMessage({defaultMessage: '7TV Channel Emotes'}),
};

let eventSource;

class SevenTVChannelEmotes extends AbstractEmotes {
  constructor() {
    super();

    watcher.on('channel.updated', () => this.updateChannelEmotes());
    settings.on(`changed.${SettingIds.EMOTES}`, () => this.updateChannelEmotes());
  }

  get category() {
    return category;
  }

  updateChannelEmotes() {
    if (eventSource != null) {
      try {
        eventSource.close();
      } catch (_) {}
    }

    this.emotes.clear();

    if (!hasFlag(settings.get(SettingIds.EMOTES), EmoteTypeFlags.SEVENTV_EMOTES)) return;

    const currentChannel = getCurrentChannel();
    if (!currentChannel) return;

    fetch(
      `https://7tv.io/v3/users/${encodeURIComponent(currentChannel.provider)}/${encodeURIComponent(currentChannel.id)}`
    )
      .then((response) => response.json())
      .then(({emote_set: emoteSet, user: {id: userId}}) => {
        const currentEmoteSet = emoteSet.id;

        eventSource = new ReconnectingEventSource(
          `https://events.7tv.io/v3@emote_set.update<object_id=${currentEmoteSet}>,user.update<object_id=${userId}>`
        );
        eventSource.addEventListener('dispatch', (event) => this.handleEventSourceUpdate(event));

        const {emotes} = emoteSet ?? {};
        if (emotes == null) {
          return;
        }

        for (const {
          id,
          name: code,
          data: {listed, animated, owner},
        } of emotes) {
          if (!listed) {
            continue;
          }

          this.emotes.set(code, createEmote(id, code, animated, owner, category));
        }
      })
      .then(() => watcher.emit('emotes.updated'));

    window.testUpdate = (event) => this.handleEventSourceUpdate(event);
  }

  handleEventSourceUpdate(event) {
    const {type, body} = JSON.parse(event.data);

    const currentChannel = getCurrentChannel();
    if (!currentChannel) {
      return;
    }

    if (type === 'user.update') {
      // user changed emote set, so reload all emotes
      this.updateChannelEmotes();
      return;
    }

    let message;
    if (body.pushed) {
      // emote added
      body.pushed.forEach((data) => {
        const emote = data.value.data;
        if (!emote.listed) {
          return;
        }

        // if the emote was given a custom name, it only shows in data.value.name
        const code = data.value.name;
        this.emotes.set(code, createEmote(emote.id, code, emote.animated, emote.owner, category));

        message = formatMessage(
          {defaultMessage: '7TV Emotes: {emoteCode} has been added to chat'},
          {emoteCode: `${code} \u200B \u200B${code}\u200B`}
        );
      });
    }
    if (body.pulled) {
      // emote removed
      body.pulled.forEach((data) => {
        const emote = data.old_value;
        const existingEmote = this.getEligibleEmoteById(emote.id);
        if (existingEmote == null) {
          return;
        }

        this.emotes.delete(existingEmote.code);

        message = formatMessage(
          {defaultMessage: '7TV Emotes: {emoteCode} has been removed from chat'},
          {emoteCode: `\u200B${existingEmote.code}\u200B`}
        );
      });
    }
    if (body.updated) {
      // emote renamed
      body.updated.forEach((data) => {
        const oldEmote = data.old_value;
        const emote = data.value.data;
        const existingEmote = this.getEligibleEmoteById(oldEmote.id);
        if (existingEmote == null) {
          return;
        }

        this.emotes.delete(existingEmote.code);

        if (!emote.listed) {
          return;
        }

        // if the emote was given a custom name, it only shows in data.value.name
        const code = data.value.name;
        this.emotes.set(code, createEmote(emote.id, code, emote.animated, emote.owner, category));
      });
    }

    watcher.emit('emotes.updated');
    if (message != null) {
      watcher.emit('chat.send_admin_message', message);
    }
  }
}

export default new SevenTVChannelEmotes();

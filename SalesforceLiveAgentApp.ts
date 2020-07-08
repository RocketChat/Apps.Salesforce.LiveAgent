import {
  IAppAccessors,
  IConfigurationExtend,
  IEnvironmentRead,
  IHttp,
  ILogger,
  IModify,
  IPersistence,
  IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import {
  ILivechatMessage,
  ILivechatRoom,
} from '@rocket.chat/apps-engine/definition/livechat';
import {
  IMessage,
  IPostMessageSent,
} from '@rocket.chat/apps-engine/definition/messages';
import {
  IAppInfo,
  RocketChatAssociationModel,
  RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettings } from './AppSettings';
import { InitiateSalesforceSession } from './handlers/InitiateSalesforceSession';
import {
  sendDebugLCMessage,
  sendLCMessage,
} from './helperFunctions/GeneralHelpers';
import { SalesforceHelpers } from './helperFunctions/SalesforceHelpers';

export class SalesforcePluginApp extends App implements IPostMessageSent {
  constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
    super(info, logger, accessors);
  }

  public async initialize(
    configurationExtend: IConfigurationExtend,
    environmentRead: IEnvironmentRead,
  ): Promise<void> {
    await this.extendConfiguration(configurationExtend);
    this.getLogger().log('App Initialized');
  }

  public async executePostMessageSent(
    message: IMessage,
    read: IRead,
    http: IHttp,
    persistence: IPersistence,
    modify: IModify,
  ): Promise<void> {
    const dialogflowBotUsername: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('dialogflow_bot_username')
    ).value;
    const salesforceBotUsername: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_bot_username')
    ).value;
    const salesforceChatApiEndpoint: string = (
      await read
        .getEnvironmentReader()
        .getSettings()
        .getById('salesforce_chat_api_endpoint')
    ).value;

    if (message.sender.username === dialogflowBotUsername) {
      return;
    } else if (message.room.type !== 'l') {
      return;
    }

    const lmessage: ILivechatMessage = message;
    const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
    const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : message.sender;

    if (message.text === 'initiate_salesforce_session') {
      const initiateSalesforceSessionhandler = new InitiateSalesforceSession(
        message,
        read,
        http,
        persistence,
        modify,
      );

      try {
        initiateSalesforceSessionhandler.exec();
      } catch (error) {
        console.log(error);
      }
    }

    if (LcAgent.username === salesforceBotUsername) {
      const assoc = new RocketChatAssociationRecord(
        RocketChatAssociationModel.ROOM,
        message.room.id,
      );

      let persisantAffinity;
      let persistantKey;

      try {
        const awayDatas = await read
          .getPersistenceReader()
          .readByAssociation(assoc);

        const contentStringified = JSON.stringify(awayDatas[0]);
        const contentParsed = JSON.parse(contentStringified);

        console.log(
          'Find Session Variables from Persistent Storage, Response: ',
          contentParsed,
        );

        persisantAffinity = contentParsed.affinityToken;
        persistantKey = contentParsed.key;
      } catch {
        console.log(
          'Error: Cannot Find Session Variables from Persistent Storage.',
        );
      }

      const salesforceHelpers: SalesforceHelpers = new SalesforceHelpers();

      if (
        message.text === 'Closed by visitor' &&
        persisantAffinity &&
        persistantKey
      ) {
        await salesforceHelpers
          .closeChat(
            http,
            salesforceChatApiEndpoint,
            persisantAffinity,
            persistantKey,
          )
          .then(async (res) => {
            console.log('Closing Liveagent Chat, Response:', res);
            await persistence.removeByAssociation(assoc);
          })
          .catch((error) => {
            console.log('Closing Liveagent Chat, Error:', error);
          });
      }

      if (
        message.sender.username !== salesforceBotUsername &&
        message.text !== 'Closed by visitor' &&
        persisantAffinity &&
        persistantKey
      ) {
        let messageText = '';
        if (message.text) {
          messageText = message.text;
        }
        await salesforceHelpers
          .sendMessages(
            http,
            salesforceChatApiEndpoint,
            persisantAffinity,
            persistantKey,
            messageText,
          )
          .then((res) => {
            console.log('Sending Message To Liveagent, Response:', res);
          })
          .catch((error) => {
            console.log('Sending Message To Liveagent, Error:', error);
          });
      }

      if (persisantAffinity && persistantKey) {
        await salesforceHelpers
          .pullMessages(
            http,
            salesforceChatApiEndpoint,
            persisantAffinity,
            persistantKey,
          )
          .then(async (response) => {
            console.log(
              'Pulling Messages from Liveagent, response here:',
              response,
            );

            const { content } = response;
            const contentParsed = JSON.parse(content || '{}');

            const messageArray = contentParsed.messages;

            if (messageArray) {
              console.log(
                'Pulling Messages from Liveagent, messageArray here:',
                messageArray,
              );
              messageArray.forEach(async (i) => {
                const type = i.type;

                switch (type) {
                  case 'ChatMessage':
                    const messageText = i.message.text;
                    await sendLCMessage(
                      modify,
                      message.room,
                      messageText,
                      LcAgent,
                    );
                    break;

                  case 'AgentTyping':
                    await sendDebugLCMessage(
                      read,
                      modify,
                      message.room,
                      'Agent Typing',
                      LcAgent,
                    );
                    break;

                  case 'ChatEnded':
                    await sendDebugLCMessage(
                      read,
                      modify,
                      message.room,
                      'Chat Ended By Agent',
                      LcAgent,
                    );
                    await persistence.removeByAssociation(assoc);
                    break;

                  default:
                    console.log(
                      'Pulling Messages from Liveagent, Default messageType:',
                      type,
                    );
                    break;
                }
              });
            }
          })
          .catch((error) => {
            console.log('Pulling Messages from Liveagent, Error:', error);
          });
      }
    }
  }

  public async extendConfiguration(
    configuration: IConfigurationExtend,
  ): Promise<void> {
    AppSettings.forEach((setting) =>
      configuration.settings.provideSetting(setting),
    );
  }
}
